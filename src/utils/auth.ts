/**
 * Authentication utility functions
 */

import type { Env } from '../workers/index';

/**
 * Check if the request has valid authorization
 */
export function hasValidAuthorization(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  const apiKey = env.API_KEY ?? 'test-api-key-1234567890';
  
  return !!authHeader && authHeader.startsWith('Bearer ') && authHeader.substring(7) === apiKey;
} 