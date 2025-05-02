/**
 * Authentication utility functions
 */

import type { Env } from '../models/interfaces';

/**
 * Extract namespace from request headers
 */
export function extractNamespace(request: Request): string | null {
  return request.headers.get('X-Namespace');
}

/**
 * Check if the request has valid authorization
 * This is a sync version that always returns false for namespace validation since it requires async KV access
 */
export function hasValidAuthorization(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  
  // No auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  // Sync version can't validate against KV, so always return false
  // Use hasValidAuthorizationAsync instead
  return false;
}

/**
 * Async version of authorization check that validates against KV store
 * This checks that the token exists in KV and matches the namespace in the request header
 */
export async function hasValidAuthorizationAsync(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  
  // No auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  
  // Get namespace from header
  const namespace = request.headers.get('X-Namespace');
  if (!namespace) {
    return false; // No namespace provided
  }
  
  try {
    // Look up the token in KV store
    const kvKey = `api_key:${token}`;
    const rawValue = await env.campaigns_zones.get(kvKey, 'json');
    
    // Token not found in KV store
    if (!rawValue) {
      return false;
    }
    
    // Type guard to ensure we have a proper ApiKeyValue
    const apiKeyValue = rawValue as Record<string, unknown>;
    
    // Check if the token is expired
    const now = Date.now();
    const expiresAt = apiKeyValue['expires_at'] as number | undefined;
    if (expiresAt && expiresAt < now) {
      return false;
    }
    
    // Check if the namespace matches
    return apiKeyValue['namespace'] === namespace;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
} 