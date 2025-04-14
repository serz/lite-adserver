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

### Development

Start the local development server:

```
npm run dev
```

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
- [ ] Implement device type targeting
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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 