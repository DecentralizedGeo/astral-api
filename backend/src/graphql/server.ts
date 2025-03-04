import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { json } from 'express';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { supabaseService } from '../services/supabase.service';
import { logger } from '../utils/logger';
import { GraphQLContext } from './types';

/**
 * Set up Apollo Server and attach it to the Express app
 * @param app Express application instance
 * @returns Apollo Server instance
 */
export async function setupApolloServer(app: any): Promise<ApolloServer<GraphQLContext>> {
  try {
    // Create the Apollo Server
    const server = new ApolloServer<GraphQLContext>({
      typeDefs,
      resolvers,
      // Enable introspection for tools like Apollo Explorer
      introspection: true,
      // Configure formatting of error messages
      formatError: (error) => {
        // Log errors internally but return cleaner error to clients
        logger.error('GraphQL Error:', error);
        
        return {
          message: error.message,
          // Only expose locations and path in development
          locations: process.env.NODE_ENV === 'development' ? error.locations : undefined,
          path: process.env.NODE_ENV === 'development' ? error.path : undefined,
        };
      }
    });
    
    // Start the Apollo Server
    await server.start();
    
    // Add middleware to Express
    app.use(
      '/graphql',
      json(),
      expressMiddleware(server, {
        context: async ({ req }) => ({
          // Pass Supabase service to the resolvers via context
          dataSources: {
            supabaseService
          }
        })
      })
    );
    
    logger.info('Apollo GraphQL server initialized at /graphql endpoint');
    
    return server;
  } catch (error) {
    logger.error('Failed to initialize Apollo GraphQL server:', error);
    throw error;
  }
}