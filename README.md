# Lite Ad Server

A scalable, cost-efficient ad serving solution built on Cloudflare's edge infrastructure.

<p align="center">
  <img src="docs/images/light-adserver-hero.png" alt="Ad Server Banner" width="70%" />
</p>

## Overview

Lite Ad Server is designed to serve ads at high speed globally while maintaining low operational costs. It leverages Cloudflare Workers for edge computing, D1 for database storage, and targeting rules for ad selection. The initial version focuses on redirect-based campaigns rather than serving HTML creatives.

## Key Features

- **⚡ High-Performance Ad Serving**: Serve redirect ads from the edge with minimal latency
- **🎯 Flexible Targeting**: Target ads based on geo, device type, os, browser and zones
- **🔄 Traffic Back URLs**: Configure fallback URLs when no campaigns match
- **🧰 Campaign Management**: Create, update, and manage redirect-based ad campaigns
- **🚧 Zone Configuration**: Define ad placements across your sites
- **📊 Detailed Click Tracking**: Track and analyze clicks with geo and device information
- **🔒 Frequency Capping**: Control how often users see specific ads
- **🔌 Simple Admin API**: RESTful API for integration with dashboards

## Documentation

- [Installation Guide](docs/Installation.md) - Step-by-step setup instructions
- [Architecture Documentation](docs/Architecture.md) - Technical design and project structure
- [API Documentation](docs/api.md) - API endpoints, authentication, and usage

## Usage

### Serving Ads

To serve an ad, make a request to:

```
GET /serve/:zoneId
```

The server will select an appropriate campaign based on targeting rules and redirect to a tracking URL.

### Tracking Clicks

Clicks are tracked and recorded before redirecting to the campaign URL:

```
GET /track/click/:campaignId/:zoneId
```

### Admin API

The Admin API provides endpoints for campaign and zone management through Cloudflare Workers. All API endpoints require authentication using an API key in the `Authorization` header (Bearer token format).

```
Authorization: Bearer your-api-key-here
```

Available API endpoints:

- **Campaigns**: `/api/campaigns` - Manage ad campaigns
- **Targeting Rule Types**: `/api/targeting-rule-types` - Get information about targeting rules
- **Zones**: `/api/zones` - Manage ad placement zones
- **Statistics**: `/api/stats` - View performance metrics

For detailed API documentation, see [API Documentation](docs/api.md).

## Current Status

The project is currently in active development. The core ad serving functionality is implemented, and the project uses a D1 database with proper schema. Click tracking is operational, and basic campaign selection based on zone targeting is working.

### Working Features

- Basic ad serving with zone targeting
- Click tracking with detailed metadata
- Proper error handling in all worker routes
- Database schema with appropriate indices
- Support for trailing slash URLs in all endpoints
- Device type detection based on user agent
- Traffic back URL fallback when no campaigns match

## Developer Guidelines

When contributing to this project, please follow these guidelines:

1. **Type Safety**: Use proper TypeScript types and avoid `any` when possible. The project has strict type checking enabled.

2. **Error Handling**: Implement try/catch blocks for all database operations and async functions.

3. **Input Validation**: Validate all input parameters before using them, particularly for user-provided inputs.

4. **Consistent ID Handling**: Follow the numeric ID approach for database operations, with proper type conversions when necessary.

5. **Code Quality**: Run `npm run check-all` before submitting any PR to ensure your code meets TypeScript and ESLint standards.

6. **Testing**: Add tests for any new functionality. Run tests with `npm test`.

7. **Documentation**: Document all new functions and endpoints with appropriate JSDoc comments.

## Implementation TODO List

### Phase 1: Core Functionality Improvements
- [x] Implement proper campaign selection algorithm
- [x] Set up proper CORS and security headers for production
- [ ] Improve device type detection with comprehensive library
- [x] Fix all remaining TypeScript strict mode warnings
- [ ] Add proper error handling for edge cases

### Phase 2: Admin API Enhancement
- [x] Connect admin API to D1 database
- [ ] Implement authentication for admin routes
- [x] Complete campaign CRUD operations
- [x] Complete zone CRUD operations
- [x] Implement proper validation for all inputs

### Phase 3: Advanced Targeting
- [ ] Complete geo-targeting implementation with region/city support
- [x] Improve device type targeting with OS version detection
- [ ] Implement frequency capping based on cookies/localStorage
- [x] Support for rule combinations (AND/OR logic)
- [ ] Add time-based targeting (day of week, time of day)

### Phase 4: Reporting and Analytics
- [x] Implement click aggregation for reporting
- [x] Create dashboard views for key metrics
- [ ] Add export functionality for reports
- [x] Implement real-time stats monitoring
- [ ] Add conversion tracking capabilities

### Phase 5: Infrastructure and Deployment
- [ ] Set up proper CI/CD pipeline
- [ ] Configure staging and production environments
- [ ] Implement database backup strategy
- [ ] Add monitoring and alerting
- [ ] Performance optimization for high-traffic scenarios

### Phase 6: Documentation and Testing
- [ ] Complete API documentation
- [ ] Create user guide for campaign management
- [ ] Document targeting rule system
- [ ] Create integration examples
- [ ] Implement comprehensive test suite

## Security and CORS Configuration

The ad server implements robust security features and CORS support to ensure secure operation in production environments:

### Security Headers

All responses include the following security headers:

- **Content-Security-Policy**: Restricts resource loading to prevent XSS attacks
- **Strict-Transport-Security**: Enforces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Controls iframe embedding
- **Referrer-Policy**: Limits referrer information
- **Permissions-Policy**: Restricts browser features

### CORS Configuration

CORS (Cross-Origin Resource Sharing) is fully configurable through environment variables:

- **ALLOWED_ORIGINS**: Comma-separated list of allowed origins for CORS requests
- Different configurations for development, staging, and production environments
- Automatic handling of preflight requests

### Configuration

CORS settings can be configured through the `ALLOWED_ORIGINS` environment variable in `wrangler.toml`:

```toml
# For production
[env.production]
vars = { 
  ALLOWED_ORIGINS = "https://yourdomain.com,https://admin.yourdomain.com"
}

# For development (more permissive)
[env.development]
vars = {
  ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:8080"
}
```

For maximum security in production, ensure you only allow specific trusted domains.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 