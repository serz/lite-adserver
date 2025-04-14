import { FastifyRequest, FastifyReply } from 'fastify';

interface AuthHeader {
  authorization?: string;
}

/**
 * API key authentication middleware
 * 
 * Validates that requests include a valid API key in the Authorization header
 */
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  const { authorization } = request.headers as AuthHeader;
  
  // Check if authorization header exists
  if (!authorization) {
    reply.code(401).send({ error: 'API key required' });
    return;
  }
  
  // Check if it's a Bearer token
  if (!authorization.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Invalid authorization format. Use Bearer token.' });
    return;
  }
  
  // Extract the API key
  const apiKey = authorization.substring(7);
  
  // For now, we'll use a hardcoded key for demonstration purposes
  const validApiKey = process.env['API_KEY'] || 'test-api-key-1234567890';
  
  if (apiKey !== validApiKey) {
    reply.code(401).send({ error: 'Invalid API key' });
    return;
  }
}

/**
 * API key authentication hook factory
 * 
 * Returns a hook that can be registered with Fastify
 */
export function apiKeyAuthHook() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await apiKeyAuth(request, reply);
  };
} 