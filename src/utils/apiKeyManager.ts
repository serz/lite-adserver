/**
 * API Key management utilities for namespace-based authentication
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
 * Create a new API key for a namespace
 */
export async function createApiKey(
  env: Env, 
  namespace: string, 
  permissions: string[] = ['read', 'write'], 
  expiresInDays?: number
): Promise<{ token: string; details: ApiKeyValue }> {
  // Generate a UUID v4 token with a namespace prefix
  const token = `${namespace}-${generateUUID()}`;
  
  // Create the API key value
  const apiKeyValue: ApiKeyValue = {
    namespace,
    created_at: Date.now(),
    permissions
  };
  
  // Add expiration if specified
  if (expiresInDays) {
    const expiresInMs = expiresInDays * 24 * 60 * 60 * 1000;
    apiKeyValue.expires_at = Date.now() + expiresInMs;
  }
  
  // Store in KV
  const kvKey = `api_key:${token}`;
  await env.campaigns_zones.put(kvKey, JSON.stringify(apiKeyValue));
  
  return {
    token,
    details: apiKeyValue
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(env: Env, token: string): Promise<boolean> {
  try {
    const kvKey = `api_key:${token}`;
    await env.campaigns_zones.delete(kvKey);
    return true;
  } catch (error) {
    console.error('Error revoking API key:', error);
    return false;
  }
}

/**
 * List all API keys for a namespace
 */
export async function listApiKeys(env: Env, namespace: string): Promise<string[]> {
  // Note: This is a naive implementation that requires listing all keys
  // In a production environment, you would want to use a more efficient approach
  // such as storing a list of keys by namespace
  try {
    const keys = await env.campaigns_zones.list({ prefix: 'api_key:' });
    const apiKeys: string[] = [];
    
    for (const key of keys.keys) {
      const token = key.name.replace('api_key:', '');
      const value = await env.campaigns_zones.get(key.name, 'json') as ApiKeyValue;
      
      if (value && value.namespace === namespace) {
        apiKeys.push(token);
      }
    }
    
    return apiKeys;
  } catch (error) {
    console.error('Error listing API keys:', error);
    return [];
  }
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
} 