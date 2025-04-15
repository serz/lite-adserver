# Lite Ad Server Architecture

## System Overview

Lite Ad Server is a lightweight, serverless ad serving platform built using Cloudflare Workers. It provides a simple yet effective solution for serving targeted ads with minimal infrastructure requirements.

## Core Components

### Server Infrastructure
- **Cloudflare Workers**: Serverless execution environment
- **D1 Database**: Cloudflare's SQLite-based serverless database
- **KV Storage**: For caching and high-speed data retrieval
- **Durable Objects**: For maintaining state across requests

### Directory Structure

```
lite-adserver/
├── src/                   # Source code
│   ├── models/            # Data models
│   ├── middleware/        # Request processing middleware
│   ├── routes/            # API routes and handlers
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   ├── workers/           # Background processing logic
│   └── server.ts          # Main server entry point
├── migrations/            # Database migrations
├── dev_scripts/           # Development utilities
│   ├── init_db.sh         # Database initialization script
│   └── clean_state.sh     # Development state cleanup script
└── tests/                 # Test files
```

## Data Flow

1. **Request Handling**: Incoming requests are processed by the main server
2. **Middleware Processing**: Authentication, logging, and other cross-cutting concerns
3. **Route Handling**: Specific business logic based on the requested route
4. **Service Layer**: Core business logic implementation
5. **Data Access**: Models interact with the database

## Key Modules

### Ad Serving
- Campaign selection based on targeting rules
- Ad delivery with impression tracking
- Click tracking and redirect handling

### Data Management
- Campaign CRUD operations
- Creative management
- Targeting rule configuration

### Analytics
- Impression and click tracking
- Conversion attribution
- Performance reporting

## Database Schema

### Main Tables
- **campaigns**: Core ad campaign information
- **creatives**: Ad creative content and metadata
- **zones**: Publisher ad zones where ads are displayed
- **targeting_rules**: Rules for matching campaigns to zones
- **ad_events**: Impression and click event tracking

## Development Workflow

1. Local development with Wrangler
2. Database initialization with `init_db.sh`
3. State cleanup with `clean_state.sh` when needed
4. Migrations for schema changes
5. Deployment to Cloudflare Workers

## Performance Considerations

- Edge caching for frequently accessed content
- Minimized database queries
- Efficient targeting algorithms
- Optimized asset delivery

## Security Architecture

- Request validation
- Cross-origin resource sharing (CORS) controls
- Rate limiting
- Input sanitization

## Monitoring and Logging

- Request/response logging
- Error tracking
- Performance metrics
- Alerting for critical issues
