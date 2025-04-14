# Architecture

This document outlines the technical architecture, technology stack, and project structure of the Lite Ad Server.

## Technology Stack

Lite Ad Server is built on the following technologies:

- **Cloudflare Workers**: Edge computing platform that handles all ad serving, tracking, and redirection logic
- **Cloudflare D1**: SQLite-based database that runs at the edge for storing campaign, zone, and click data
- **Durable Objects**: Cloudflare's solution for stateful applications at the edge, used for frequency capping and real-time analytics
- **TypeScript**: Strongly-typed programming language that enhances code quality and developer experience
- **Fastify**: High-performance Node.js web framework used for the Admin API
- **ESLint**: Code linting tool to ensure code quality and consistency

## System Components

### Edge Worker 

The edge worker component handles:
- Ad serving and selection
- Click tracking and redirection
- Frequency capping
- Device detection
- Geo-targeting

### Admin API

The Admin API provides endpoints for:
- Campaign management
- Zone configuration
- Statistics and reporting
- User authentication (future implementation)

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
│   ├── utils/              # Utility functions
│   │   └── idValidation.ts # ID parsing and validation utilities
│   ├── server.ts           # Fastify server setup
│   └── types/              # TypeScript type definitions
├── docs/                   # Documentation
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
└── wrangler.toml           # Cloudflare Workers configuration
```

## Data Flow

1. **Ad Request Flow**:
   - User visits a website with an ad zone
   - Website makes a request to `/serve/:zoneId`
   - Worker selects appropriate campaign based on targeting rules
   - Worker redirects to tracking URL
   - Tracking URL records impression and redirects to campaign URL

2. **Click Tracking Flow**:
   - User clicks on an ad
   - Browser sends request to tracking URL (`/track/click/:campaignId/:zoneId`)
   - Worker records click with metadata (IP, geo, user agent, etc.)
   - Worker redirects to the campaign's destination URL

3. **Admin API Flow**:
   - Admin dashboard sends API requests to manage campaigns/zones
   - Fastify API validates requests and performs database operations
   - API returns JSON responses with success/error information

## Database Schema

The system uses a D1 database with the following key tables:

1. **campaigns**: Stores campaign information such as name, redirect URL, dates, and status
2. **zones**: Defines ad placements across sites, including traffic back URLs
3. **targeting_rules**: Associates campaigns with targeting criteria
4. **targeting_rule_types**: Defines available targeting options (geo, device, etc.)
5. **clicks**: Records all click data with timestamps and metadata

## Targeting System

The targeting system selects appropriate campaigns based on:

1. **Zone Targeting**: Campaigns are associated with specific zones
2. **Geographic Targeting**: Campaigns can target specific countries or regions
3. **Device Targeting**: Campaigns can target specific device types (desktop, mobile, tablet)
4. **Frequency Capping**: Limits how often a user sees a specific campaign

## Performance Considerations

- **Edge Deployment**: All ad serving happens at the edge for minimal latency
- **Database Indexing**: Key fields are indexed for fast lookups
- **Lightweight Responses**: Redirects are used instead of serving content directly
- **Minimized Worker Size**: Keeps cold starts fast and reduces costs

## Security Architecture

- **Input Validation**: All user inputs are validated before processing
- **Error Handling**: Comprehensive error handling prevents information leakage
- **CORS Control**: API endpoints have CORS restrictions (to be tightened for production)
- **Security Headers**: Proper security headers to be implemented before production

## Monitoring and Logging

The system provides monitoring through:

- **Click Logging**: All clicks are recorded with detailed metadata
- **Stats API**: Endpoints for retrieving performance statistics
- **Cloudflare Analytics**: Built-in analytics for worker performance
