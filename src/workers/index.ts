/**
 * Lite Ad Server - Cloudflare Worker Entry Point
 */

// Note: We're not using CounterDO currently, but leaving the import for future frequency capping
import { TargetingRule } from '../models/TargetingRule';
import { CounterDO } from './counter';
import { TargetingMethod } from '../models/Campaign';
import { parseAndValidateId, parseId, isValidId } from '../utils/idValidation';
import { ensureString, ensureArray } from '../utils/typeGuards';

// Re-export the CounterDO class needed by the Durable Object binding
export { CounterDO };

export interface Env {
  // D1 Database
  DB: D1Database;
  // Durable Objects
  COUNTER: DurableObjectNamespace;
  // API Key
  API_KEY?: string;
}

// Campaign with targeting rules for selection
interface CampaignDetail {
  id: number;
  name: string;
  redirect_url: string;
  status: string;
  targeting_rules: TargetingRule[];
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx);
    }
    
    // Ad serving route
    if (url.pathname.startsWith('/serve/')) {
      return handleAdServing(request, env, ctx);
    }
    
    // Tracking route
    if (url.pathname.startsWith('/track/')) {
      return handleTracking(request, env, ctx);
    }
    
    // Default response
    return new Response('Lite Ad Server', {
      headers: { 'content-type': 'text/plain' },
    });
  },
};

/**
 * Handle API requests
 */
async function handleApiRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  
  // API Authentication
  // Basic check for API key in Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  const apiKey = env.API_KEY || 'test-api-key-1234567890';
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== apiKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized. API key required' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Handle campaigns routes
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
  
  // Handle stats routes (to be implemented)
  if (path.startsWith('/api/stats')) {
    return new Response(JSON.stringify({ error: 'Stats API not implemented yet' }), { 
      status: 501,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  return new Response(JSON.stringify({ error: 'API endpoint not found' }), { 
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
    const limit = parseInt(params.get('limit') || '20', 10);
    const offset = parseInt(params.get('offset') || '0', 10);
    const sort = params.get('sort') || 'created_at';
    const order = params.get('order') || 'desc';
    
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
    const queryParams: any[] = [];
    
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
    const countParams: any[] = [];
    
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
    const campaigns = campaignsResult.results || [];
    const total = countResult.results && countResult.results[0] ? 
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
    console.error('Error listing campaigns:', error);
    return new Response(JSON.stringify({ error: 'Server error listing campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get campaign by ID
 */
async function getCampaign(campaignId: string, env: Env): Promise<Response> {
  try {
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
    
    const campaign = campaignResult.results[0] as Record<string, any>;
    
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
      targeting_rules: rulesResult.results || []
    };
    
    return new Response(JSON.stringify(campaignWithRules), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting campaign:', error);
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
    const campaignData = await request.json();
    
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
    
    if (!campaignData.start_date || typeof campaignData.start_date !== 'number') {
      return new Response(JSON.stringify({ error: 'Start date is required' }), {
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
      campaignData.start_date,
      campaignData.end_date || null,
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
    const campaignId = result.meta?.last_row_id;
    
    if (!campaignId) {
      throw new Error('Failed to get inserted campaign ID');
    }
    
    // Insert targeting rules for the campaign
    const ruleInsertions = campaignData.targeting_rules.map((rule: any) => {
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
    console.error('Error creating campaign:', error);
    return new Response(JSON.stringify({ error: 'Server error creating campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update an existing campaign
 */
async function updateCampaign(campaignId: string, request: Request, env: Env): Promise<Response> {
  try {
    // Validate ID
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse request body
    let updateData: {
      name?: string;
      redirect_url?: string;
      status?: string;
      traffic_back_url?: string;
      start_date?: number;
      end_date?: number | null;
    };
    
    try {
      updateData = await request.json();
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
    const params: any[] = [];
    
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
    console.error('Error updating campaign:', error);
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
function validateCampaignUpdateData(data: any): string | null {
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
  if ('start_date' in data && (typeof data.start_date !== 'number' || data.start_date <= 0)) {
    return 'Start date must be a positive number (timestamp)';
  }
  
  // Validate end_date if provided
  if ('end_date' in data) {
    if (data.end_date !== null && (typeof data.end_date !== 'number' || data.end_date <= 0)) {
      return 'End date must be a positive number (timestamp) or null';
    }
    
    // If both start_date and end_date are provided, ensure end_date is after start_date
    if (data.end_date && 'start_date' in data && data.end_date <= data.start_date) {
      return 'End date must be after start date';
    }
  }
  
  return null;
}

/**
 * Delete a campaign
 */
async function deleteCampaign(campaignId: string, env: Env): Promise<Response> {
  try {
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
    console.error('Error deleting campaign:', error);
    return new Response(JSON.stringify({ error: 'Server error deleting campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle ad serving requests
 */
async function handleAdServing(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle trailing slashes by removing them
  const path = url.pathname.endsWith('/') 
    ? url.pathname.slice(0, -1) 
    : url.pathname;
    
  const zoneId = path.split('/').pop() || '';
  
  if (!zoneId) {
    return new Response('Zone ID required', { status: 400 });
  }
  
  try {
    // Fetch eligible campaigns based on zone targeting
    const campaigns = await fetchEligibleCampaigns(env.DB, zoneId, request);
    
    if (!campaigns || campaigns.length === 0) {
      // If no campaigns are eligible, check if zone has a traffic back URL
      const zone = await fetchZone(env.DB, zoneId);
      
      if (zone && zone.traffic_back_url) {
        // Redirect to traffic back URL
        return Response.redirect(zone.traffic_back_url, 302);
      }
      
      return new Response('No eligible campaigns', { status: 404 });
    }
    
    // Select a campaign based on targeting rules and weights
    const selectedCampaign = selectCampaign(campaigns, request);
    
    if (!selectedCampaign) {
      return new Response('No suitable campaign found', { status: 404 });
    }
    
    // Generate a tracking URL
    const trackingUrl = generateTrackingUrl(request, selectedCampaign.id, zoneId);
    
    // Return a redirect to the tracking URL
    return Response.redirect(trackingUrl, 302);
  } catch (error) {
    console.error('Error serving ad:', error);
    return new Response('Server error', { status: 500 });
  }
}

/**
 * Handle tracking requests (clicks)
 */
async function handleTracking(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle trailing slashes by removing them
  const path = url.pathname.endsWith('/') 
    ? url.pathname.slice(0, -1) 
    : url.pathname;
    
  const parts = path.split('/');
  const trackType = parts[2]; // /track/{type}/{id}
  const campaignId = parts[3] || '';
  const zoneId = parts[4] || '';
  
  if (!trackType || !campaignId) {
    return new Response('Invalid tracking URL', { status: 400 });
  }
  
  try {
    if (trackType === 'click') {
      // Track click in database
      await recordClick(env.DB, {
        campaign_id: campaignId,
        zone_id: zoneId,
        ip: request.headers.get('CF-Connecting-IP') || undefined,
        user_agent: request.headers.get('User-Agent') || undefined,
        referer: request.headers.get('Referer') || undefined,
        country: request.headers.get('CF-IPCountry') || undefined,
        device_type: detectDeviceType(request.headers.get('User-Agent') || ''),
        timestamp: Date.now()
      });
      
      // Fetch campaign redirect URL
      const campaign = await fetchCampaign(env.DB, campaignId);
      
      if (!campaign || !campaign.redirect_url) {
        return new Response('Invalid campaign', { status: 404 });
      }
      
      // Redirect to campaign URL
      return Response.redirect(campaign.redirect_url, 302);
    }
    
    return new Response('Unknown tracking type', { status: 400 });
  } catch (error) {
    console.error('Error tracking:', error);
    return new Response('Server error', { status: 500 });
  }
}

/**
 * Fetch eligible campaigns based on zone targeting
 */
async function fetchEligibleCampaigns(db: D1Database, zoneId: string, request: Request): Promise<CampaignDetail[]> {
  try {
    // Convert zoneId to number since we're using numeric IDs
    const zoneIdNum = parseAndValidateId(zoneId, 'zone');
    if (zoneIdNum === null) {
      return [];
    }

    // Query for active campaigns that target this zone
    const result = await db.prepare(`
      SELECT c.id, c.name, c.redirect_url, c.status, tr.id as rule_id, 
             tr.targeting_rule_type_id, tr.targeting_method, tr.rule
      FROM campaigns c
      JOIN targeting_rules tr ON tr.campaign_id = c.id
      JOIN targeting_rule_types trt ON tr.targeting_rule_type_id = trt.id
      WHERE c.status = 'active'
      AND c.start_date <= unixepoch() 
      AND (c.end_date IS NULL OR c.end_date >= unixepoch())
      AND trt.name = 'Zone ID'
      AND tr.targeting_method = 'whitelist'
      AND (tr.rule = ? OR tr.rule LIKE ? OR tr.rule LIKE ? OR tr.rule LIKE ?)
    `).bind(
      zoneIdNum.toString(),
      `${zoneIdNum},%`,
      `%,${zoneIdNum},%`,
      `%,${zoneIdNum}`
    ).all();

    if (!result.results || result.results.length === 0) {
      return [];
    }

    // Group targeting rules by campaign
    const campaignMap = new Map<number, CampaignDetail>();
    
    for (const row of result.results) {
      // Type assertion to access properties
      const rowData = row as {
        id: number;
        name: string;
        redirect_url: string;
        status: string;
        rule_id: number;
        targeting_rule_type_id: number;
        targeting_method: string;
        rule: string;
      };
      
      const campaignId = rowData.id;
      
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          id: campaignId,
          name: rowData.name,
          redirect_url: rowData.redirect_url,
          status: rowData.status,
          targeting_rules: []
        });
      }
      
      const campaign = campaignMap.get(campaignId);
      if (campaign) {
        campaign.targeting_rules.push({
          id: rowData.rule_id,
          campaign_id: campaignId,
          targeting_rule_type_id: rowData.targeting_rule_type_id,
          targeting_method: rowData.targeting_method as TargetingMethod,
          rule: rowData.rule,
          created_at: 0, // We don't need these for selection
          updated_at: 0  // We don't need these for selection
        });
      }
    }
    
    return Array.from(campaignMap.values());
  } catch (error) {
    console.error('Error fetching eligible campaigns:', error);
    return [];
  }
}

/**
 * Select a campaign based on targeting rules and weights
 */
function selectCampaign(campaigns: CampaignDetail[], request: Request): CampaignDetail | null {
  if (campaigns.length === 0) {
    return null;
  }
  
  // Apply targeting rules filtering logic here
  // For example, filter by geo, device_type, etc.
  
  // For now, just select the first campaign as demo
  return campaigns[0] || null;
}

/**
 * Generate a tracking URL for click redirection
 */
function generateTrackingUrl(request: Request, campaignId: number, zoneId: string): string {
  const baseUrl = new URL(request.url);
  // Ensure no trailing slash in the pathname
  baseUrl.pathname = `/track/click/${campaignId}/${zoneId}`;
  baseUrl.search = '';
  return baseUrl.toString();
}

/**
 * Record a click in the database
 */
async function recordClick(db: D1Database, clickData: {
  campaign_id: string | number,
  zone_id: string | number,
  ip?: string,
  user_agent?: string,
  referer?: string,
  country?: string,
  device_type?: string,
  timestamp: number
}): Promise<void> {
  try {
    // Convert IDs to numbers for numeric IDs
    const campaignIdNum = parseId(clickData.campaign_id);
    const zoneIdNum = parseId(clickData.zone_id);
    
    if (!isValidId(campaignIdNum) || !isValidId(zoneIdNum)) {
      console.error('Invalid ID format in click data:', clickData);
      return;
    }
    
    await db.prepare(`
      INSERT INTO clicks (campaign_id, zone_id, ip, user_agent, referer, country, device_type, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      campaignIdNum,
      zoneIdNum,
      clickData.ip || null,
      clickData.user_agent || null,
      clickData.referer || null,
      clickData.country || null,
      clickData.device_type || null,
      clickData.timestamp
    ).run();
    
    console.log('Click recorded for campaign', campaignIdNum, 'zone', zoneIdNum);
  } catch (error) {
    console.error('Error recording click:', error);
  }
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) {
    return 'mobile';
  } else if (/tablet/i.test(userAgent)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Fetch zone details
 */
async function fetchZone(db: D1Database, zoneId: string): Promise<{ id: number; traffic_back_url?: string } | null> {
  try {
    // Convert zoneId to number for numeric ID
    const zoneIdNum = parseAndValidateId(zoneId, 'zone');
    if (zoneIdNum === null) {
      return null;
    }
    
    const result = await db.prepare(`
      SELECT id, traffic_back_url
      FROM zones
      WHERE id = ? AND status = 'active'
    `).bind(zoneIdNum).first();
    
    if (!result) {
      return null;
    }
    
    // Type assertion for result
    const zone = result as { id: number; traffic_back_url?: string };
    
    return {
      id: zone.id,
      traffic_back_url: zone.traffic_back_url
    };
  } catch (error) {
    console.error('Error fetching zone:', error);
    return null;
  }
}

/**
 * Fetch campaign details by ID
 */
async function fetchCampaign(db: D1Database, campaignId: string | number): Promise<{ id: number; redirect_url: string } | null> {
  try {
    // Convert campaignId to number if it's a string
    const campaignIdNum = parseAndValidateId(campaignId, 'campaign');
    if (campaignIdNum === null) {
      return null;
    }

    const result = await db.prepare(`
      SELECT id, redirect_url
      FROM campaigns
      WHERE id = ?
    `).bind(campaignIdNum).first();
    
    if (!result) {
      return null;
    }
    
    // Type assertion for result
    const campaign = result as { id: number; redirect_url: string };
    
    return {
      id: campaign.id,
      redirect_url: campaign.redirect_url
    };
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return null;
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
      targeting_rule_types: result.results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error listing targeting rule types:', error);
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
    const limit = parseInt(params.get('limit') || '20', 10);
    const offset = parseInt(params.get('offset') || '0', 10);
    const sort = params.get('sort') || 'created_at';
    const order = params.get('order') || 'desc';
    
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
    const queryParams: any[] = [];
    
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
    const countParams: any[] = [];
    
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
    const zones = zonesResult.results || [];
    const total = countResult.results && countResult.results[0] ? 
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
    console.error('Error listing zones:', error);
    return new Response(JSON.stringify({ error: 'Server error listing zones' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get zone by ID
 */
async function getZone(zoneId: string, env: Env): Promise<Response> {
  try {
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
    
    const zones = result.results || [];
    
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
    console.error('Error fetching zone:', error);
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
    const data = await request.json();
    
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
      site_url: data.site_url || null,
      traffic_back_url: data.traffic_back_url || null,
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
      id: result.meta?.last_row_id,
      status: zone.status,
      created_at: zone.created_at
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    return new Response(JSON.stringify({ error: 'Server error creating zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update an existing zone
 */
async function updateZone(zoneId: string, request: Request, env: Env): Promise<Response> {
  try {
    // Validate ID
    const id = parseAndValidateId(zoneId, 'zone');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid zone ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse request body
    const data = await request.json();
    
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
    const params: any[] = [];
    
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
    const updateResult = await env.DB.prepare(updateSql).bind(...params).run();
    
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
    console.error('Error updating zone:', error);
    return new Response(JSON.stringify({ error: 'Server error updating zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Validate zone update data
 */
function validateZoneUpdateData(data: any): string | null {
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
async function deleteZone(zoneId: string, env: Env): Promise<Response> {
  try {
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
    console.error('Error deleting zone:', error);
    return new Response(JSON.stringify({ error: 'Server error deleting zone' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 