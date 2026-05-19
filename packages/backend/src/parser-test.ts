/**
 * Simple test cases for the parser implementation
 */

import { RequestParser } from './parser.js';
import type { Request, Body } from './caido-sdk-mock.js';

// Mock Body implementation
class MockBody implements Body {
  constructor(private content: string) {}

  async toText(): Promise<string> {
    return this.content;
  }

  async toJson(): Promise<any> {
    return JSON.parse(this.content);
  }

  async toRaw(): Promise<Uint8Array> {
    return new TextEncoder().encode(this.content);
  }
}

// Mock Request implementation
class MockRequest implements Request {
  constructor(
    private id: string,
    private host: string,
    private method: string,
    private path: string,
    private query: string,
    private headers: Record<string, string>,
    private body: Body | null = null
  ) {}

  getId(): string { return this.id; }
  getHost(): string { return this.host; }
  getPort(): number { return 443; }
  getMethod(): string { return this.method; }
  getPath(): string { return this.path; }
  getQuery(): string { return this.query; }
  getHeaders(): Record<string, string> { return this.headers; }
  getBody(): Body | null { return this.body; }
  getCreatedAt(): number { return Date.now(); }
  getTls(): boolean { return true; }
}

// Test cases
async function runTests() {
  console.log('🧪 Running parser tests...\n');

  // Create parser instance
  const parser = new RequestParser();

  // Test 1: Query parameters
  const queryRequest = new MockRequest(
    '1',
    'api.example.com',
    'GET',
    '/api/users',
    'page=1&limit=10&search=john&active=true',
    { 'User-Agent': 'test-agent', 'Authorization': 'Bearer token123' }
  );

  const queryResult = parser.parseRequest(queryRequest);
  console.log('✅ Query test:', {
    domain: queryResult.domain,
    method: queryResult.method,
    path: queryResult.path,
    paramCount: queryResult.parameters.length,
    queryParams: queryResult.parameters.filter(p => p.location === 'query'),
    headerParams: queryResult.parameters.filter(p => p.location === 'header')
  });

  // Test 2: Path parameters
  const pathRequest = new MockRequest(
    '2',
    'api.example.com',
    'GET',
    '/api/users/123/profile/abc-def-456',
    '',
    {}
  );

  const pathResult = parser.parseRequest(pathRequest);
  console.log('✅ Path test:', {
    domain: pathResult.domain,
    pathParams: pathResult.parameters.filter(p => p.location === 'path')
  });

  // Test 3: JSON body
  const jsonBody = new MockBody(
    JSON.stringify({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          age: 30,
          preferences: ['dark-mode', 'notifications']
        }
      },
      metadata: {
        timestamp: 1640995200000,
        source: 'web'
      }
    })
  );

  const jsonRequest = new MockRequest(
    '3',
    'api.example.com',
    'POST',
    '/api/users',
    '',
    { 'content-type': 'application/json' },
    jsonBody
  );

  const jsonResult = parser.parseRequest(jsonRequest);
  console.log('✅ JSON test:', {
    domain: jsonResult.domain,
    jsonParams: jsonResult.parameters.filter(p => p.location === 'json').map(p => ({
      name: p.name,
      value: p.value,
      contextPath: p.contextPath
    }))
  });

  // Test 4: Form data
  const formBody = new MockBody(
    'username=johndoe&password=secret123&remember=on&redirect=/dashboard'
  );

  const formRequest = new MockRequest(
    '4',
    'example.com',
    'POST',
    '/login',
    '',
    { 
      'content-type': 'application/x-www-form-urlencoded',
      'cookie': 'session_id=abc123; theme=dark; lang=en'
    },
    formBody
  );

  const formResult = parser.parseRequest(formRequest);
  console.log('✅ Form test:', {
    domain: formResult.domain,
    formParams: formResult.parameters.filter(p => p.location === 'form'),
    cookieParams: formResult.parameters.filter(p => p.location === 'cookie')
  });

  console.log('\n🎉 All parser tests completed successfully!');
}

// Run the tests if this file is executed directly  
// Note: In a real Node.js environment, you could check import.meta.url
runTests().catch(console.error);

export { runTests };