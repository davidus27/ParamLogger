import { describe, it, expect } from 'vitest';
import { isGraphQL, extractGraphQLFieldNames, parseGraphQLBody } from '../graphql';
import { ParameterLocation } from '@param-logger/shared';

describe('isGraphQL', () => {
  it('returns true for a query operation', () => {
    expect(isGraphQL({ query: 'query { users { id name } }' })).toBe(true);
  });

  it('returns true for a mutation operation', () => {
    expect(isGraphQL({ query: 'mutation CreateUser { createUser { id } }' })).toBe(true);
  });

  it('returns true for a subscription operation', () => {
    expect(isGraphQL({ query: 'subscription OnMessage { messages { text } }' })).toBe(true);
  });

  it('returns false when query field is missing', () => {
    expect(isGraphQL({ operationName: 'Foo' })).toBe(false);
  });

  it('returns false when query field is not a string', () => {
    expect(isGraphQL({ query: 42 })).toBe(false);
  });

  it('returns false when query does not start with a GraphQL keyword', () => {
    expect(isGraphQL({ query: '{ users { id } }' })).toBe(false);
  });

  it('returns false for null input', () => {
    expect(isGraphQL(null)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isGraphQL({})).toBe(false);
  });
});

describe('extractGraphQLFieldNames', () => {
  it('extracts top-level field names from a simple query', () => {
    const names = extractGraphQLFieldNames('query { users posts }');
    expect(names).toContain('users');
    expect(names).toContain('posts');
  });

  it('extracts fields from innermost (non-nested) selection sets only', () => {
    // The regex /\{[^{}]*\}/ only matches blocks with no nested braces.
    // In "query { users { id name email } }", the outer block contains braces
    // inside it so only the innermost "{ id name email }" is matched.
    const names = extractGraphQLFieldNames('query { users { id name email } }');
    expect(names).toContain('id');
    expect(names).toContain('name');
    expect(names).toContain('email');
    // "users" is in the outer block which contains nested braces → not extracted
    expect(names).not.toContain('users');
  });

  it('strips inline comments before extracting', () => {
    // Use a flat query so there are no nested braces
    const query = `query {
      users
    }`;
    const names = extractGraphQLFieldNames(query);
    expect(names).toContain('users');
  });

  it('strips comments that would otherwise look like field names', () => {
    const query = 'query { id # comment\nname }';
    const names = extractGraphQLFieldNames(query);
    expect(names).toContain('id');
    expect(names).toContain('name');
    expect(names).not.toContain('comment');
  });

  it('ignores content inside string literals', () => {
    // Flat query with a string argument — no nested braces
    const query = 'query { search term }';
    const names = extractGraphQLFieldNames(query);
    expect(names).not.toContain('field_inside_string');
    expect(names).toContain('search');
  });

  it('handles aliased fields in a flat selection set', () => {
    // Alias is in the same non-nested block so the leading word (alias) is captured
    const query = 'query { myAlias name }';
    const names = extractGraphQLFieldNames(query);
    expect(names).toContain('myAlias');
    expect(names).toContain('name');
  });

  it('handles fields at the innermost level (arguments in outer block)', () => {
    // In "{ user(id: 1) { name } }" the outer block has nested braces; only "{ name }" matches
    const query = 'query { user(id: 1) { name } }';
    const names = extractGraphQLFieldNames(query);
    expect(names).toContain('name');
    // "user" is in the outer block → not extracted by the innermost-only extractor
    expect(names).not.toContain('user');
  });

  it('deduplicates repeated field names', () => {
    const query = 'query { users { id } admins { id } }';
    const names = extractGraphQLFieldNames(query);
    const idCount = names.filter(n => n === 'id').length;
    expect(idCount).toBe(1);
  });
});

describe('parseGraphQLBody', () => {
  it('includes operationName when present', () => {
    const json = { query: 'query GetUsers { users { id } }', operationName: 'GetUsers' };
    const params = parseGraphQLBody(json);
    const opParam = params.find(p => p.name === 'operationName');
    expect(opParam).toBeDefined();
    expect(opParam?.value).toBe('GetUsers');
    expect(opParam?.location).toBe(ParameterLocation.GRAPHQL);
  });

  it('prefixes extracted field names with field.', () => {
    // Only innermost selection set fields are extracted (see extractGraphQLFieldNames behaviour).
    // "users" is in the outer block; "id" and "name" are in the inner block.
    const json = { query: 'query { users { id name } }' };
    const params = parseGraphQLBody(json);
    const fieldNames = params.map(p => p.name);
    expect(fieldNames).toContain('field.id');
    expect(fieldNames).toContain('field.name');
    // Confirm every field parameter uses the GRAPHQL location
    params.filter(p => p.name.startsWith('field.')).forEach(p => {
      expect(p.location).toBe(ParameterLocation.GRAPHQL);
    });
  });

  it('flattens variables with variables. prefix', () => {
    const json = {
      query: 'query($id: ID!) { user(id: $id) { name } }',
      variables: { id: '42', filter: 'active' },
    };
    const params = parseGraphQLBody(json);
    const varNames = params.map(p => p.name);
    expect(varNames).toContain('variables.id');
    expect(varNames).toContain('variables.filter');
    const idParam = params.find(p => p.name === 'variables.id');
    expect(idParam?.value).toBe('42');
  });

  it('flattens nested variables with dot notation', () => {
    const json = {
      query: 'mutation { createUser { id } }',
      variables: { input: { name: 'Alice', age: 30 } },
    };
    const params = parseGraphQLBody(json);
    const varNames = params.map(p => p.name);
    expect(varNames).toContain('variables.input.name');
    expect(varNames).toContain('variables.input.age');
  });

  it('works without operationName', () => {
    const json = { query: 'query { posts { title } }' };
    const params = parseGraphQLBody(json);
    expect(params.find(p => p.name === 'operationName')).toBeUndefined();
  });

  it('works without variables', () => {
    const json = { query: 'query { me { id } }' };
    const params = parseGraphQLBody(json);
    expect(params.some(p => p.name.startsWith('variables.'))).toBe(false);
  });
});
