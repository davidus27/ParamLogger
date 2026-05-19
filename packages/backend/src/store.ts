/**
 * In-memory parameter store for the inventory
 */

import { 
  Parameter, 
  Domain, 
  Endpoint, 
  Observation, 
  ParsedRequest, 
  ParsedParameter,
  ParameterLocation, 
  ParameterFlag, 
  ValueType,
  InventoryFilters,
  InventoryStats,
  DEFAULT_CONFIG, 
  NEW_PARAMETER_THRESHOLD_MS, 
  INTERESTING_DYNAMIC_THRESHOLD 
} from '../../shared/dist/index.js';

/**
 * Core parameter store implementation
 * Manages parameters, domains, endpoints, and observations in memory
 */
export class ParameterStore {
  private parameters = new Map<string, Parameter>(); // keyed by parameter ID
  private domains = new Map<string, Domain>(); // keyed by domain name
  private endpoints = new Map<string, Endpoint>(); // keyed by endpoint ID (domain:method:normalizedPath)
  private observations = new Map<string, Observation[]>(); // keyed by parameter ID
  private stats: InventoryStats = {
    totalRequests: 0,
    totalParams: 0,
    uniqueParams: 0,
    domains: 0,
    endpoints: 0
  };

  /**
   * Generate unique parameter ID
   */
  private generateParameterId(domain: string, method: string, normalizedPath: string, location: ParameterLocation, name: string): string {
    return `${domain}:${method}:${normalizedPath}:${location}:${name}`;
  }

  /**
   * Generate unique endpoint ID
   */
  private generateEndpointId(domain: string, method: string, normalizedPath: string): string {
    return `${domain}:${method}:${normalizedPath}`;
  }

  /**
   * Generate unique observation ID
   */
  private generateObservationId(parameterId: string, requestId: string, timestamp: Date): string {
    return `${parameterId}:${requestId}:${timestamp.getTime()}`;
  }

  /**
   * Upsert a parsed request into the store
   * This is the main entry point for adding new data
   */
  upsertRequest(parsedRequest: ParsedRequest): Parameter[] {
    const updatedParameters: Parameter[] = [];
    
    // Update request stats
    this.stats.totalRequests++;
    
    // Ensure domain exists
    this.upsertDomain(parsedRequest.domain, parsedRequest.timestamp);
    
    // Ensure endpoint exists
    this.upsertEndpoint(parsedRequest.domain, parsedRequest.method, parsedRequest.path, parsedRequest.normalizedPath, parsedRequest.timestamp);
    
    // Process each parameter
    for (const parsedParam of parsedRequest.parameters) {
      const parameter = this.upsertParameter(
        parsedRequest.domain,
        parsedRequest.method,
        parsedRequest.path,
        parsedRequest.normalizedPath,
        parsedParam,
        parsedRequest.requestId,
        parsedRequest.timestamp
      );
      
      if (parameter) {
        updatedParameters.push(parameter);
      }
    }
    
    this.updateStats();
    return updatedParameters;
  }

  /**
   * Upsert a domain
   */
  private upsertDomain(domainName: string, timestamp: Date): Domain {
    let domain = this.domains.get(domainName);
    
    if (!domain) {
      domain = {
        name: domainName,
        endpoints: [],
        totalParams: 0,
        lastSeen: timestamp
      };
      this.domains.set(domainName, domain);
    } else {
      domain.lastSeen = timestamp;
    }
    
    return domain;
  }

  /**
   * Upsert an endpoint
   */
  private upsertEndpoint(domain: string, method: string, path: string, normalizedPath: string, timestamp: Date): Endpoint {
    const endpointId = this.generateEndpointId(domain, method, normalizedPath);
    let endpoint = this.endpoints.get(endpointId);
    
    if (!endpoint) {
      endpoint = {
        method,
        path,
        normalizedPath,
        parameters: [],
        requestCount: 1,
        firstSeen: timestamp,
        lastSeen: timestamp
      };
      this.endpoints.set(endpointId, endpoint);
      
      // Add to domain's endpoints list
      const domainObj = this.domains.get(domain);
      if (domainObj) {
        domainObj.endpoints.push(endpoint);
      }
    } else {
      endpoint.requestCount++;
      endpoint.lastSeen = timestamp;
      // Update path if this is a more recent/specific version
      if (path !== endpoint.path) {
        endpoint.path = path;
      }
    }
    
    return endpoint;
  }

  /**
   * Upsert a parameter
   */
  private upsertParameter(
    domain: string, 
    method: string, 
    path: string, 
    normalizedPath: string, 
    parsedParam: ParsedParameter, 
    requestId: string, 
    timestamp: Date
  ): Parameter | null {
    const parameterId = this.generateParameterId(domain, method, normalizedPath, parsedParam.location, parsedParam.name);
    let parameter = this.parameters.get(parameterId);
    
    if (!parameter) {
      // Create new parameter
      parameter = {
        id: parameterId,
        domain,
        method,
        path,
        normalizedPath,
        location: parsedParam.location,
        name: parsedParam.name,
        valueTypes: [],
        dynamicConfidence: 0,
        flags: [],
        count: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
        redactedExamples: [],
        exampleRequestIds: [requestId]
      };
      
      this.parameters.set(parameterId, parameter);
      
      // Add to endpoint's parameters list
      const endpointId = this.generateEndpointId(domain, method, normalizedPath);
      const endpoint = this.endpoints.get(endpointId);
      if (endpoint) {
        endpoint.parameters.push(parameter);
      }
      
      // Mark as new if within threshold
      if (this.isParameterNew(timestamp)) {
        parameter.flags.push(ParameterFlag.NEW);
      }
      
    } else {
      // Update existing parameter
      parameter.count++;
      parameter.lastSeen = timestamp;
      
      // Update path if this is more recent/specific
      if (path !== parameter.path) {
        parameter.path = path;
      }
      
      // Add request ID if not already present and within limits
      if (!parameter.exampleRequestIds.includes(requestId) && 
          parameter.exampleRequestIds.length < DEFAULT_CONFIG.maxExampleRequestIds) {
        parameter.exampleRequestIds.push(requestId);
      }
      
      // Remove NEW flag if parameter is old enough
      if (parameter.flags.includes(ParameterFlag.NEW) && !this.isParameterNew(parameter.firstSeen)) {
        parameter.flags = parameter.flags.filter((flag: ParameterFlag) => flag !== ParameterFlag.NEW);
      }
    }
    
    return parameter;
  }

  /**
   * Add an observation for a parameter
   */
  addObservation(
    parameterId: string, 
    requestId: string, 
    value: string, 
    redactedValue: string, 
    valueType: ValueType, 
    timestamp: Date,
    contextPath?: string
  ): Observation {
    const observationId = this.generateObservationId(parameterId, requestId, timestamp);
    
    const observation: Observation = {
      id: observationId,
      parameterId,
      requestId,
      value,
      redactedValue,
      valueType,
      timestamp,
      contextPath
    };
    
    // Get or create observations array for this parameter
    let paramObservations = this.observations.get(parameterId);
    if (!paramObservations) {
      paramObservations = [];
      this.observations.set(parameterId, paramObservations);
    }
    
    // Add observation (keep only the most recent N observations)
    paramObservations.push(observation);
    
    // Trim to max observations per parameter
    const maxObservations = DEFAULT_CONFIG.maxExamplesPerParameter * 2; // Keep more observations than examples
    if (paramObservations.length > maxObservations) {
      paramObservations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      paramObservations.splice(maxObservations);
    }
    
    return observation;
  }

  /**
   * Update value types and dynamic confidence for a parameter based on its observations
   */
  updateParameterMetrics(parameterId: string, valueType: ValueType, dynamicConfidence: number): void {
    const parameter = this.parameters.get(parameterId);
    if (!parameter) return;
    
    // Add value type if not already present
    if (!parameter.valueTypes.includes(valueType)) {
      parameter.valueTypes.push(valueType);
    }
    
    // Update dynamic confidence (use exponential moving average)
    const alpha = 0.1; // Smoothing factor
    parameter.dynamicConfidence = parameter.dynamicConfidence * (1 - alpha) + dynamicConfidence * alpha;
  }

  /**
   * Add flags to a parameter
   */
  addParameterFlags(parameterId: string, flags: ParameterFlag[]): void {
    const parameter = this.parameters.get(parameterId);
    if (!parameter) return;
    
    for (const flag of flags) {
      if (!parameter.flags.includes(flag)) {
        parameter.flags.push(flag);
      }
    }
  }

  /**
   * Add a redacted example to a parameter
   */
  addRedactedExample(parameterId: string, redactedValue: string): void {
    const parameter = this.parameters.get(parameterId);
    if (!parameter) return;
    
    // Only add if not already present and within limits
    if (!parameter.redactedExamples.includes(redactedValue) && 
        parameter.redactedExamples.length < DEFAULT_CONFIG.maxExamplesPerParameter) {
      parameter.redactedExamples.push(redactedValue);
    }
  }

  /**
   * Check if a parameter should be considered "new"
   */
  private isParameterNew(firstSeen: Date): boolean {
    const now = new Date();
    return (now.getTime() - firstSeen.getTime()) < NEW_PARAMETER_THRESHOLD_MS;
  }

  /**
   * Update aggregate statistics
   */
  private updateStats(): void {
    this.stats.uniqueParams = this.parameters.size;
    this.stats.totalParams = Array.from(this.parameters.values()).reduce((sum, param) => sum + param.count, 0);
    this.stats.domains = this.domains.size;
    this.stats.endpoints = this.endpoints.size;
    
    // Update domain total params
    for (const domain of this.domains.values()) {
      domain.totalParams = Array.from(this.parameters.values())
        .filter(param => param.domain === domain.name)
        .reduce((sum, param) => sum + param.count, 0);
    }
  }

  /**
   * Get filtered parameters based on search criteria
   */
  getParameters(filters?: InventoryFilters): Parameter[] {
    let parameters = Array.from(this.parameters.values());
    
    if (!filters) return parameters;
    
    // Apply search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      parameters = parameters.filter(param => 
        param.name.toLowerCase().includes(search) ||
        param.domain.toLowerCase().includes(search) ||
        param.normalizedPath.toLowerCase().includes(search)
      );
    }
    
    // Apply location filter
    if (filters.locations && filters.locations.length > 0) {
      parameters = parameters.filter(param => 
        filters.locations!.includes(param.location)
      );
    }
    
    // Apply flag filter
    if (filters.flags && filters.flags.length > 0) {
      parameters = parameters.filter(param => 
        filters.flags!.some((flag: ParameterFlag) => param.flags.includes(flag))
      );
    }
    
    // Apply domain filter
    if (filters.domains && filters.domains.length > 0) {
      parameters = parameters.filter(param => 
        filters.domains!.includes(param.domain)
      );
    }
    
    // Apply interesting filter
    if (filters.showInteresting) {
      parameters = parameters.filter(param => 
        param.flags.length > 0 || param.dynamicConfidence > INTERESTING_DYNAMIC_THRESHOLD
      );
    }
    
    // Apply new filter
    if (filters.showNew) {
      parameters = parameters.filter(param => 
        param.flags.includes(ParameterFlag.NEW)
      );
    }
    
    return parameters;
  }

  /**
   * Get all domains with their endpoint information
   */
  getDomains(): Domain[] {
    return Array.from(this.domains.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get a specific parameter by ID
   */
  getParameter(id: string): Parameter | null {
    return this.parameters.get(id) || null;
  }

  /**
   * Get observations for a specific parameter
   */
  getParameterObservations(parameterId: string, limit?: number): Observation[] {
    const observations = this.observations.get(parameterId) || [];
    
    // Sort by timestamp descending (most recent first)
    observations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (limit) {
      return observations.slice(0, limit);
    }
    
    return observations;
  }

  /**
   * Get current statistics
   */
  getStats(): InventoryStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Export parameter names as wordlist based on filters
   */
  exportWordlist(filters?: InventoryFilters): string[] {
    const parameters = this.getParameters(filters);
    const uniqueNames = new Set(parameters.map(param => param.name));
    return Array.from(uniqueNames).sort();
  }

  /**
   * Clear all data (for testing or reset)
   */
  clear(): void {
    this.parameters.clear();
    this.domains.clear();
    this.endpoints.clear();
    this.observations.clear();
    this.stats = {
      totalRequests: 0,
      totalParams: 0,
      uniqueParams: 0,
      domains: 0,
      endpoints: 0
    };
  }

  /**
   * Get parameter count by domain
   */
  getParameterCountByDomain(domain: string): number {
    return Array.from(this.parameters.values())
      .filter(param => param.domain === domain)
      .length;
  }

  /**
   * Get parameter count by endpoint
   */
  getParameterCountByEndpoint(domain: string, method: string, normalizedPath: string): number {
    const endpointId = this.generateEndpointId(domain, method, normalizedPath);
    const endpoint = this.endpoints.get(endpointId);
    return endpoint?.parameters.length || 0;
  }

  /**
   * Get parameters for a specific endpoint
   */
  getEndpointParameters(domain: string, method: string, normalizedPath: string): Parameter[] {
    return Array.from(this.parameters.values())
      .filter(param => 
        param.domain === domain && 
        param.method === method && 
        param.normalizedPath === normalizedPath
      );
  }

  /**
   * Update scan progress (used during historical scanning)
   */
  updateScanProgress(processed: number, total: number, isComplete: boolean): void {
    this.stats.scanProgress = {
      processed,
      total,
      isComplete
    };
  }

  /**
   * Get endpoint by ID
   */
  getEndpoint(domain: string, method: string, normalizedPath: string): Endpoint | null {
    const endpointId = this.generateEndpointId(domain, method, normalizedPath);
    return this.endpoints.get(endpointId) || null;
  }

  /**
   * Get all endpoints for a domain
   */
  getDomainEndpoints(domain: string): Endpoint[] {
    return Array.from(this.endpoints.values())
      .filter(endpoint => {
        // Check if any parameter in this endpoint belongs to the domain
        return Array.from(this.parameters.values())
          .some(param => param.domain === domain && 
            param.method === endpoint.method && 
            param.normalizedPath === endpoint.normalizedPath);
      })
      .sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath));
  }
}