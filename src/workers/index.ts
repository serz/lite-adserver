/**
 * Lite Ad Server - Cloudflare Worker Entry Point
 */

import type { ScheduledEvent } from '@cloudflare/workers-types';
import { CounterDO } from './counter';
import { parseAndValidateId, parseId, isValidId } from '../utils/idValidation';
import { generateSnowflakeId } from '../utils/snowflake';
import { replaceMacros } from '../utils/macros';
import { handleSyncApiRequests } from '../services/syncService';
import { hasValidAuthorizationAsync } from '../utils/auth';
import { applySecurityHeaders } from '../utils/securityHeaders';
import { selectEligibleCampaign } from '../services/campaignSelectionService';
import { detectDeviceType, detectBrowser, detectOS } from '../utils/deviceDetection';
import { 
  Env, 
  DbCampaign, 
  CampaignUpdateData, 
  ZoneUpdateData, 
  CreateCampaignRequestData,
  TargetingRuleData
} from '../models/interfaces';
// Re-export the CounterDO class needed by the Durable Object binding in wrangler.toml
export { CounterDO };

// A logger function that's compatible with linting rules
function logMessage(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

function logWarning(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(message);
}

/**
 * Handle /ping debug endpoint
 */
function handlePing(request: Request): Response {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  const country = request.headers.get('CF-IPCountry') ?? '';
  const userAgent = request.headers.get('User-Agent') ?? '';
  const device_type = detectDeviceType(userAgent);
  const os = detectOS(userAgent);
  const browser = detectBrowser(userAgent);
  return new Response(
    JSON.stringify({
      headers,
      query,
      country,
      device_type,
      os,
      browser
    }, null, 2),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle /ping debug endpoint
    if (url.pathname === '/ping') {
      return handlePing(request);
    }
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      // Create a response with appropriate CORS headers
      const response = new Response(null, { status: 204 });
      return applySecurityHeaders(response, request, env);
    }
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      const apiResponse = await handleApiRequest(request, env);
      return applySecurityHeaders(apiResponse, request, env);
    }
    
    // Ad serving route
    if (url.pathname.startsWith('/serve/')) {
      const adResponse = await handleAdServing(request, env);
      return applySecurityHeaders(adResponse, request, env);
    }
    
    // Tracking route
    if (url.pathname.startsWith('/track/')) {
      const trackingResponse = await handleTracking(request, env);
      return applySecurityHeaders(trackingResponse, request, env);
    }
    
    // Default response
    const defaultResponse = new Response('Lite Ad Server', {
      headers: { 'content-type': 'text/plain' },
    });
    return applySecurityHeaders(defaultResponse, request, env);
  },
  
  // Handler for scheduled events
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    logMessage(`Running scheduled sync at ${new Date().toISOString()}`);
    
    try {
      // Create a SyncEnv from Env
      const syncEnv = env as import('../services/syncService').SyncEnv;
      
      // Call syncAll to sync both campaigns and zones
      await import('../services/syncService').then(({ syncAll }) => syncAll(syncEnv));
      
      logMessage(`Scheduled sync completed successfully at ${new Date().toISOString()}`);
    } catch (error) {
      logError(`Error in scheduled sync: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

/**
 * Handle API requests
 */
async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle API keys management
  if (path.startsWith('/api/api-keys')) {
    return handleApiKeyRequests(request, env);
  }
  
  // Check if the request has valid authorization using async version
  if (!(await hasValidAuthorizationAsync(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Handle sync API requests
  if (path.startsWith('/api/sync')) {
    return await handleSyncApiRequests(request, env);
  }
  
  // Handle other API requests
  if (path.startsWith('/api/campaigns')) {
    return handleCampaignApiRequests(request, env);
  }
  
  // Handle targeting rule types routes
  if (path === '/api/targeting-rule-types' && request.method === 'GET') {
    return await listTargetingRuleTypes(env);
  }
  
  // Handle zones routes
  if (path.startsWith('/api/zones')) {
    return handleZoneApiRequests(request, env);
  }
  
  // Handle ad events routes
  if (path.startsWith('/api/ad_events') && request.method === 'GET') {
    return await listAdEvents(request, env);
  }
  
  // Handle stats routes
  if (path.startsWith('/api/stats') && request.method === 'GET') {
    return await getStats(request, env);
  }
  
  // Handle flush DB route (demo instances only)
  if (path === '/api/flush-db' && request.method === 'POST') {
    return await flushDatabase(env);
  }
  
  return new Response(JSON.stringify({ error: 'API endpoint not found' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * Handle API Key requests
 */
async function handleApiKeyRequests(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  
  // Check if request has admin authorization
  const authHeader = request.headers.get('Authorization');
  const isAdmin = authHeader && authHeader.startsWith('Bearer ') && 
                 authHeader.substring(7) === env.API_KEY;
                 
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // GET /api/api-keys - List all API keys
  if (path === '/api/api-keys' && request.method === 'GET') {
    return await listApiKeys(request, env);
  }
  
  // POST /api/api-keys - Create a new API key
  if (path === '/api/api-keys' && request.method === 'POST') {
    return await createApiKey(request, env);
  }
  
  return new Response(JSON.stringify({ error: 'API Key endpoint not found or method not allowed' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * Handle Campaign API requests
 */
async function handleCampaignApiRequests(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  const pathParts = path.split('/');
  
  // Routing logic based on path structure and method
  const isTargetingRuleRequest = pathParts.length === 5 && pathParts[2] === 'campaigns' && pathParts[4] === 'targeting_rules';

  // GET /api/campaigns/{campaign_id}/targeting_rules - List rules for a campaign
  if (isTargetingRuleRequest && request.method === 'GET') {
    const campaignId = pathParts[3];
    return await listCampaignTargetingRules(campaignId, env);
  }

  // POST /api/campaigns/{campaign_id}/targeting_rules - Sync rules for a campaign
  if (isTargetingRuleRequest && request.method === 'POST') {
    const campaignId = pathParts[3];
    return await syncCampaignTargetingRules(campaignId, request, env);
  }

  // GET /api/campaigns - List all campaigns
  if (path === '/api/campaigns' && request.method === 'GET') {
    return await listCampaigns(request, env);
  }
  
  // GET /api/campaigns/:id - Get campaign by ID
  if (pathParts.length === 4 && pathParts[2] === 'campaigns' && request.method === 'GET') {
    const campaignId = pathParts[3];
    return await getCampaign(campaignId, env);
  }
  
  // POST /api/campaigns - Create a new campaign
  if (path === '/api/campaigns' && request.method === 'POST') {
    return await createCampaign(request, env);
  }
  
  // PUT /api/campaigns/:id - Update campaign
  if (pathParts.length === 4 && pathParts[2] === 'campaigns' && request.method === 'PUT') {
    const campaignId = pathParts[3];
    return await updateCampaign(campaignId, request, env);
  }
  
  // DELETE /api/campaigns/:id - Delete campaign
  if (pathParts.length === 4 && pathParts[2] === 'campaigns' && request.method === 'DELETE') {
    const campaignId = pathParts[3];
    return await deleteCampaign(campaignId, env);
  }
  
  return new Response(JSON.stringify({ error: 'Campaign API endpoint not found' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * List all campaigns with pagination and filtering
 */
async function listCampaigns(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    
    // Parse query parameters
    const status = params.get('status');
    const limit = parseInt(params.get('limit') ?? '20', 10);
    const offset = parseInt(params.get('offset') ?? '0', 10);
    const sort = params.get('sort') ?? 'created_at';
    const order = params.get('order') ?? 'desc';
    
    // Validate parameters
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: 'Limit must be between 1 and 100' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (offset < 0) {
      return new Response(JSON.stringify({ error: 'Offset must be a non-negative integer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Valid sort fields
    const validSortFields = ['name', 'created_at', 'start_date'];
    if (!validSortFields.includes(sort)) {
      return new Response(JSON.stringify({ error: 'Invalid sort field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Valid order values
    if (order !== 'asc' && order !== 'desc') {
      return new Response(JSON.stringify({ error: 'Order must be "asc" or "desc"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build SQL query
    let sql = 'SELECT * FROM campaigns';
    const queryParams: (string | number)[] = [];
    
    // Add status filter if provided
    if (status) {
      sql += ' WHERE status = ?';
      queryParams.push(status);
    }
    
    // Add sorting
    sql += ` ORDER BY ${sort} ${order}`;
    
    // Add pagination
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Count total for pagination
    let countSql = 'SELECT COUNT(*) as total FROM campaigns';
    const countParams: (string | number)[] = [];
    
    if (status) {
      countSql += ' WHERE status = ?';
      countParams.push(status);
    }
    
    // Execute queries
    const [campaignsResult, countResult] = await Promise.all([
      env.DB.prepare(sql).bind(...queryParams).all(),
      env.DB.prepare(countSql).bind(...countParams).all()
    ]);
    
    // Handle database errors
    if (campaignsResult.error) {
      throw new Error(`Database error: ${campaignsResult.error}`);
    }
    
    if (countResult.error) {
      throw new Error(`Database error: ${countResult.error}`);
    }
    
    // Extract results
    const campaigns = campaignsResult.results ?? [];
    const total = countResult.results?.[0] ? 
      (countResult.results[0] as { total: number }).total : 0;
    
    // Return paginated response
    return new Response(JSON.stringify({
      campaigns,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error listing campaigns:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error listing campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get campaign by ID
 */
async function getCampaign(campaignId: string | undefined, env: Env): Promise<Response> {
  try {
    // Check if campaignId is undefined
    if (campaignId === undefined) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate ID
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Query the campaign
    const campaignResult = await env.DB.prepare(`
      SELECT * FROM campaigns WHERE id = ?
    `).bind(id).all();
    
    if (campaignResult.error) {
      throw new Error(`Database error: ${campaignResult.error}`);
    }
    
    if (!campaignResult.results || campaignResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const campaign = campaignResult.results[0] as DbCampaign;
    
    // Query targeting rules for this campaign
    const rulesResult = await env.DB.prepare(`
      SELECT * FROM targeting_rules WHERE campaign_id = ?
    `).bind(id).all();
    
    if (rulesResult.error) {
      throw new Error(`Database error: ${rulesResult.error}`);
    }
    
    // Combine campaign with its targeting rules
    const campaignWithRules = {
      ...campaign,
      targeting_rules: rulesResult.results ?? []
    };
    
    return new Response(JSON.stringify(campaignWithRules), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error getting campaign:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error getting campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create a new campaign
 */
async function createCampaign(request: Request, env: Env): Promise<Response> {
  try {
    // Parse the request body
    const campaignData = await request.json() as CreateCampaignRequestData;
    
    // Validate required fields
    if (!campaignData.name || typeof campaignData.name !== 'string') {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!campaignData.redirect_url || typeof campaignData.redirect_url !== 'string') {
      return new Response(JSON.stringify({ error: 'Redirect URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update start_date validation to be optional
    if (campaignData.start_date !== undefined && typeof campaignData.start_date !== 'number') {
      return new Response(JSON.stringify({ error: 'Start date must be a number when provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!campaignData.targeting_rules || !Array.isArray(campaignData.targeting_rules) || campaignData.targeting_rules.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one targeting rule is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Set default values
    const timestamp = Date.now();
    const status = 'paused'; // New campaigns start as paused
    
    // Insert the campaign using a transaction
    const stmt1 = env.DB.prepare(`
      INSERT INTO campaigns (name, redirect_url, start_date, end_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      campaignData.name,
      campaignData.redirect_url,
      campaignData.start_date ?? null,
      campaignData.end_date ?? null,
      status,
      timestamp,
      timestamp
    );
    
    // Execute the query and get the inserted ID
    const result = await stmt1.run();
    
    if (result.error) {
      throw new Error(`Database error: ${result.error}`);
    }
    
    // The newly inserted campaign ID
    const campaignId = result.meta?.['last_row_id'];
    
    if (!campaignId) {
      throw new Error('Failed to get inserted campaign ID');
    }
    
    // Insert targeting rules for the campaign
    const ruleInsertions = campaignData.targeting_rules.map((rule) => {
      return env.DB.prepare(`
        INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        campaignId,
        rule.targeting_rule_type_id,
        rule.targeting_method,
        rule.rule,
        timestamp,
        timestamp
      ).run();
    });
    
    // Execute all targeting rule insertions
    await Promise.all(ruleInsertions);
    
    // Return the created campaign
    return new Response(JSON.stringify({
      id: campaignId,
      name: campaignData.name,
      status,
      created_at: timestamp
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error creating campaign:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error creating campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update an existing campaign
 */
async function updateCampaign(campaignId: string | undefined, request: Request, env: Env): Promise<Response> {
  try {
    // Check if campaignId is undefined
    if (campaignId === undefined) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate ID
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse request body
    let updateData: CampaignUpdateData;
    
    try {
      updateData = await request.json() as CampaignUpdateData;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate input data
    const validationError = validateCampaignUpdateData(updateData);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if the campaign exists
    const existsResult = await env.DB.prepare(`
      SELECT id FROM campaigns WHERE id = ?
    `).bind(id).all();
    
    if (existsResult.error) {
      throw new Error(`Database error: ${existsResult.error}`);
    }
    
    if (!existsResult.results || existsResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build update query with only the fields that are provided
    const updateFields: string[] = [];
    const params: (string | number)[] = [];
    
    // Process fields for update
    if (updateData.name !== undefined) {
      updateFields.push('name = ?');
      params.push(updateData.name);
    }

    if (updateData.redirect_url !== undefined) {
      updateFields.push('redirect_url = ?');
      params.push(updateData.redirect_url);
    }

    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updateData.status);
    }

    if (updateData.start_date !== undefined) {
      updateFields.push('start_date = ?');
      // Handle null case explicitly for SQLite
      params.push(updateData.start_date ?? null as unknown as number);
    }

    if (updateData.end_date !== undefined) {
      updateFields.push('end_date = ?');
      // Handle null case explicitly for SQLite
      params.push(updateData.end_date ?? null as unknown as number);
    }

    if (updateData.traffic_back_url !== undefined) {
      updateFields.push('traffic_back_url = ?');
      params.push(updateData.traffic_back_url);
    }
    
    // Add updated_at timestamp and campaign ID
    const timestamp = Date.now();
    updateFields.push('updated_at = ?');
    params.push(timestamp);
    params.push(id);
    
    // If there are no fields to update, return early
    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the campaign
    const updateResult = await env.DB.prepare(`
      UPDATE campaigns
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...params).run();
    
    if (updateResult.error) {
      throw new Error(`Database error: ${updateResult.error}`);
    }
    
    return new Response(JSON.stringify({
      id,
      updated_at: timestamp
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error updating campaign:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error updating campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Validate campaign update data
 * @param data - The data to validate
 * @returns Error message or null if valid
 */
function validateCampaignUpdateData(data: CampaignUpdateData): string | null {
  // Validate status if provided
  if ('status' in data) {
    const validStatuses = ['active', 'paused', 'archived'];
    if (typeof data.status !== 'string' || !validStatuses.includes(data.status)) {
      return `Invalid status value. Must be one of: ${validStatuses.join(', ')}`;
    }
  }
  
  // Validate name if provided
  if ('name' in data && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    return 'Name must be a non-empty string';
  }
  
  // Validate redirect_url if provided
  if ('redirect_url' in data) {
    if (typeof data.redirect_url !== 'string' || data.redirect_url.trim().length === 0) {
      return 'Redirect URL must be a non-empty string';
    }
    
    try {
      new URL(data.redirect_url);
    } catch (e) {
      return 'Redirect URL must be a valid URL';
    }
  }
  
  // Validate start_date if provided
  if ('start_date' in data) {
    if (data.start_date !== null && (typeof data.start_date !== 'number' || data.start_date <= 0)) {
      return 'Start date must be a positive number (timestamp) or null';
    }
  }
  
  // Validate end_date if provided
  if ('end_date' in data) {
    if (data.end_date !== null && (typeof data.end_date !== 'number' || data.end_date <= 0)) {
      return 'End date must be a positive number (timestamp) or null';
    }
    
    // If both start_date and end_date are provided and neither is null, ensure end_date is after start_date
    if (data.end_date && 'start_date' in data && data.start_date && data.end_date <= data.start_date) {
      return 'End date must be after start date';
    }
  }
  
  return null;
}

/**
 * Delete a campaign
 */
async function deleteCampaign(campaignId: string | undefined, env: Env): Promise<Response> {
  try {
    // Check if campaignId is undefined
    if (campaignId === undefined) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate ID
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if the campaign exists
    const existsResult = await env.DB.prepare(`
      SELECT id FROM campaigns WHERE id = ?
    `).bind(id).all();
    
    if (existsResult.error) {
      throw new Error(`Database error: ${existsResult.error}`);
    }
    
    if (!existsResult.results || existsResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the campaign's targeting rules first
    const deleteRulesResult = await env.DB.prepare(`
      DELETE FROM targeting_rules WHERE campaign_id = ?
    `).bind(id).run();
    
    if (deleteRulesResult.error) {
      throw new Error(`Database error: ${deleteRulesResult.error}`);
    }
    
    // Delete the campaign
    const deleteCampaignResult = await env.DB.prepare(`
      DELETE FROM campaigns WHERE id = ?
    `).bind(id).run();
    
    if (deleteCampaignResult.error) {
      throw new Error(`Database error: ${deleteCampaignResult.error}`);
    }
    
    // Return a 204 No Content response
    return new Response(null, { status: 204 });
  } catch (error) {
    logError('Error deleting campaign:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error deleting campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle ad serving requests
 */
async function handleAdServing(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle trailing slashes by removing them
  const path = url.pathname.endsWith('/') 
    ? url.pathname.slice(0, -1) 
    : url.pathname;
    
  const zoneId = path.split('/').pop() ?? '';
  
  // Extract sub_id from query parameters if present
  const subId = url.searchParams.get('sub_id') ?? undefined;
  
  if (!zoneId) {
    return new Response('Zone ID required', { status: 400 });
  }
  
  try {
    // Select an eligible campaign that passes all targeting rules in one step
    const selectedCampaign = await selectEligibleCampaign(request, zoneId, env);
    
    if (!selectedCampaign) {
      // If no campaigns are eligible, check if zone has a traffic back URL
      const zone = await fetchZone(env, zoneId);
      
      if (zone?.traffic_back_url) {
        // Record fallback click before redirecting
        await recordClick(env.DB, {
          campaign_id: null, // Use null to indicate fallback since 0 causes foreign key constraint errors
          zone_id: zoneId,
          ip: request.headers.get('CF-Connecting-IP') ?? undefined,
          user_agent: request.headers.get('User-Agent') ?? undefined,
          referer: request.headers.get('Referer') ?? undefined,
          country: request.headers.get('CF-IPCountry') ?? undefined,
          device_type: detectDeviceType(request.headers.get('User-Agent') ?? ''),
          timestamp: Date.now(),
          event_type: 'fallback',
          sub_id: subId
        });
        
        // Redirect to traffic back URL
        return Response.redirect(zone.traffic_back_url, 302);
      }
      
      // No eligible campaigns and no fallback URL - record as unsold impression
      await recordClick(env.DB, {
        campaign_id: null,
        zone_id: zoneId,
        ip: request.headers.get('CF-Connecting-IP') ?? undefined,
        user_agent: request.headers.get('User-Agent') ?? undefined,
        referer: request.headers.get('Referer') ?? undefined,
        country: request.headers.get('CF-IPCountry') ?? undefined,
        device_type: detectDeviceType(request.headers.get('User-Agent') ?? ''),
        timestamp: Date.now(),
        event_type: 'unsold',
        sub_id: subId
      });
      
      return new Response('No eligible campaigns', { status: 404 });
    }
    
    // Generate a tracking URL
    const trackingUrl = generateTrackingUrl(request, selectedCampaign.id, zoneId, subId);
    
    // Return a redirect to the tracking URL
    return Response.redirect(trackingUrl, 302);
  } catch (error) {
    logError('Error serving ad:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response('Server error', { status: 500 });
  }
}

/**
 * Handle tracking requests (clicks)
 */
async function handleTracking(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle trailing slashes by removing them
  const path = url.pathname.endsWith('/') 
    ? url.pathname.slice(0, -1) 
    : url.pathname;
    
  const parts = path.split('/');
  const trackType = parts[2]; // /track/{type}/{id}
  const campaignId = parts[3] ?? '';
  const zoneId = parts[4] ?? '';
  
  // Extract sub_id from query parameters if present
  const subId = url.searchParams.get('sub_id');
  
  if (!trackType || !campaignId) {
    return new Response('Invalid tracking URL', { status: 400 });
  }
  
  try {
    if (trackType === 'click') {
      // Generate Snowflake ID for this event
      const clickId = generateSnowflakeId().toString();
      
      // Track click in database
      await recordClick(env.DB, {
        campaign_id: campaignId,
        zone_id: zoneId,
        ip: request.headers.get('CF-Connecting-IP') ?? undefined,
        user_agent: request.headers.get('User-Agent') ?? undefined,
        referer: request.headers.get('Referer') ?? undefined,
        country: request.headers.get('CF-IPCountry') ?? undefined,
        device_type: detectDeviceType(request.headers.get('User-Agent') ?? ''),
        timestamp: Date.now(),
        sub_id: subId ?? undefined,
        click_id: clickId
      });
      
      // Fetch campaign redirect URL
      const campaign = await fetchCampaign(env, campaignId);
      
      if (!campaign?.redirect_url) {
        return new Response('Invalid campaign', { status: 404 });
      }
      
      // Replace macros in the redirect URL
      const redirectUrl = replaceMacros(campaign.redirect_url, {
        click_id: clickId,
        zone_id: zoneId,
        aff_sub_id: subId ?? null
      });
      
      // Redirect to campaign URL with macros replaced
      return Response.redirect(redirectUrl, 302);
    }
    
    return new Response('Unknown tracking type', { status: 400 });
  } catch (error) {
    logError('Error tracking:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response('Server error', { status: 500 });
  }
}

/**
 * Fetch zone details
 */
async function fetchZone(env: Env, zoneId: string): Promise<{ id: number; traffic_back_url?: string } | null> {
  try {
    // Convert zoneId to number for numeric ID
    const zoneIdNum = parseAndValidateId(zoneId, 'zone');
    if (zoneIdNum === null) {
      return null;
    }
    
    // Fetch zone from KV
    const zoneKey = `zones:${zoneIdNum}`;
    const zoneDataRaw = await env.campaigns_zones.get(zoneKey, { type: 'json' });
    
    // Type assertion for the zone data
    interface ZoneData {
      id: number;
      traffic_back_url?: string;
    }
    
    // Check if we have zone data
    const zoneData = zoneDataRaw as ZoneData | null;
    if (!zoneData) {
      return null;
    }
    
    // Return required zone details
    return {
      id: zoneData.id,
      traffic_back_url: zoneData.traffic_back_url
    };
  } catch (error) {
    logError(`Error fetching zone ${zoneId} from KV:`);
    logError(error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Fetch campaign details by ID
 */
async function fetchCampaign(env: Env, campaignId: string | number): Promise<{ id: number; redirect_url: string } | null> {
  try {
    // Convert campaignId to number if it's a string
    const campaignIdNum = parseAndValidateId(campaignId, 'campaign');
    if (campaignIdNum === null) {
      return null;
    }

    // Fetch campaigns from KV
    const campaignsJson = await env.campaigns_zones.get('campaigns');
    if (!campaignsJson) {
      return null;
    }
    
    // Parse campaigns JSON
    interface CampaignData {
      id: number;
      name: string;
      redirect_url: string;
      start_date?: number;
      end_date?: number;
      [key: string]: unknown;
    }
    
    const campaigns = JSON.parse(campaignsJson) as CampaignData[];
    
    // Find the campaign by ID
    const campaign = campaigns.find(c => c.id === campaignIdNum);
    if (!campaign) {
      return null;
    }
    
    return {
      id: campaign.id,
      redirect_url: campaign.redirect_url
    };
  } catch (error) {
    logError(`Error fetching campaign ${campaignId} from KV:`);
    logError(error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Generate a tracking URL for click redirection
 */
function generateTrackingUrl(request: Request, campaignId: number, zoneId: string, subId?: string): string {
  const baseUrl = new URL(request.url);
  // Ensure no trailing slash in the pathname
  baseUrl.pathname = `/track/click/${campaignId}/${zoneId}`;
  
  // Add sub_id as query parameter if provided
  if (subId) {
    baseUrl.searchParams.set('sub_id', subId);
  } else {
    baseUrl.search = '';
  }
  
  return baseUrl.toString();
}

/**
 * Record a click in the database as an ad event
 */
async function recordClick(db: D1Database, clickData: {
  campaign_id: string | number | null,
  zone_id: string | number,
  ip?: string,
  user_agent?: string,
  referer?: string,
  country?: string,
  device_type?: string,
  timestamp: number,
  event_type?: string,
  sub_id?: string,
  click_id?: string
}): Promise<void> {
  try {
    // Generate Snowflake ID for this event if not provided
    const snowflakeId = clickData.click_id ? clickData.click_id : generateSnowflakeId().toString();
    
    // Convert IDs to numbers for numeric IDs
    const campaignIdNum = clickData.campaign_id !== null ? parseId(clickData.campaign_id) : null;
    const zoneIdNum = parseId(clickData.zone_id);
    
    // Only validate campaign ID if it's not null
    if (campaignIdNum !== null && !isValidId(campaignIdNum)) {
      logError('Invalid campaign ID format in click data:');
      logError(JSON.stringify(clickData));
      return;
    }
    
    if (!isValidId(zoneIdNum)) {
      logError('Invalid zone ID format in click data:');
      logError(JSON.stringify(clickData));
      return;
    }
    
    // Extract browser and OS from user agent if available
    let browser = null;
    let os = null;
    
    if (clickData.user_agent) {
      // Use utility functions for consistent detection
      browser = detectBrowser(clickData.user_agent);
      os = detectOS(clickData.user_agent);
    }
    
    await db.prepare(`
      INSERT INTO ad_events (
        id,
        sub_id,
        event_type, 
        event_time, 
        campaign_id, 
        zone_id, 
        ip, 
        user_agent, 
        referer, 
        country, 
        device_type,
        browser,
        os
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snowflakeId,
      clickData.sub_id ?? null,
      clickData.event_type ?? 'click',
      clickData.timestamp,
      campaignIdNum,
      zoneIdNum,
      clickData.ip ?? null,
      clickData.user_agent ?? null,
      clickData.referer ?? null,
      clickData.country ?? null,
      clickData.device_type ?? null,
      browser,
      os
    ).run();
    
    const campaignIdText = campaignIdNum ?? 'NULL';
    logWarning(`${clickData.event_type ?? 'Click'} event recorded with ID ${snowflakeId} for campaign ${campaignIdText}, zone ${zoneIdNum}`);
  } catch (error) {
    logError('Error recording click event:');
    logError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * List targeting rule types
 */
async function listTargetingRuleTypes(env: Env): Promise<Response> {
  try {
    // Query all targeting rule types
    const result = await env.DB.prepare(`
      SELECT id, name, description
      FROM targeting_rule_types
      ORDER BY name ASC
    `).all();
    
    if (result.error) {
      throw new Error(`Database error: ${result.error}`);
    }
    
    // Return the targeting rule types
    return new Response(JSON.stringify({
      targeting_rule_types: result.results ?? []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error listing targeting rule types:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error listing targeting rule types' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Zone API requests
 */
async function handleZoneApiRequests(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  const pathParts = path.split('/');
  
  // GET /api/zones - List all zones
  if (path === '/api/zones' && request.method === 'GET') {
    return await listZones(request, env);
  }
  
  // GET /api/zones/:id - Get zone by ID
  if (pathParts.length === 4 && pathParts[2] === 'zones' && request.method === 'GET') {
    const zoneId = pathParts[3];
    return await getZone(zoneId, env);
  }
  
  // POST /api/zones - Create a new zone
  if (path === '/api/zones' && request.method === 'POST') {
    return await createZone(request, env);
  }
  
  // PUT /api/zones/:id - Update zone
  if (pathParts.length === 4 && pathParts[2] === 'zones' && request.method === 'PUT') {
    const zoneId = pathParts[3];
    return await updateZone(zoneId, request, env);
  }
  
  // DELETE /api/zones/:id - Delete zone
  if (pathParts.length === 4 && pathParts[2] === 'zones' && request.method === 'DELETE') {
    const zoneId = pathParts[3];
    return await deleteZone(zoneId, env);
  }
  
  return new Response(JSON.stringify({ error: 'Zone API endpoint not found' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * List all zones with pagination and filtering
 */
async function listZones(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    
    // Parse query parameters
    const status = params.get('status');
    const limit = parseInt(params.get('limit') ?? '20', 10);
    const offset = parseInt(params.get('offset') ?? '0', 10);
    const sort = params.get('sort') ?? 'created_at';
    const order = params.get('order') ?? 'desc';
    
    // Validate parameters
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: 'Limit must be between 1 and 100' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (offset < 0) {
      return new Response(JSON.stringify({ error: 'Offset must be a non-negative integer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Valid sort fields
    const validSortFields = ['name', 'created_at', 'site_url'];
    if (!validSortFields.includes(sort)) {
      return new Response(JSON.stringify({ error: 'Invalid sort field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Valid order values
    if (order !== 'asc' && order !== 'desc') {
      return new Response(JSON.stringify({ error: 'Order must be "asc" or "desc"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build SQL query
    let sql = 'SELECT * FROM zones';
    const queryParams: (string | number)[] = [];
    
    // Add status filter if provided
    if (status) {
      sql += ' WHERE status = ?';
      queryParams.push(status);
    }
    
    // Add sorting
    sql += ` ORDER BY ${sort} ${order}`;
    
    // Add pagination
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Count total for pagination
    let countSql = 'SELECT COUNT(*) as total FROM zones';
    const countParams: (string | number)[] = [];
    
    if (status) {
      countSql += ' WHERE status = ?';
      countParams.push(status);
    }
    
    // Execute queries
    const [zonesResult, countResult] = await Promise.all([
      env.DB.prepare(sql).bind(...queryParams).all(),
      env.DB.prepare(countSql).bind(...countParams).all()
    ]);
    
    // Handle database errors
    if (zonesResult.error) {
      throw new Error(`Database error: ${zonesResult.error}`);
    }
    
    if (countResult.error) {
      throw new Error(`Database error: ${countResult.error}`);
    }
    
    // Extract results
    const zones = zonesResult.results ?? [];
    const total = countResult.results?.[0] ? 
      (countResult.results[0] as { total: number }).total : 0;
    
    // Return paginated response
    return new Response(JSON.stringify({
      zones,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error listing zones:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error listing zones' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get zone by ID
 */
async function getZone(zoneId: string | undefined, env: Env): Promise<Response> {
  try {
    // Check if zoneId is undefined
    if (zoneId === undefined) {
      return new Response(JSON.stringify({ error: 'Zone ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate ID
    const id = parseAndValidateId(zoneId, 'zone');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid zone ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Fetch the zone
    const sql = 'SELECT * FROM zones WHERE id = ?';
    const result = await env.DB.prepare(sql).bind(id).all();
    
    if (result.error) {
      throw new Error(`Database error: ${result.error}`);
    }
    
    const zones = result.results ?? [];
    
    if (zones.length === 0) {
      return new Response(JSON.stringify({ error: 'Zone not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const zone = zones[0];
    
    return new Response(JSON.stringify(zone), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error fetching zone:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error fetching zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create a new zone
 */
async function createZone(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body
    const data = await request.json() as {
      name: string;
      site_url?: string;
      traffic_back_url?: string;
    };
    
    // Validate required fields
    if (!data.name) {
      return new Response(JSON.stringify({ error: 'Zone name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // URL validations if URLs are provided
    if (data.site_url) {
      try {
        new URL(data.site_url);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid site URL format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (data.traffic_back_url) {
      try {
        new URL(data.traffic_back_url);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid traffic back URL format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Prepare zone object
    const now = Date.now();
    const zone = {
      name: data.name,
      site_url: data.site_url ?? null,
      traffic_back_url: data.traffic_back_url ?? null,
      status: 'active',
      created_at: now,
      updated_at: now
    };
    
    // Insert zone into database
    const sql = `
      INSERT INTO zones (name, site_url, traffic_back_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await env.DB.prepare(sql).bind(
      zone.name,
      zone.site_url,
      zone.traffic_back_url,
      zone.status,
      zone.created_at,
      zone.updated_at
    ).run();
    
    if (result.error) {
      throw new Error(`Database error: ${result.error}`);
    }
    
    // Return success response with the ID
    return new Response(JSON.stringify({
      id: result.meta?.['last_row_id'],
      status: zone.status,
      created_at: zone.created_at
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error creating zone:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error creating zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update an existing zone
 */
async function updateZone(zoneId: string | undefined, request: Request, env: Env): Promise<Response> {
  try {
    // Check if zoneId is undefined
    if (zoneId === undefined) {
      return new Response(JSON.stringify({ error: 'Zone ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate ID
    const id = parseAndValidateId(zoneId, 'zone');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid zone ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse request body
    const data = await request.json() as ZoneUpdateData;
    
    // Validate data
    const validationError = validateZoneUpdateData(data);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if zone exists
    const checkSql = 'SELECT id FROM zones WHERE id = ?';
    const checkResult = await env.DB.prepare(checkSql).bind(id).all();
    
    if (checkResult.error) {
      throw new Error(`Database error: ${checkResult.error}`);
    }
    
    if (!checkResult.results || checkResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Zone not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Prepare update query
    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    
    // Add fields to update if provided
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    
    if (data.site_url !== undefined) {
      updates.push('site_url = ?');
      params.push(data.site_url);
    }
    
    if (data.traffic_back_url !== undefined) {
      updates.push('traffic_back_url = ?');
      params.push(data.traffic_back_url);
    }
    
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    
    // Add updated_at
    updates.push('updated_at = ?');
    params.push(Date.now());
    
    // Add zone ID to params
    params.push(id);
    
    // Execute update query
    const updateSql = `UPDATE zones SET ${updates.join(', ')} WHERE id = ?`;
    const updateResult = await env.DB.prepare(updateSql).bind(...(params)).run();
    
    if (updateResult.error) {
      throw new Error(`Database error: ${updateResult.error}`);
    }
    
    // Return success response
    return new Response(JSON.stringify({
      id,
      updated_at: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error updating zone:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error updating zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Validate zone update data
 */
function validateZoneUpdateData(data: ZoneUpdateData): string | null {
  // Check for URL format if provided
  if (data.site_url) {
    try {
      new URL(data.site_url);
    } catch (e) {
      return 'Invalid site URL format';
    }
  }
  
  if (data.traffic_back_url) {
    try {
      new URL(data.traffic_back_url);
    } catch (e) {
      return 'Invalid traffic back URL format';
    }
  }
  
  // Check status if provided
  if (data.status && !['active', 'inactive'].includes(data.status)) {
    return 'Status must be one of: active, inactive';
  }
  
  return null;
}

/**
 * Delete a zone
 */
async function deleteZone(zoneId: string | undefined, env: Env): Promise<Response> {
  try {
    // Check if zoneId is undefined
    if (zoneId === undefined) {
      return new Response(JSON.stringify({ error: 'Zone ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate ID
    const id = parseAndValidateId(zoneId, 'zone');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid zone ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if zone exists
    const checkSql = 'SELECT id FROM zones WHERE id = ?';
    const checkResult = await env.DB.prepare(checkSql).bind(id).all();
    
    if (checkResult.error) {
      throw new Error(`Database error: ${checkResult.error}`);
    }
    
    if (!checkResult.results || checkResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Zone not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the zone
    const deleteSql = 'DELETE FROM zones WHERE id = ?';
    const deleteResult = await env.DB.prepare(deleteSql).bind(id).run();
    
    if (deleteResult.error) {
      throw new Error(`Database error: ${deleteResult.error}`);
    }
    
    // Return success response
    return new Response(null, {
      status: 204
    });
  } catch (error) {
    logError('Error deleting zone:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error deleting zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * List ad events with pagination and filtering
 */
async function listAdEvents(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    
    // Parse query parameters
    const eventType = params.get('event_type');
    const campaignId = params.get('campaign_id');
    const zoneId = params.get('zone_id');
    const country = params.get('country');
    const deviceType = params.get('device_type');
    const startTime = params.get('start_time') ? parseInt(params.get('start_time') ?? '0', 10) : null;
    const endTime = params.get('end_time') ? parseInt(params.get('end_time') ?? '0', 10) : null;
    const limit = parseInt(params.get('limit') ?? '20', 10);
    const offset = parseInt(params.get('offset') ?? '0', 10);
    const sort = params.get('sort') ?? 'event_time';
    const order = params.get('order') ?? 'desc';
    
    // Validate parameters
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: 'Limit must be between 1 and 100' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (offset < 0) {
      return new Response(JSON.stringify({ error: 'Offset must be a non-negative integer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Valid sort fields
    const validSortFields = ['id', 'event_time', 'event_type', 'campaign_id', 'zone_id', 'country', 'device_type'];
    if (!validSortFields.includes(sort)) {
      return new Response(JSON.stringify({ error: 'Invalid sort field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Valid order values
    if (order !== 'asc' && order !== 'desc') {
      return new Response(JSON.stringify({ error: 'Order must be "asc" or "desc"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build SQL query
    let sql = 'SELECT * FROM ad_events';
    const queryParams: (string | number)[] = [];
    const whereClauses: string[] = [];
    
    // Add filters if provided
    if (eventType) {
      whereClauses.push('event_type = ?');
      queryParams.push(eventType);
    }
    
    if (campaignId) {
      whereClauses.push('campaign_id = ?');
      queryParams.push(campaignId);
    }
    
    if (zoneId) {
      whereClauses.push('zone_id = ?');
      queryParams.push(zoneId);
    }
    
    if (country) {
      whereClauses.push('country = ?');
      queryParams.push(country);
    }
    
    if (deviceType) {
      whereClauses.push('device_type = ?');
      queryParams.push(deviceType);
    }
    
    if (startTime) {
      whereClauses.push('event_time >= ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      whereClauses.push('event_time <= ?');
      queryParams.push(endTime);
    }
    
    // Combine WHERE clauses if any
    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    // Add sorting
    sql += ` ORDER BY ${sort} ${order}`;
    
    // Add pagination
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Count total for pagination
    let countSql = 'SELECT COUNT(*) as total FROM ad_events';
    const countParams: (string | number)[] = [];
    
    // Add filters to count query as well
    if (whereClauses.length > 0) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
      countParams.push(...queryParams.slice(0, -2)); // Exclude limit and offset
    }
    
    // Execute queries
    const [eventsResult, countResult] = await Promise.all([
      env.DB.prepare(sql).bind(...(queryParams)).all(),
      env.DB.prepare(countSql).bind(...(countParams)).all()
    ]);
    
    // Handle database errors
    if (eventsResult.error) {
      throw new Error(`Database error: ${eventsResult.error}`);
    }
    
    if (countResult.error) {
      throw new Error(`Database error: ${countResult.error}`);
    }
    
    // Extract results
    const events = eventsResult.results ?? [];
    const total = countResult.results?.[0] ? 
      (countResult.results[0] as { total: number }).total : 0;
    
    // Return paginated response
    return new Response(JSON.stringify({
      ad_events: events,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error listing ad events:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error listing ad events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get aggregated statistics
 */
async function getStats(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    
    // Parse query parameters with defaults
    const fromParam = params.get('from');
    // Use start of day as default
    const startOfDayTimestamp = new Date();
    startOfDayTimestamp.setHours(0, 0, 0, 0);
    const from = fromParam ? parseInt(fromParam, 10) : startOfDayTimestamp.getTime();
    
    const toParam = params.get('to');
    const to = toParam ? parseInt(toParam, 10) : Date.now();
    
    const campaignIdsParam = params.get('campaign_ids');
    const zoneIdsParam = params.get('zone_ids');
    const groupByParam = params.get('group_by') ?? 'date';
    
    // Validate group_by parameter
    const validGroupByValues = ['date', 'campaign_id', 'zone_id', 'country', 'sub_id'];
    if (!validGroupByValues.includes(groupByParam)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid group_by parameter. Valid values are: date, campaign_id, zone_id, country, sub_id' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build SQL query
    const sqlWhereClauses: string[] = [];
    const queryParams: (string | number)[] = [];

    // Add time range filters
    sqlWhereClauses.push('event_time >= ?');
    queryParams.push(from);
    
    sqlWhereClauses.push('event_time <= ?');
    queryParams.push(to);

    // Add campaign filter if provided
    if (campaignIdsParam) {
      const campaignIdList = campaignIdsParam.split(',').map(id => id.trim());
      sqlWhereClauses.push(`campaign_id IN (${campaignIdList.map(() => '?').join(', ')})`);
      queryParams.push(...campaignIdList);
    }

    // Add zone filter if provided
    if (zoneIdsParam) {
      const zoneIdList = zoneIdsParam.split(',').map(id => id.trim());
      sqlWhereClauses.push(`zone_id IN (${zoneIdList.map(() => '?').join(', ')})`);
      queryParams.push(...zoneIdList);
    }

    // Determine group by clause and select statement
    let groupByClause = '';
    let selectClause = '';
    
    switch (groupByParam) {
      case 'date':
        // Group by date using SQLite date function
        groupByClause = "strftime('%Y-%m-%d', datetime(event_time/1000, 'unixepoch'))";
        selectClause = `${groupByClause} as date`;
        break;
      case 'campaign_id':
        groupByClause = 'campaign_id';
        selectClause = 'campaign_id';
        break;
      case 'zone_id':
        groupByClause = 'zone_id';
        selectClause = 'zone_id';
        break;
      case 'country':
        groupByClause = 'country';
        selectClause = 'country';
        break;
      case 'sub_id':
        groupByClause = 'sub_id';
        selectClause = 'sub_id';
        break;
    }
    
    // Build the final SQL query
    const sql = `
      SELECT 
        ${selectClause},
        SUM(CASE WHEN event_type IN ('click', 'unsold', 'fallback') THEN 1 ELSE 0 END) as impressions,
        SUM(CASE WHEN event_type = 'fallback' THEN 1 ELSE 0 END) as fallbacks,
        SUM(CASE WHEN event_type = 'unsold' THEN 1 ELSE 0 END) as unsold,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks
      FROM ad_events
      WHERE ${sqlWhereClauses.join(' AND ')}
      GROUP BY ${groupByClause}
      ORDER BY ${groupByParam === 'campaign_id' || groupByParam === 'zone_id' ? groupByParam : 2} DESC
    `;

    // Execute query
    const result = await env.DB.prepare(sql).bind(...(queryParams)).all();
    
    if (result.error) {
      throw new Error(`Database error: ${result.error}`);
    }

    // Return response
    return new Response(JSON.stringify({
      stats: result.results ?? [],
      period: {
        from,
        to
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error fetching stats:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Error fetching statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Flush the database by truncating zones and campaigns tables.
 * This function is ONLY for demo purposes and should NEVER be used in production.
 * Using this function will result in permanent data loss.
 */
async function flushDatabase(env: Env): Promise<Response> {
  try {
    // Check if this is a demo instance
    if (env.DEMO_INSTANCE !== 'true') {
      return new Response(JSON.stringify({ 
        error: 'This operation is only available on demo instances' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use D1's transaction API instead of SQL BEGIN TRANSACTION
    const results = await env.DB.batch([
      env.DB.prepare('DELETE FROM zones'),
      env.DB.prepare('DELETE FROM campaigns')
    ]);

    // Get deletion counts
    const zonesDeleted = results?.[0]?.meta ? results[0].meta['changes'] || 0 : 0;
    const campaignsDeleted = results?.[1]?.meta ? results[1].meta['changes'] || 0 : 0;

    // Clear KV data as well
    try {
      // First, list all keys in KV
      const kvKeys = await env.campaigns_zones.list();
      
      // Delete each key
      const kvDeletePromises = kvKeys.keys.map(key => 
        env.campaigns_zones.delete(key.name)
      );
      
      // Wait for all deletions to complete
      await Promise.all(kvDeletePromises);
    } catch (kvError) {
      logError('Error clearing KV storage:');
      logError(kvError instanceof Error ? kvError.message : String(kvError));
      // Continue execution even if KV clearing fails
    }

    // Return success response
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Database and KV storage flushed successfully',
      zones_deleted: zonesDeleted,
      campaigns_deleted: campaignsDeleted
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error flushing database:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error flushing database',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * List targeting rules for a specific campaign
 */
async function listCampaignTargetingRules(campaignId: string | undefined, env: Env): Promise<Response> {
  try {
    // Validate ID
    if (campaignId === undefined) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required in the path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query targeting rules for this campaign
    const rulesResult = await env.DB.prepare(`
      SELECT * FROM targeting_rules WHERE campaign_id = ? ORDER BY id ASC
    `).bind(id).all();

    if (rulesResult.error) {
      throw new Error(`Database error fetching targeting rules: ${rulesResult.error}`);
    }

    return new Response(JSON.stringify({ targeting_rules: rulesResult.results ?? [] }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logError('Error listing campaign targeting rules:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: 'Server error listing targeting rules' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Synchronize targeting rules for a specific campaign (create, update, delete)
 */
async function syncCampaignTargetingRules(campaignId: string | undefined, request: Request, env: Env): Promise<Response> {
  try {
    // Validate Campaign ID
    if (campaignId === undefined) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required in the path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if campaign exists
    const campaignExists = await env.DB.prepare(`SELECT id FROM campaigns WHERE id = ?`).bind(id).first('id');
    if (!campaignExists) {
       return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body - expected to be an array of targeting rule objects
    // Rules with an 'id' are existing, rules without 'id' (or null/undefined) are new.
    let incomingRules: TargetingRuleData[];
    try {
      incomingRules = await request.json() as TargetingRuleData[];
      if (!Array.isArray(incomingRules)) {
        throw new Error('Request body must be an array of targeting rules.');
      }
    } catch (e) {
       return new Response(JSON.stringify({ error: `Invalid request body: ${e instanceof Error ? e.message : 'Unknown error'}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- Synchronization Logic ---

    // 1. Fetch current rules from DB
    const currentRulesResult = await env.DB.prepare(`
      SELECT * FROM targeting_rules WHERE campaign_id = ?
    `).bind(id).all<TargetingRuleData>();

    if (currentRulesResult.error) {
      throw new Error(`Database error fetching current rules: ${currentRulesResult.error}`);
    }
    const currentRules = currentRulesResult.results ?? [];
    const currentRuleMap = new Map(currentRules.map(rule => [rule.id, rule]));

    // 2. Prepare D1 Batched Statements
    const statements: D1PreparedStatement[] = [];
    const incomingRuleIds = new Set<number>();
    const now = Date.now(); // Use consistent timestamp for updates/creates

    for (const rule of incomingRules) {
      // Validate incoming rule data (basic validation)
      if (!rule.targeting_rule_type_id || !rule.targeting_method || !rule.rule) {
         return new Response(JSON.stringify({ error: 'Invalid rule data: missing required fields (targeting_rule_type_id, targeting_method, rule)', rule }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
       if (!['whitelist', 'blacklist'].includes(rule.targeting_method)) {
         return new Response(JSON.stringify({ error: 'Invalid targeting_method, must be "whitelist" or "blacklist"', rule }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }


      if (rule.id !== undefined && rule.id !== null) {
        // --- Potential Update ---
        const numericRuleId = Number(rule.id); // Ensure it's a number
        if (isNaN(numericRuleId)) {
          // Handle cases where rule.id is present but not a valid number (edge case)
          return new Response(JSON.stringify({ error: `Invalid rule ID format: ${rule.id}` }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        incomingRuleIds.add(numericRuleId); // Add the definite number
        const currentRule = currentRuleMap.get(numericRuleId);
        if (currentRule) {
          // Check if an update is actually needed
          if (currentRule.targeting_rule_type_id !== rule.targeting_rule_type_id ||
              currentRule.targeting_method !== rule.targeting_method ||
              currentRule.rule !== rule.rule) {
            statements.push(env.DB.prepare(`
              UPDATE targeting_rules
              SET targeting_rule_type_id = ?, targeting_method = ?, rule = ?, updated_at = ?
              WHERE id = ? AND campaign_id = ?
            `).bind(rule.targeting_rule_type_id, rule.targeting_method, rule.rule, now, numericRuleId, id));
          }
        } else {
          // ID provided but doesn't exist in DB for this campaign - treat as error or ignore? Let's error for now.
           return new Response(JSON.stringify({ error: `Rule with ID ${numericRuleId} not found for campaign ${id}` }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
      } else {
        // --- Create ---
        statements.push(env.DB.prepare(`
          INSERT INTO targeting_rules (campaign_id, targeting_rule_type_id, targeting_method, rule, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(id, rule.targeting_rule_type_id, rule.targeting_method, rule.rule, now, now));
      }
    }

    // 3. Determine Deletes
    for (const currentRule of currentRules) {
      // Explicitly check id is defined, even though it should be from DB
      if (currentRule.id !== undefined && !incomingRuleIds.has(currentRule.id)) { 
        statements.push(env.DB.prepare(`
          DELETE FROM targeting_rules WHERE id = ? AND campaign_id = ?
        `).bind(currentRule.id, id));
      }
    }

    // 4. Execute Batch Transaction
    if (statements.length > 0) {
      const batchResult = await env.DB.batch(statements);
      // Note: D1 batch results might need more specific error checking depending on library version/behavior
      for (const result of batchResult) {
        if (result.error) {
           throw new Error(`Batch transaction error: ${result.error}`);
        }
      }
      logMessage(`Synchronized ${statements.length} rule operations for campaign ${id}`);

       // Also update the campaign's updated_at timestamp
       await env.DB.prepare(`UPDATE campaigns SET updated_at = ? WHERE id = ?`).bind(now, id).run();

    } else {
        logMessage(`No rule changes detected for campaign ${id}`);
    }


    // 5. Fetch and return the final state of the rules
    const finalRulesResult = await env.DB.prepare(`
      SELECT * FROM targeting_rules WHERE campaign_id = ? ORDER BY id ASC
    `).bind(id).all();

     if (finalRulesResult.error) {
      // Log error but maybe still return success if batch succeeded? Or rollback?
      // For simplicity, we'll return an error here.
      logError(`Error fetching final rules after sync for campaign ${id}: ${finalRulesResult.error}`);
       return new Response(JSON.stringify({ error: 'Server error retrieving rules after update' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ targeting_rules: finalRulesResult.results ?? [] }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logError('Error syncing campaign targeting rules:');
    logError(error instanceof Error ? error.message : String(error));
     // Consider more specific error codes based on the exception type if needed
    return new Response(JSON.stringify({ error: 'Server error syncing targeting rules' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 

/**
 * List all API keys
 */
async function listApiKeys(request: Request, env: Env): Promise<Response> {
  try {
    // Get all API keys from KV store - using list with prefix
    const keyList = await env.campaigns_zones.list({ prefix: 'api_key:' });
    
    // Process the keys
    const apiKeys = await Promise.all(
      keyList.keys.map(async (key) => {
        // Extract token from key
        const token = key.name.substring(8); // Remove 'api_key:' prefix
        
        // Get the value
        const apiKeyValue = await env.campaigns_zones.get(key.name, 'json') as Record<string, unknown>;
        
        if (!apiKeyValue) {
          return null;
        }
        
        // Format the response
        return {
          token,
          namespace: apiKeyValue['namespace'],
          created_at: apiKeyValue['created_at'],
          expires_at: apiKeyValue['expires_at'],
          permissions: apiKeyValue['permissions']
        };
      })
    );
    
    // Filter out nulls
    const validApiKeys = apiKeys.filter(key => key !== null);
    
    return new Response(JSON.stringify(validApiKeys), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to list API keys' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create a new API key
 */
async function createApiKey(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body
    const data = await request.json() as {
      token: string;
      namespace: string;
      expires_at?: number;
      permissions: string[];
    };
    
    // Validate required fields
    if (!data.token || !data.namespace || !Array.isArray(data.permissions)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Set created_at automatically to current timestamp
    const created_at = Date.now();
    
    // Create value to store in KV
    const apiKeyValue: Record<string, unknown> = {
      namespace: data.namespace,
      created_at,
      permissions: data.permissions
    };
    
    // Add expires_at if provided
    if (data.expires_at) {
      apiKeyValue['expires_at'] = data.expires_at;
    }
    
    // Store in KV
    const key = `api_key:${data.token}`;
    await env.campaigns_zones.put(key, JSON.stringify(apiKeyValue));
    
    return new Response(JSON.stringify({
      token: data.token,
      namespace: data.namespace,
      created_at,
      expires_at: data.expires_at,
      permissions: data.permissions
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create API key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}