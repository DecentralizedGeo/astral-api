import { locationProofResolvers } from './locationProofResolvers';
import { jsonScalar } from './scalarResolvers';

/**
 * Combine all resolvers into a single object for the Apollo Server
 */
export const resolvers = {
  // Merge Query resolvers
  Query: {
    ...locationProofResolvers.Query
  },
  
  // No mutations - API is read-only
  
  // Scalar resolvers
  JSON: jsonScalar
};

export default resolvers;