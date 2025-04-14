import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { campaignRoutes } from './routes/campaigns';
import { zoneRoutes } from './routes/zones';
import { statRoutes } from './routes/stats';

/**
 * Create and configure the Fastify server instance
 */
export function createServer(): FastifyInstance {
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
  
  // Register plugins
  server.register(cors, {
    origin: true, // Reflects the request origin. Set to specific origins in production
  });
  
  // Register routes
  server.register(campaignRoutes, { prefix: '/api/campaigns' });
  server.register(zoneRoutes, { prefix: '/api/zones' });
  server.register(statRoutes, { prefix: '/api/stats' });
  
  // Health check route
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