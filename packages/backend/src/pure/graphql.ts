import type { ParsedParameter } from '@param-logger/shared';
import { ParameterLocation } from '@param-logger/shared';
import { flattenObject, valueToString } from './flatten.js';

/**
 * Check if a JSON object is a GraphQL request
 */
export function isGraphQL(json: any): boolean {
  return typeof json?.query === 'string' &&
    /^\s*(query|mutation|subscription)[\s({]/.test(json.query);
}

/**
 * Extract field names from GraphQL query string using lightweight regex
 */
export function extractGraphQLFieldNames(query: string): string[] {
  const fieldNames: string[] = [];

  try {
    // Remove comments, strings, and normalize whitespace
    const cleanQuery = query
      .replace(/#.*$/gm, '')  // Remove comments
      .replace(/"[^"]*"/g, '""')  // Replace string literals
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    // Find selection sets (content between { and })
    const selectionSetMatches = cleanQuery.match(/\{[^{}]*\}/g);

    if (selectionSetMatches) {
      for (const selectionSet of selectionSetMatches) {
        // Extract field names from selection set
        const content = selectionSet.slice(1, -1).trim(); // Remove { and }
        const fields = content.split(/[,\s]+/).filter(field => field.length > 0);

        for (const field of fields) {
          // Extract just the field name (before any arguments or aliases)
          const fieldMatch = field.match(/^(\w+)/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            if (!fieldNames.includes(fieldName)) {
              fieldNames.push(fieldName);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting GraphQL field names:', error);
  }

  return fieldNames;
}

/**
 * Parse GraphQL body and extract operation name, field names, and variables
 */
export function parseGraphQLBody(json: any): ParsedParameter[] {
  const parameters: ParsedParameter[] = [];

  try {
    // Extract operation name if present
    if (json.operationName && typeof json.operationName === 'string') {
      parameters.push({
        location: ParameterLocation.GRAPHQL,
        name: 'operationName',
        value: json.operationName,
      });
    }

    // Extract field names from the query using regex
    if (json.query && typeof json.query === 'string') {
      const fieldNames = extractGraphQLFieldNames(json.query);
      for (const fieldName of fieldNames) {
        parameters.push({
          location: ParameterLocation.GRAPHQL,
          name: `field.${fieldName}`,
          value: fieldName,
        });
      }
    }

    // Extract variables if present
    if (json.variables && typeof json.variables === 'object') {
      const flattenedVariables = flattenObject(json.variables, 'variables');
      for (const [name, value] of Object.entries(flattenedVariables)) {
        parameters.push({
          location: ParameterLocation.GRAPHQL,
          name,
          value: valueToString(value),
        });
      }
    }
  } catch (error) {
    console.error('Error parsing GraphQL body:', error);
  }

  return parameters;
}
