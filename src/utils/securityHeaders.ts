/**
 * Security headers and CORS utilities for the ad server
 */

import type { Env } from '../models/interfaces';

// Security headers to apply to all responses
export const SECURITY_HEADERS = {
  'Content-Security-Policy': 
    "default-src 'self'; script-src 'self'; object-src 'none'; upgrade-insecure-requests;",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Apply security headers and CORS headers to a response
 */
export function applySecurityHeaders(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  
  // Add all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // Parse allowed origins from environment variable or use default
  const allowedOriginsStr = env.ALLOWED_ORIGINS ?? '';
  const allowedOrigins = allowedOriginsStr.split(',').map(origin => origin.trim());
  
  // Handle CORS headers
  const origin = request.headers.get('Origin');
  if (origin) {
    // If the origin is in our allowed list, or if ALLOWED_ORIGINS is empty or undefined
    if (allowedOrigins.includes(origin) || allowedOriginsStr === '') {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Namespace');
      headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    }
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
} 