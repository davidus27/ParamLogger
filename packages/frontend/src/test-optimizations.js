/**
 * Test script to verify the performance optimizations with large datasets
 */

import { mockCaido } from './mock-caido-sdk.ts';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';

// Generate a large dataset for performance testing
function generateLargeDataset(size = 1000) {
  console.log(`Generating ${size} mock parameters for testing...`);
  const parameters = [];
  const domains = ['api.example.com', 'auth.example.com', 'app.example.com', 'admin.example.com', 'test.example.com'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const locations = Object.values(ParameterLocation);
  const valueTypes = Object.values(ValueType);
  const flags = Object.values(Flag);
  const paths = [
    '/api/v1/users',
    '/api/v1/orders',
    '/api/v1/products',
    '/api/v1/search',
    '/api/v1/reports',
    '/oauth/authorize',
    '/oauth/token',
    '/app/dashboard',
    '/admin/users',
    '/admin/settings'
  ];

  for (let i = 0; i < size; i++) {
    const domain = domains[i % domains.length];
    const method = methods[i % methods.length];
    const path = paths[i % paths.length] + (i > paths.length ? `/${i}` : '');
    const location = locations[i % locations.length];
    
    parameters.push({
      id: `param-${i}`,
      domain,
      method,
      normalizedPath: path,
      location,
      name: `param_${i}`,
      valueTypes: [valueTypes[i % valueTypes.length]],
      flags: i % 5 === 0 ? [flags[i % flags.length]] : [],
      count: Math.floor(Math.random() * 100) + 1,
      firstSeen: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
      lastSeen: new Date()
    });
  }

  console.log(`Generated ${parameters.length} parameters across ${new Set(parameters.map(p => p.domain)).size} domains`);
  return parameters;
}

// Override the mock parameters with our large dataset
let LARGE_MOCK_PARAMETERS = generateLargeDataset(1500);

// Replace the original mock backend API
const originalGetInventory = mockCaido.backend.getInventory;
mockCaido.backend.getInventory = async function(filters) {
  const startTime = performance.now();
  console.log('🔍 Mock: getInventory called with filters:', filters);
  
  // Simulate some processing time for a realistic RPC call
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const endTime = performance.now();
  console.log(`📊 Mock: getInventory completed in ${(endTime - startTime).toFixed(2)}ms, returning ${LARGE_MOCK_PARAMETERS.length} parameters`);
  
  return LARGE_MOCK_PARAMETERS;
};

const originalGetStats = mockCaido.backend.getStats;
mockCaido.backend.getStats = async function() {
  console.log('📈 Mock: getStats called');
  const domains = new Set(LARGE_MOCK_PARAMETERS.map(p => p.domain));
  const totalRequests = LARGE_MOCK_PARAMETERS.reduce((s, p) => s + p.count, 0);
  return {
    totalRequests,
    uniqueParams: LARGE_MOCK_PARAMETERS.length,
    domains: domains.size,
  };
};

// Track RPC calls
let rpcCallCount = 0;
let batchEventCount = 0;

const originalOnEvent = mockCaido.backend.onEvent;
mockCaido.backend.onEvent = function(event, callback) {
  console.log(`🎧 Mock: Registering event listener for "${event}"`);
  
  const result = originalOnEvent.call(this, event, callback);
  
  // Simulate high-frequency batch events for testing
  if (event === 'inventory-batch') {
    // Start a simulation of continuous batch updates
    const simulationInterval = setInterval(() => {
      if (batchEventCount >= 20) { // Stop after 20 batches
        clearInterval(simulationInterval);
        console.log('🛑 Batch event simulation completed');
        return;
      }
      
      // Create a batch of updated parameters
      const batchSize = Math.floor(Math.random() * 10) + 1; // 1-10 parameters per batch
      const batch = [];
      
      for (let i = 0; i < batchSize; i++) {
        const randomIndex = Math.floor(Math.random() * LARGE_MOCK_PARAMETERS.length);
        const param = { ...LARGE_MOCK_PARAMETERS[randomIndex] };
        param.count += 1;
        param.lastSeen = new Date();
        
        // Occasionally add NEW flag
        if (Math.random() < 0.1) {
          param.flags = [...param.flags, Flag.NEW];
        }
        
        batch.push(param);
        
        // Update the source data
        LARGE_MOCK_PARAMETERS[randomIndex] = param;
      }
      
      batchEventCount++;
      const startTime = performance.now();
      
      callback(batch);
      
      const endTime = performance.now();
      console.log(`📦 Batch ${batchEventCount}: Sent ${batch.length} parameters (processed in ${(endTime - startTime).toFixed(2)}ms)`);
      
      // Verify we're NOT triggering full RPC refetch
      if (batchEventCount % 5 === 0) {
        console.log(`📊 Performance Check: After ${batchEventCount} batches, RPC call count: ${rpcCallCount}`);
      }
    }, 200); // Send batch every 200ms to simulate high load
  }
  
  return result;
};

// Wrap getInventory to count RPC calls
const wrappedGetInventory = mockCaido.backend.getInventory;
mockCaido.backend.getInventory = async function(...args) {
  rpcCallCount++;
  console.log(`🔄 RPC Call #${rpcCallCount}: getInventory(...)`);
  return await wrappedGetInventory.apply(this, args);
};

// Performance monitoring functions
export function startPerformanceMonitoring() {
  console.log('🚀 Starting performance monitoring...');
  console.log(`📋 Dataset size: ${LARGE_MOCK_PARAMETERS.length} parameters`);
  
  let frameCount = 0;
  let lastFrameTime = performance.now();
  
  function measureFrameRate() {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastFrameTime >= 1000) { // Every second
      const fps = frameCount;
      frameCount = 0;
      lastFrameTime = currentTime;
      
      console.log(`📊 Performance: ~${fps} FPS, RPC calls: ${rpcCallCount}, Batch events: ${batchEventCount}`);
    }
    
    requestAnimationFrame(measureFrameRate);
  }
  
  requestAnimationFrame(measureFrameRate);
}

// Test interaction responsiveness
export function testInteractionLatency() {
  console.log('🖱️  Testing interaction latency...');
  
  return {
    simulateSearch: (query) => {
      const startTime = performance.now();
      console.log(`🔍 Simulating search for: "${query}"`);
      
      // Simulate filtering the large dataset
      const filtered = LARGE_MOCK_PARAMETERS.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.domain.toLowerCase().includes(query.toLowerCase())
      );
      
      const endTime = performance.now();
      console.log(`📊 Search completed in ${(endTime - startTime).toFixed(2)}ms, found ${filtered.length} matches`);
      return filtered;
    },
    
    simulateScrolling: () => {
      const startTime = performance.now();
      console.log('📜 Simulating scroll through large dataset...');
      
      // Simulate processing visible rows (virtualization test)
      const visibleRows = 50; // Simulate 50 visible rows
      const randomStart = Math.floor(Math.random() * (LARGE_MOCK_PARAMETERS.length - visibleRows));
      const visibleData = LARGE_MOCK_PARAMETERS.slice(randomStart, randomStart + visibleRows);
      
      const endTime = performance.now();
      console.log(`📊 Scroll simulation completed in ${(endTime - startTime).toFixed(2)}ms, rendered ${visibleData.length} rows`);
      return visibleData;
    }
  };
}

// Generate reports
export function generatePerformanceReport() {
  console.log('\n📋 PERFORMANCE REPORT');
  console.log('===================');
  console.log(`Dataset Size: ${LARGE_MOCK_PARAMETERS.length} parameters`);
  console.log(`Total RPC Calls: ${rpcCallCount}`);
  console.log(`Batch Events Processed: ${batchEventCount}`);
  console.log(`Domains: ${new Set(LARGE_MOCK_PARAMETERS.map(p => p.domain)).size}`);
  
  const rpcRatio = batchEventCount > 0 ? (rpcCallCount / batchEventCount).toFixed(2) : 'N/A';
  console.log(`RPC/Batch Ratio: ${rpcRatio} (should be close to 0 for good performance)`);
  
  if (rpcCallCount <= 2) { // Allow initial load + maybe one refresh
    console.log('✅ PASS: Minimal RPC calls - batch updates working correctly');
  } else {
    console.log('❌ FAIL: Too many RPC calls - check if full refetch is happening on each batch');
  }
  
  return {
    datasetSize: LARGE_MOCK_PARAMETERS.length,
    rpcCalls: rpcCallCount,
    batchEvents: batchEventCount,
    rpcRatio: parseFloat(rpcRatio) || 0
  };
}

console.log('✅ Performance testing module loaded');
console.log('📚 Available functions: startPerformanceMonitoring(), testInteractionLatency(), generatePerformanceReport()');

export { mockCaido };
export default {
  mockCaido,
  startPerformanceMonitoring,
  testInteractionLatency,
  generatePerformanceReport,
  LARGE_MOCK_PARAMETERS
};