/**
 * Authentication utility functions
 */

import type { Env } from '../models/interfaces';

/**
 * API Key value stored in KV
 */
interface ApiKeyValue {
  namespace: string;
  created_at: number;
  expires_at?: number;
  permissions: string[];
}

/**
 * Extract namespace from request headers
 */
export function extractNamespace(request: Request): string | null {
  return request.headers.get('X-Namespace');
}

/**
 * Check if the request has valid authorization
 * This supports both the legacy API_KEY env var and the new namespace-based tokens
 */
export function hasValidAuthorization(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  
  // No auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  
  // Legacy API key validation
  const legacyApiKey = env.API_KEY ?? 'test-api-key-1234567890';
  if (token === legacyApiKey) {
    return true;
  }
  
  // New namespace-based validation
  return false; // Placeholder, will be replaced by async version
}

/**
 * Async version of authorization check that validates against KV store
 * This checks both the token and the namespace
 */
export async function hasValidAuthorizationAsync(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  
  // No auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  
  // Legacy API key validation
  const legacyApiKey = env.API_KEY ?? 'test-api-key-1234567890';
  if (token === legacyApiKey) {
    return true;
  }
  
  // New namespace-based validation
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

/**
 * Check if the request has permissions for the requested operation
 */
export async function hasPermission(request: Request, env: Env, requiredPermission: string): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  
  // No auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  
  // Legacy API key has all permissions
  const legacyApiKey = env.API_KEY ?? 'test-api-key-1234567890';
  if (token === legacyApiKey) {
    return true;
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
    
    // Check if the token has the required permission
    const permissions = apiKeyValue['permissions'] as string[] | undefined;
    if (!permissions || !Array.isArray(permissions)) {
      return false;
    }
    
    return permissions.includes(requiredPermission);
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Get API key details from KV store
 */
export async function getApiKeyDetails(token: string, env: Env): Promise<ApiKeyValue | null> {
  try {
    const kvKey = `api_key:${token}`;
    const value = await env.campaigns_zones.get(kvKey, 'json');
    
    if (!value) {
      return null;
    }
    
    // Validate that the value has the required properties of ApiKeyValue
    const apiKeyValue = value as Record<string, unknown>;
    if (
      typeof apiKeyValue['namespace'] !== 'string' ||
      typeof apiKeyValue['created_at'] !== 'number' ||
      (apiKeyValue['expires_at'] !== undefined && typeof apiKeyValue['expires_at'] !== 'number') ||
      !Array.isArray(apiKeyValue['permissions'])
    ) {
      return null;
    }
    
    return {
      namespace: apiKeyValue['namespace'],
      created_at: apiKeyValue['created_at'],
      expires_at: apiKeyValue['expires_at'],
      permissions: apiKeyValue['permissions'] as string[]
    };
  } catch (error) {
    console.error('Error fetching API key details:', error);
    return null;
  }
} 