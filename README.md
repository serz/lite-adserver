# Lite Ad Server

A scalable, cost-efficient ad serving solution built on Cloudflare's edge infrastructure.

## Overview

Lite Ad Server is designed to serve ads at high speed globally while maintaining low operational costs. It leverages Cloudflare Workers for edge computing, D1 for database storage, and targeting rules for ad selection. The initial version focuses on redirect-based campaigns rather than serving HTML creatives.

## Features

- **High-Performance Ad Serving**: Serve redirect ads from the edge with minimal latency
- **Flexible Targeting**: Target ads based on geography, device type, and zones
- **Traffic Back URLs**: Configure fallback URLs when no campaigns match
- **Campaign Management**: Create, update, and manage redirect-based ad campaigns
- **Zone Configuration**: Define ad placements across your sites
- **Detailed Click Tracking**: Track and analyze clicks with geo and device information
- **Frequency Capping**: Control how often users see specific ads
- **Simple Admin API**: RESTful API for integration with dashboards

## Architecture

- **Cloudflare Workers**: Handle ad serving logic and tracking redirects
- **Cloudflare D1**: SQL database for campaign, zone, and click data
- **Durable Objects**: Support for frequency capping and real-time statistics
- **Targeting Rules**: Flexible system for campaign targeting and selection
- **Fastify API**: Admin API for management functions

## Project Structure

```
├── migrations/             # Database migrations
├── src/
│   ├── models/             # Data models
│   │   ├── Campaign.ts     # Campaign and targeting rule models
│   │   ├── Zone.ts         # Zone configuration models
│   │   ├── Click.ts        # Click tracking models
│   │   └── TargetingRule.ts # Targeting rule type definitions
│   ├── routes/             # API route handlers
│   │   ├── campaigns.ts    # Campaign management endpoints
│   │   ├── zones.ts        # Zone management endpoints
│   │   └── stats.ts        # Statistics and reporting endpoints
│   ├── workers/            # Cloudflare Worker code
│   │   ├── index.ts        # Main worker entry point
│   │   └── counter.ts      # Durable Object for frequency capping
│   ├── server.ts           # Fastify server setup
│   └── types/              # TypeScript type definitions
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
└── wrangler.toml           # Cloudflare Workers configuration
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI installed

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/lite-adserver.git
   cd lite-adserver
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create D1 database:
   ```
   wrangler d1 create lite_adserver_db
   ```

4. Update the `wrangler.toml` file with your D1 database ID.

5. Run database migrations:
   ```
   wrangler d1 execute lite_adserver_db --file=./migrations/0000_initial_schema.sql
   ```

6. Insert sample data:
   ```
   wrangler d1 execute lite_adserver_db --local --command "INSERT INTO zones (name, site_url, traffic_back_url, status) VALUES ('Homepage Banner', 'https://example.com', 'https://example.com/fallback', 'active');"
   
   wrangler d1 execute lite_adserver_db --local --command "INSERT INTO campaigns (name, redirect_url, start_date, end_date, status) VALUES ('Summer Sale Campaign', 'https://example.com/summer-sale', unixepoch(), unixepoch() + 2592000, 'active');"
   
   wrangler d1 execute lite_adserver_db --local --command "INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, weight) VALUES (1, 4, 'whitelist', '1', 100);"
   ```

### Development

Start the local development server:

```
npm run dev
```

### Type Checking and Code Quality

The project uses TypeScript with strict type checking enabled. We've added several tools to ensure code quality:

1. **TypeScript Strict Mode**: The `tsconfig.json` is configured with strict type checking enabled.

2. **Type Checking Script**: Run type checking without compilation:
   ```
   npm run type-check
   ```

3. **ESLint Integration**: Check for code quality and potential issues:
   ```
   npm run lint
   ```

4. **Combined Check**: Run all checks (type, lint, tests) with one command:
   ```
   npm run check-all
   ```

5. **Pre-deployment Checks**: Type checking and linting automatically run before deployment:
   ```
   npm run deploy
   ```

Always run `npm run check-all` before submitting a pull request to ensure your code meets the project's quality standards.

### Testing Ad Serving

Test serving an ad by making a request to:

```
GET http://localhost:8787/serve/1
```

This should redirect to a tracking URL, which in turn would redirect to the campaign URL.

### Deployment

Deploy to Cloudflare Workers:

```
npm run deploy
```

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

The Fastify-based Admin API provides endpoints for campaign and zone management:

- **Campaigns**: `/api/campaigns`
- **Zones**: `/api/zones`
- **Statistics**: `/api/stats`
- **Click Data**: `/api/stats/clicks`

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

### Developer Guidelines

When contributing to this project, please follow these guidelines:

1. **Type Safety**: Use proper TypeScript types and avoid `any` when possible. The project now has strict type checking enabled.

2. **Error Handling**: Implement try/catch blocks for all database operations and async functions. Always handle Promise rejections.

3. **Input Validation**: Validate all input parameters before using them, particularly for user-provided inputs.

4. **Consistent ID Handling**: Follow the numeric ID approach for database operations, with proper type conversions when necessary.

5. **Code Quality**: Run `npm run check-all` before submitting any PR to ensure your code meets TypeScript and ESLint standards.

6. **Testing**: Add tests for any new functionality. Run tests with `npm test`.

7. **Documentation**: Document all new functions and endpoints with appropriate JSDoc comments.

8. **Commit Messages**: Use clear, descriptive commit messages. Prefix with the type of change (feat, fix, docs, etc.).

9. **Branch Strategy**: Create feature branches from `main` and keep PRs focused on single features or fixes.

## Code Quality Notes

Based on our code analysis, here are some ongoing areas for improvement:

1. **Type System Alignment**: The database uses numeric IDs while TypeScript models use string IDs, leading to frequent conversions. Consider aligning these for better type safety.

2. **Campaign Selection**: The current implementation selects the first available campaign. A proper weighted selection algorithm based on targeting rule weights would be more effective.

3. **Device Detection**: The current device detection is basic and could be improved with a more comprehensive solution.

4. **Security Headers**: The application currently lacks proper security headers which should be added before production deployment.

5. **CORS Configuration**: The current CORS setup allows all origins, which should be restricted in production.

## Implementation TODO List

### Core Worker Implementation
- [x] Complete database queries in worker functions
- [ ] Implement proper campaign selection algorithm
- [x] Finalize click recording with all metadata
- [x] Implement proper error handling in all routes
- [ ] Set up proper CORS and security headers

### Admin API Implementation
- [ ] Connect admin API to D1 database
- [ ] Implement authentication for admin routes
- [ ] Complete campaign CRUD operations
- [ ] Complete zone CRUD operations
- [ ] Implement proper validation for all inputs

### Targeting System
- [ ] Complete geo-targeting implementation
- [ ] Improve device type targeting
- [ ] Implement frequency capping based on cookies/localStorage
- [ ] Support for rule combinations (AND/OR logic)

### Reporting and Analytics
- [ ] Implement click aggregation for reporting
- [ ] Create dashboard views for key metrics
- [ ] Add export functionality for reports
- [ ] Implement real-time stats monitoring

### Infrastructure and Deployment
- [ ] Set up proper CI/CD pipeline
- [ ] Configure staging and production environments
- [ ] Implement database backup strategy
- [ ] Add monitoring and alerting

### Documentation
- [ ] Complete API documentation
- [ ] Create user guide for campaign management
- [ ] Document targeting rule system
- [ ] Create integration examples

### Testing
- [ ] Implement unit tests for core functions
- [ ] Add integration tests for API endpoints
- [ ] Set up continuous testing in CI pipeline

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 

When creating a pull request:
1. Fork the repository
2. Create a feature branch from `main` (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 