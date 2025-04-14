import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { campaignRoutes } from './routes/campaigns';
import { zoneRoutes } from './routes/zones';
import { statRoutes } from './routes/stats';
import { apiKeyAuthHook } from './middleware/auth';

// Import our type definitions
import './types/fastify';

// Environment interface for D1
interface Env {
  DB: D1Database;
}

/**
 * Create and configure the Fastify server instance
 * @param env Optional environment containing D1 database
 */
export function createServer(env?: Env): FastifyInstance {
  const server = fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true,
      },
    },
  });
  
  // Register the D1 database if provided
  if (env?.DB) {
    server.decorate('d1Env', env);
  }
  
  // Register plugins
  server.register(cors, {
    origin: process.env['NODE_ENV'] === 'production' 
      ? process.env['ALLOWED_ORIGINS']?.split(',') || false
      : true,
  });
  
  // Create API routes with authentication
  server.register(
    async (apiRouter) => {
      // Add authentication to all API routes
      apiRouter.addHook('onRequest', apiKeyAuthHook());
      
      // Register API routes
      apiRouter.register(campaignRoutes, { prefix: '/campaigns' });
      apiRouter.register(zoneRoutes, { prefix: '/zones' });
      apiRouter.register(statRoutes, { prefix: '/stats' });
    },
    { prefix: '/api' }
  );
  
  // Health check route (no authentication)
  server.get('/health', async () => {
    return { status: 'ok' };
  });

  return server;
}

/**
 * Start the server if this file is run directly
 */
if (require.main === module) {
  const server = createServer();
  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;
  
  server.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
  });
} 