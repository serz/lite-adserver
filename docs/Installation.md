# Installation Guide

This guide provides step-by-step instructions for setting up the Lite Ad Server on your development machine and deploying it to Cloudflare Workers.

## Prerequisites

- Node.js 18 or later
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI installed

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/serz/lite-adserver.git
   cd lite-adserver
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create D1 database:
   ```bash
   wrangler d1 create lite_adserver_db
   ```

4. Update the `wrangler.toml` file with your D1 database ID.

5. Run database migrations:
   ```bash
   wrangler d1 execute lite_adserver_db --file=./migrations/0000_initial_schema.sql
   ```

6. Insert sample data:
   ```bash
   wrangler d1 execute lite_adserver_db --local --command "INSERT INTO zones (name, site_url, traffic_back_url, status) VALUES ('Homepage Banner', 'https://example.com', 'https://example.com/fallback', 'active');"
   
   wrangler d1 execute lite_adserver_db --local --command "INSERT INTO campaigns (name, redirect_url, start_date, end_date, status) VALUES ('Summer Sale Campaign', 'https://example.com/summer-sale', unixepoch(), unixepoch() + 2592000, 'active');"
   
   wrangler d1 execute lite_adserver_db --local --command "INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, weight) VALUES (1, 4, 'whitelist', '1', 100);"
   ```

## Development

Start the local development server:

```bash
npm run dev
```

### Type Checking and Code Quality

The project uses TypeScript with strict type checking enabled. We've added several tools to ensure code quality:

1. **TypeScript Strict Mode**: The `tsconfig.json` is configured with strict type checking enabled.

2. **Type Checking Script**: Run type checking without compilation:
   ```bash
   npm run type-check
   ```

3. **ESLint Integration**: Check for code quality and potential issues:
   ```bash
   npm run lint
   ```

4. **Combined Check**: Run all checks (type, lint, tests) with one command:
   ```bash
   npm run check-all
   ```

5. **Pre-deployment Checks**: Type checking and linting automatically run before deployment:
   ```bash
   npm run deploy
   ```

Always run `npm run check-all` before submitting a pull request to ensure your code meets the project's quality standards.

## Testing Ad Serving

Test serving an ad by making a request to:

```
GET http://localhost:8787/serve/1
```

This should redirect to a tracking URL, which in turn would redirect to the campaign URL.

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Troubleshooting

### Common Issues

1. **Wrangler Authentication Errors**:
   - Make sure you're logged in with `wrangler login`
   - Check that your Cloudflare account has the necessary permissions

2. **Database Connection Issues**:
   - Verify your D1 database ID in the `wrangler.toml` file
   - Ensure migrations have been run successfully

3. **Type Errors**:
   - Run `npm run type-check` to identify the exact location of type errors
   - Fix all type issues before attempting to deploy

## Installation Guide for Lite Ad Server

### Prerequisites
- Node.js (v16.13.0 or later)
- npm (v8.1.0 or later)
- Wrangler CLI (`npm install -g wrangler`)

### Setting Up the Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lite-adserver.git
   cd lite-adserver
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   ./dev_scripts/init_db.sh
   ```
   This script will:
   - Start Wrangler dev to initialize the D1 database
   - Run database migrations to create the schema
   - Exit when complete

4. **Seed the database with example data (optional)**
   ```bash
   ./dev_scripts/seed_example_data.sh
   ```

5. **Start the development server**
   ```bash
   npm run dev
   # or
   wrangler dev
   ```

### Reset Development State

If you need to reset your development environment:

```bash
./dev_scripts/clean_state.sh
```

This script will:
- Remove development state files from the `.wrangler` directory
- Reset the local development database and state
- Preserve directory structure while removing content

After cleaning state, you'll need to reinitialize the database:

```bash
./dev_scripts/init_db.sh
```

### Development Guidelines

#### Code Structure
- `src/` - Contains all source code
- `src/routes/` - API routes and handlers
- `src/models/` - Data models
- `src/services/` - Business logic
- `src/utils/` - Utility functions
- `src/middleware/` - Request processing middleware
- `src/workers/` - Background processing logic
- `migrations/` - Database migrations

#### Workflow
1. Make changes to the code
2. Test locally using `npm run dev`
3. Run linting with `npm run lint`
4. Write tests and run with `npm test`
5. Submit a pull request

### Testing

Run tests with:
```bash
npm test
```

Test coverage report:
```bash
npm run test:coverage
```

### Deployment

#### Development Deployment
```bash
wrangler deploy
```

#### Production Deployment
```bash
NODE_ENV=production wrangler deploy
```

### Troubleshooting

#### Common Issues

1. **Database connection errors**
   - Ensure Wrangler is properly initialized
   - Try resetting your development state with `./dev_scripts/clean_state.sh`
   - Reinitialize the database with `./dev_scripts/init_db.sh`

2. **"Module not found" errors**
   - Check that all dependencies are installed: `npm install`
   - Verify import paths in your code

3. **Wrangler errors**
   - Update Wrangler to the latest version: `npm install -g wrangler@latest`
   - Check your `wrangler.toml` configuration

4. **Performance Issues**
   - Clear Wrangler cache: `./dev_scripts/clean_state.sh`
   - Restart your development server 