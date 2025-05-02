# Security and CORS Configuration

This document provides detailed information about the security features and CORS configuration implemented in the Lite Ad Server.

## Authentication and Authorization

### Multi-tenant API Access

The Lite Ad Server implements a multi-tenant authentication system that uses API keys to control access to resources.

#### API Key Structure

API keys are structured as follows:
- `token`: A unique identifier for the API key (e.g., UUID format)
- `namespace`: The tenant or namespace this key belongs to
- `created_at`: Timestamp of when the key was created
- `expires_at`: Optional timestamp for key expiration
- `permissions`: Array of permission strings (e.g., ["read", "write"])

#### API Key Storage

API keys are stored in KV with the following structure:
- Key: `api_key:{token}`
- Value: JSON object containing namespace, timestamps, and permissions

### Managing API Keys

The API provides endpoints to manage API keys. These endpoints are restricted to admin users only and require the system's main API key for authentication.

#### Admin Authentication

To access the API key management endpoints, use:
```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

Where `YOUR_ADMIN_API_KEY` matches the value set in the `API_KEY` environment variable.

#### List API Keys
```
GET /api/api-keys
```

This endpoint returns all available API keys.

#### Create API Key
```
POST /api/api-keys
```

This endpoint creates a new API key. Required fields:
- `token`: Unique token for the API key
- `namespace`: The namespace/tenant for this key
- `permissions`: Array of permission strings
- `expires_at`: Optional expiration timestamp

The server automatically sets the `created_at` timestamp.

## Security Headers

The Lite Ad Server implements a comprehensive set of security headers to protect against common web vulnerabilities:

### Content-Security-Policy (CSP)

```
default-src 'self'; script-src 'self'; object-src 'none'; upgrade-insecure-requests;
```

This policy:
- Restricts resources to load only from the same origin (`'self'`)
- Restricts JavaScript to load only from the same origin
- Blocks all plugins through `object-src 'none'`
- Upgrades HTTP requests to HTTPS

### HTTP Strict Transport Security (HSTS)

```
max-age=63072000; includeSubDomains; preload
```

This header:
- Enforces HTTPS connections for 2 years (63072000 seconds)
- Applies to all subdomains
- Indicates that the site is eligible for HSTS preloading in browsers

### X-Content-Type-Options

```
nosniff
```

Prevents browsers from MIME-sniffing, forcing them to honor the declared content type.

### X-Frame-Options

```
DENY
```

Prevents the page from being displayed in an iframe, which protects against clickjacking attacks.

### Referrer-Policy

```
strict-origin-when-cross-origin
```

Limits the amount of information sent in the Referer header when navigating cross-origin.

### Permissions-Policy

```
camera=(), microphone=(), geolocation=()
```

Restricts the use of browser features like camera, microphone, and geolocation.

## CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured to allow controlled access from specific origins:

### Allowed Origins

The `ALLOWED_ORIGINS` environment variable contains a comma-separated list of origins that are allowed to access the API. For example:

```
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

If this variable is empty, CORS will be applied more permissively for development purposes.

### CORS Headers

When a valid origin is detected, the following CORS headers are applied:

- `Access-Control-Allow-Origin`: Set to the requesting origin if it's in the allowed list
- `Access-Control-Allow-Methods`: Set to "GET, POST, PUT, DELETE, OPTIONS"
- `Access-Control-Allow-Headers`: Set to "Content-Type, Authorization"
- `Access-Control-Max-Age`: Set to 86400 seconds (24 hours)

### Preflight Requests

OPTIONS requests are handled automatically as CORS preflight requests, returning a 204 No Content response with the appropriate CORS headers.

## Environment-specific Configuration

The CORS configuration is environment-specific, with different settings for development, staging, and production:

### Development

```toml
[env.development]
vars = {
  ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:8080,http://localhost:8788,http://127.0.0.1:3000"
}
```

More permissive to facilitate local development.

### Staging

```toml
[env.staging]
vars = { 
  ALLOWED_ORIGINS = "https://staging.yourdomain.com,https://admin.staging.yourdomain.com"
}
```

Configured for staging domains.

### Production

```toml
[env.production]
vars = { 
  ALLOWED_ORIGINS = "https://yourdomain.com,https://admin.yourdomain.com"
}
```

Strictly limited to production domains for maximum security.

## Best Practices

1. **Keep the allowed origins list minimal**: Only include domains that genuinely need access.
2. **Use HTTPS everywhere**: All production domains should use HTTPS.
3. **Review security headers regularly**: Update as new security features become available.
4. **Test CORS configuration**: Ensure proper functionality across environments.
5. **Monitor for unauthorized access attempts**: Review logs for potential security issues.

## Customizing Security Settings

To modify the security headers or CORS configuration:

1. Edit the `SECURITY_HEADERS` constant in `src/workers/index.ts`
2. Modify the `applySecurityHeaders` function to change CORS behavior
3. Update the `ALLOWED_ORIGINS` variable in `wrangler.toml` for different environments 