/**
 * Value classifier for detecting parameter value types and dynamic confidence
 */

import { ValueType, ParameterLocation, ClassificationResult } from "../../shared/dist/types.js";
import { 
  VALUE_TYPE_PATTERNS, 
  VALUE_TYPE_CHECK_ORDER,
  INTERESTING_DYNAMIC_THRESHOLD 
} from "../../shared/dist/constants.js";

/**
 * Statistical tracker for dynamic confidence calculation
 */
interface ValueStats {
  uniqueValues: Set<string>;
  totalObservations: number;
  typeFrequency: Map<ValueType, number>;
  lengthVariance: {
    lengths: number[];
    mean: number;
    variance: number;
  };
  entropy: number;
}

/**
 * Classification cache to avoid re-computing results for same values
 */
const classificationCache = new Map<string, ValueType>();

/**
 * Statistics tracker for each parameter (keyed by parameter ID)
 */
const parameterStats = new Map<string, ValueStats>();

/**
 * Classifies a parameter value and returns its detected type with confidence
 */
export function classifyValue(value: string): ValueType {
  // Check cache first for performance
  if (classificationCache.has(value)) {
    return classificationCache.get(value)!;
  }

  // Check each value type pattern in order of specificity
  for (const valueType of VALUE_TYPE_CHECK_ORDER) {
    const pattern = VALUE_TYPE_PATTERNS[valueType];
    if (pattern.test(value)) {
      classificationCache.set(value, valueType);
      return valueType;
    }
  }

  // Fallback to STRING (should never reach here due to catch-all pattern)
  classificationCache.set(value, ValueType.STRING);
  return ValueType.STRING;
}

/**
 * Updates statistics for a parameter and calculates dynamic confidence
 */
export function updateParameterStats(
  parameterId: string,
  value: string,
  valueType: ValueType
): number {
  let stats = parameterStats.get(parameterId);
  
  if (!stats) {
    stats = {
      uniqueValues: new Set(),
      totalObservations: 0,
      typeFrequency: new Map(),
      lengthVariance: {
        lengths: [],
        mean: 0,
        variance: 0
      },
      entropy: 0
    };
    parameterStats.set(parameterId, stats);
  }

  // Update basic statistics
  stats.uniqueValues.add(value);
  stats.totalObservations++;
  
  // Update type frequency
  const currentCount = stats.typeFrequency.get(valueType) || 0;
  stats.typeFrequency.set(valueType, currentCount + 1);

  // Update length statistics
  stats.lengthVariance.lengths.push(value.length);
  updateLengthStatistics(stats.lengthVariance);
  
  // Calculate and update entropy
  stats.entropy = calculateEntropy(stats.uniqueValues);

  // Calculate dynamic confidence
  return calculateDynamicConfidence(stats);
}

/**
 * Calculates dynamic confidence based on parameter statistics
 * Returns a value from 0-1 indicating how likely the parameter accepts dynamic values
 */
export function calculateDynamicConfidence(stats: ValueStats): number {
  if (stats.totalObservations < 2) {
    return 0.5; // Not enough data, return neutral confidence
  }

  const factors: number[] = [];

  // Factor 1: Unique value ratio (more unique values = more dynamic)
  const uniqueRatio = stats.uniqueValues.size / stats.totalObservations;
  factors.push(Math.min(uniqueRatio * 2, 1)); // Cap at 1.0

  // Factor 2: Value type diversity (mixed types = more dynamic)
  const typeCount = stats.typeFrequency.size;
  const typeDiversity = Math.min(typeCount / 3, 1); // Normalize by expected max types
  factors.push(typeDiversity);

  // Factor 3: Length variance (varied lengths = more dynamic)
  const lengthVarianceFactor = Math.min(stats.lengthVariance.variance / 100, 1);
  factors.push(lengthVarianceFactor);

  // Factor 4: Entropy (higher entropy = more dynamic)
  const entropyFactor = Math.min(stats.entropy / 4, 1); // Normalize entropy
  factors.push(entropyFactor);

  // Factor 5: Specific value type bonuses/penalties
  const typeBonus = calculateTypeBonus(stats.typeFrequency, stats.totalObservations);
  factors.push(typeBonus);

  // Weighted average of all factors
  const weights = [0.3, 0.2, 0.2, 0.2, 0.1]; // Emphasize unique ratio most
  const weightedSum = factors.reduce((sum, factor, index) => sum + (factor * weights[index]), 0);
  
  return Math.max(0, Math.min(1, weightedSum));
}

/**
 * Calculate type-specific bonus for dynamic confidence
 */
function calculateTypeBonus(typeFrequency: Map<ValueType, number>, totalObservations: number): number {
  let bonus = 0;

  // High-entropy types get bonuses
  const highEntropyTypes = [ValueType.UUID, ValueType.JWT, ValueType.HASH, ValueType.BASE64];
  const lowEntropyTypes = [ValueType.BOOLEAN, ValueType.EMPTY];
  
  for (const [type, count] of typeFrequency) {
    const ratio = count / totalObservations;
    
    if (highEntropyTypes.includes(type)) {
      bonus += ratio * 0.8; // Strong indicator of dynamic content
    } else if (lowEntropyTypes.includes(type)) {
      bonus -= ratio * 0.3; // Weak indicator of static content
    } else if (type === ValueType.INTEGER || type === ValueType.DECIMAL) {
      bonus += ratio * 0.4; // Numbers are often dynamic (IDs, counts, etc.)
    } else if (type === ValueType.STRING) {
      // String bonus depends on other factors - handled by length/entropy
      bonus += ratio * 0.2;
    }
  }

  return Math.max(0, Math.min(1, bonus));
}

/**
 * Updates length statistics (mean and variance)
 */
function updateLengthStatistics(lengthStats: ValueStats['lengthVariance']): void {
  const lengths = lengthStats.lengths;
  const n = lengths.length;
  
  if (n === 0) return;
  
  // Calculate mean
  const sum = lengths.reduce((acc, len) => acc + len, 0);
  lengthStats.mean = sum / n;
  
  // Calculate variance
  if (n > 1) {
    const squaredDiffs = lengths.map(len => Math.pow(len - lengthStats.mean, 2));
    lengthStats.variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / (n - 1);
  } else {
    lengthStats.variance = 0;
  }
}

/**
 * Calculates Shannon entropy for a set of values
 */
function calculateEntropy(values: Set<string>): number {
  if (values.size <= 1) return 0;
  
  // For unique values, entropy is simply log2(count)
  // This gives us the information content in bits
  return Math.log2(values.size);
}

/**
 * Gets the current dynamic confidence for a parameter
 */
export function getDynamicConfidence(parameterId: string): number {
  const stats = parameterStats.get(parameterId);
  if (!stats) return 0.5; // No data available
  
  return calculateDynamicConfidence(stats);
}

/**
 * Gets the value type distribution for a parameter
 */
export function getValueTypeDistribution(parameterId: string): Map<ValueType, number> {
  const stats = parameterStats.get(parameterId);
  return stats?.typeFrequency || new Map();
}

/**
 * Gets comprehensive statistics for a parameter
 */
export function getParameterStatistics(parameterId: string): ValueStats | null {
  return parameterStats.get(parameterId) || null;
}

/**
 * Determines if a parameter is "interesting" based on dynamic confidence and other factors
 */
export function isParameterInteresting(parameterId: string): boolean {
  const stats = parameterStats.get(parameterId);
  if (!stats) return false;
  
  const dynamicConfidence = calculateDynamicConfidence(stats);
  
  // Consider interesting if:
  // 1. High dynamic confidence
  // 2. Multiple value types observed
  // 3. High entropy values
  return (
    dynamicConfidence >= INTERESTING_DYNAMIC_THRESHOLD ||
    stats.typeFrequency.size >= 3 ||
    stats.entropy >= 3
  );
}

/**
 * Clears statistics for a specific parameter
 */
export function clearParameterStats(parameterId: string): void {
  parameterStats.delete(parameterId);
}

/**
 * Clears all statistics and caches
 */
export function clearAllStats(): void {
  parameterStats.clear();
  classificationCache.clear();
}

/**
 * Gets memory usage statistics for monitoring
 */
export function getMemoryStats(): { 
  parametersTracked: number; 
  cacheSize: number; 
  totalUniqueValues: number 
} {
  let totalUniqueValues = 0;
  for (const stats of parameterStats.values()) {
    totalUniqueValues += stats.uniqueValues.size;
  }
  
  return {
    parametersTracked: parameterStats.size,
    cacheSize: classificationCache.size,
    totalUniqueValues
  };
}

/**
 * Full classification with all metadata
 */
export function classifyParameter(
  parameterId: string,
  value: string,
  location: ParameterLocation
): ClassificationResult {
  // Classify the value type
  const valueType = classifyValue(value);
  
  // Update statistics and get dynamic confidence
  const dynamicConfidence = updateParameterStats(parameterId, value, valueType);
  
  // Calculate classification confidence based on value type specificity
  let confidence = 1.0;
  
  // Adjust confidence based on value type specificity
  switch (valueType) {
    case ValueType.EMPTY:
    case ValueType.UUID:
    case ValueType.JWT:
    case ValueType.EMAIL:
    case ValueType.URL:
      confidence = 0.95; // Very specific patterns
      break;
    case ValueType.HASH:
    case ValueType.TIMESTAMP:
      confidence = 0.85; // Fairly specific but could have false positives
      break;
    case ValueType.BASE64:
      confidence = 0.75; // Can be ambiguous with some strings
      break;
    case ValueType.BOOLEAN:
    case ValueType.INTEGER:
    case ValueType.DECIMAL:
      confidence = 0.9; // Pretty specific
      break;
    case ValueType.STRING:
      confidence = 0.6; // Fallback type, lower confidence
      break;
  }
  
  // Adjust confidence based on location context
  if (location === ParameterLocation.PATH) {
    // Path parameters are more likely to be IDs/tokens
    if (valueType === ValueType.INTEGER || valueType === ValueType.UUID || valueType === ValueType.HASH) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }
  } else if (location === ParameterLocation.HEADER) {
    // Headers have more structured values
    if (valueType === ValueType.JWT || valueType === ValueType.BASE64) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }
  }
  
  return {
    valueType,
    confidence,
    dynamicConfidence
  };
}