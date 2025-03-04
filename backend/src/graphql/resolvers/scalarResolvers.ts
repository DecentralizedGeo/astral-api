import { GraphQLScalarType, Kind } from 'graphql';

/**
 * Custom scalar resolver for JSON data
 * Supports serialization and parsing of JSON values
 */
export const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'The `JSON` scalar type represents JSON values as specified by ECMA-404',
  
  // Convert outgoing JSON value to proper format
  serialize(value) {
    return value; // Value sent to the client
  },
  
  // Parse incoming JSON value from variables
  parseValue(value) {
    return value; // Value from the client input variables
  },
  
  // Parse JSON value from AST in query
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value);
      } catch (error) {
        return null;
      }
    }
    
    // Handle object and array literals directly
    if (ast.kind === Kind.OBJECT) {
      return parseObject(ast);
    }
    
    if (ast.kind === Kind.LIST) {
      return parseList(ast);
    }
    
    // Handle primitive values
    if (ast.kind === Kind.INT) {
      return parseInt(ast.value, 10);
    }
    
    if (ast.kind === Kind.FLOAT) {
      return parseFloat(ast.value);
    }
    
    if (ast.kind === Kind.BOOLEAN) {
      return ast.value;
    }
    
    if (ast.kind === Kind.NULL) {
      return null;
    }
    
    return null;
  }
});

/**
 * Helper function to parse object literals
 */
function parseObject(ast: any) {
  const value = Object.create(null);
  ast.fields.forEach((field: any) => {
    value[field.name.value] = parseLiteral(field.value);
  });
  return value;
}

/**
 * Helper function to parse array literals
 */
function parseList(ast: any) {
  return ast.values.map(parseLiteral);
}

/**
 * Helper function to parse literals
 */
function parseLiteral(ast: any) {
  switch (ast.kind) {
    case Kind.STRING:
      return ast.value;
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.OBJECT:
      return parseObject(ast);
    case Kind.LIST:
      return parseList(ast);
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}