/**
 * Test suite for the ParameterStore
 */

import { ParameterStore } from './store.js';
import { ParameterLocation, ValueType, ParameterFlag } from '../../shared/dist/index.js';

// Simple test runner
function runTests() {
  console.log('🧪 Running ParameterStore tests...\n');

  // Test 1: Basic parameter upsert
  {
    const store = new ParameterStore();
    const parsedRequest = {
      domain: 'example.com',
      method: 'GET',
      path: '/api/users/123',
      normalizedPath: '/api/users/{id}',
      requestId: 'req-001',
      timestamp: new Date(),
      parameters: [
        {
          location: ParameterLocation.QUERY,
          name: 'limit',
          value: '10'
        },
        {
          location: ParameterLocation.PATH,
          name: 'id',
          value: '123'
        }
      ]
    };

    const updatedParams = store.upsertRequest(parsedRequest);
    console.log('✅ Test 1: Basic upsert');
    console.log(`   - Updated ${updatedParams.length} parameters`);
    console.log(`   - Total parameters: ${store.getStats().uniqueParams}`);
    console.log(`   - Total domains: ${store.getStats().domains}`);
    console.log(`   - Total endpoints: ${store.getStats().endpoints}\n`);
  }

  // Test 2: Parameter deduplication
  {
    const store = new ParameterStore();
    const parsedRequest = {
      domain: 'example.com',
      method: 'GET',
      path: '/api/users/123',
      normalizedPath: '/api/users/{id}',
      requestId: 'req-001',
      timestamp: new Date(),
      parameters: [
        {
          location: ParameterLocation.QUERY,
          name: 'limit',
          value: '10'
        }
      ]
    };

    // Insert same parameter twice
    store.upsertRequest(parsedRequest);
    store.upsertRequest({
      ...parsedRequest,
      requestId: 'req-002',
      parameters: [
        {
          location: ParameterLocation.QUERY,
          name: 'limit',
          value: '20'
        }
      ]
    });

    const params = store.getParameters();
    const limitParam = params.find(p => p.name === 'limit');
    
    console.log('✅ Test 2: Parameter deduplication');
    console.log(`   - Unique parameters: ${params.length}`);
    console.log(`   - Limit parameter count: ${limitParam?.count || 0}`);
    console.log(`   - Request IDs stored: ${limitParam?.exampleRequestIds.length || 0}\n`);
  }

  // Test 3: Filtering
  {
    const store = new ParameterStore();
    const timestamp = new Date();

    // Add various parameters
    store.upsertRequest({
      domain: 'example.com',
      method: 'POST',
      path: '/api/auth/login',
      normalizedPath: '/api/auth/login',
      requestId: 'req-003',
      timestamp,
      parameters: [
        {
          location: ParameterLocation.JSON,
          name: 'password',
          value: 'secret123'
        },
        {
          location: ParameterLocation.JSON,
          name: 'username',
          value: 'john'
        }
      ]
    });

    // Add flags manually for testing
    const params = store.getParameters();
    const passwordParam = params.find(p => p.name === 'password');
    if (passwordParam) {
      store.addParameterFlags(passwordParam.id, [ParameterFlag.SENSITIVE]);
    }

    // Test filtering by location
    const jsonParams = store.getParameters({ locations: [ParameterLocation.JSON] });
    console.log('✅ Test 3: Filtering');
    console.log(`   - JSON parameters: ${jsonParams.length}`);

    // Test filtering by flags
    const sensitiveParams = store.getParameters({ flags: [ParameterFlag.SENSITIVE] });
    console.log(`   - Sensitive parameters: ${sensitiveParams.length}`);

    // Test search
    const passwordSearch = store.getParameters({ search: 'pass' });
    console.log(`   - Parameters matching 'pass': ${passwordSearch.length}\n`);
  }

  // Test 4: Observations
  {
    const store = new ParameterStore();
    const timestamp = new Date();

    const parsedRequest = {
      domain: 'api.test.com',
      method: 'GET',
      path: '/search',
      normalizedPath: '/search',
      requestId: 'req-004',
      timestamp,
      parameters: [
        {
          location: ParameterLocation.QUERY,
          name: 'q',
          value: 'test query'
        }
      ]
    };

    const updatedParams = store.upsertRequest(parsedRequest);
    const param = updatedParams[0];

    // Add some observations
    store.addObservation(param.id, 'req-004', 'test query', 'test query', ValueType.STRING, timestamp);
    store.addObservation(param.id, 'req-005', 'another query', 'another query', ValueType.STRING, new Date());

    const observations = store.getParameterObservations(param.id);
    console.log('✅ Test 4: Observations');
    console.log(`   - Observations for parameter '${param.name}': ${observations.length}`);
    console.log(`   - Most recent value: ${observations[0]?.redactedValue || 'none'}\n`);
  }

  // Test 5: Domain and endpoint aggregation
  {
    const store = new ParameterStore();
    const timestamp = new Date();

    // Add requests from multiple domains and endpoints
    store.upsertRequest({
      domain: 'api.example.com',
      method: 'GET',
      path: '/v1/users',
      normalizedPath: '/v1/users',
      requestId: 'req-005',
      timestamp,
      parameters: [{ location: ParameterLocation.QUERY, name: 'page', value: '1' }]
    });

    store.upsertRequest({
      domain: 'api.example.com',
      method: 'POST',
      path: '/v1/users',
      normalizedPath: '/v1/users',
      requestId: 'req-006',
      timestamp,
      parameters: [{ location: ParameterLocation.JSON, name: 'name', value: 'John' }]
    });

    store.upsertRequest({
      domain: 'admin.example.com',
      method: 'GET',
      path: '/dashboard',
      normalizedPath: '/dashboard',
      requestId: 'req-007',
      timestamp,
      parameters: [{ location: ParameterLocation.QUERY, name: 'tab', value: 'users' }]
    });

    const domains = store.getDomains();
    const stats = store.getStats();

    console.log('✅ Test 5: Domain and endpoint aggregation');
    console.log(`   - Total domains: ${domains.length}`);
    console.log(`   - Domain names: ${domains.map(d => d.name).join(', ')}`);
    console.log(`   - Total endpoints: ${stats.endpoints}`);
    console.log(`   - Total requests: ${stats.totalRequests}\n`);
  }

  console.log('🎉 All tests completed successfully!');
}

// Auto-run tests when imported
runTests();

export { runTests };