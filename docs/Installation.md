# Installation Guide for Lite Ad Server

## Prerequisites

- Node.js (v18.0.0 or later)
- npm (v8.1.0 or later)
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI installed (`npm install -g wrangler`)

## Setting Up the Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/serz/lite-adserver.git
   cd lite-adserver
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Wrangler**
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```
   Edit the `wrangler.toml` file and replace placeholders with your actual values:
   - `your-custom-domain.example.com` - Your custom domain if applicable
   - `your-api-key-here` - A secure API key for administration
   - `your-d1-database-id-here` - Your Cloudflare D1 database ID
   - `your-kv-namespace-id-here` - Your Cloudflare KV namespace ID
   - `your-kv-preview-id-here` - Your Cloudflare KV preview namespace ID

   You can create these resources using the Cloudflare dashboard or Wrangler CLI commands.
   
   > **Note:** The `wrangler.toml` file is ignored by git for security reasons to prevent committing sensitive data like API keys and database IDs. Each developer should maintain their own local configuration.

4. **Initialize the database**
   ```bash
   ./dev_scripts/init_db.sh
   ```
   This script will:
   - Start Wrangler dev to initialize the D1 database
   - Run database migrations to create the schema
   - Exit when complete

5. **Seed the database with example data**
   ```bash
   ./dev_scripts/seed_example_data.sh
   ```
   This script will create:
   - Two example zones (Sports and News)
   - Two campaigns with different targeting rules
   - Geographic targeting (US and Canada)
   - Device targeting (desktop only)

6. **Start the development server**
   ```bash
   npm run dev
   # or
   wrangler dev
   ```

## Testing Ad Serving

Test serving an ad by making a request to:

```
GET http://localhost:8787/serve/1   # Sports Zone
GET http://localhost:8787/serve/2   # News Zone
```

Each should redirect to a tracking URL, which in turn would redirect to the campaign URL.

## Reset Development State

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

## Development Guidelines

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

### Code Structure
- `src/` - Contains all source code
- `src/models/` - Data models
- `src/utils/` - Utility functions
- `src/types/` - TypeScript type definitions
- `src/workers/` - Cloudflare Workers implementation
- `migrations/` - Database migrations

### Workflow
1. Make changes to the code
2. Test locally using `npm run dev`
3. Run linting with `npm run lint`
4. Write tests and run with `npm test`
5. Submit a pull request

## Testing

Run tests with:
```bash
npm test
```

Test coverage report:
```bash
npm run test:coverage
```

## Deployment

### Development Deployment
```bash
wrangler deploy
```

### Production Deployment
```bash
NODE_ENV=production wrangler deploy
```

## Troubleshooting

### Common Issues

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
   - Make sure you're logged in with `wrangler login`
   - Check that your Cloudflare account has the necessary permissions

4. **Performance Issues**
   - Clear Wrangler cache: `./dev_scripts/clean_state.sh`
   - Restart your development server 