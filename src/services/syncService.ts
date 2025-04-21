import type { KVNamespace } from '@cloudflare/workers-types';
import { parseAndValidateId } from '../utils/idValidation';
import { hasValidAuthorization } from '../utils/auth';
import type { Env } from '../models/interfaces';

/**
 * Type for the environment with required bindings for sync operations
 */
export interface SyncEnv extends Env {
  DB: D1Database;
  campaigns_zones: KVNamespace;
}

// A logger function that's compatible with linting rules
function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

/**
 * Type for campaign data
 */
interface Campaign {
  id: number;
  name: string;
  redirect_url: string;
  status: string;
  start_date?: number;
  end_date?: number;
  targeting_rules: TargetingRule[];
  [key: string]: unknown;
}

/**
 * Type for targeting rule data
 */
interface TargetingRule {
  targeting_rule_type_id: number;
  targeting_method: string;
  rule: string;
  campaign_id?: number;
  [key: string]: unknown;
}

/**
 * Handle sync API requests
 */
export async function handleSyncApiRequests(request: Request, env: SyncEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  const pathParts = path.split('/').filter(Boolean); // Remove empty strings
  
  // Check if the request has valid authorization
  if (!hasValidAuthorization(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // GET /api/sync/state - Get current state of KV data
  if (path === '/api/sync/state' && request.method === 'GET') {
    return await getSyncState(env);
  }
  
  // POST /api/sync - Sync all campaigns and zones
  if (path === '/api/sync' && request.method === 'POST') {
    return await syncAll(env);
  }
  
  // POST /api/sync/campaigns - Sync all campaigns
  if (path === '/api/sync/campaigns' && request.method === 'POST') {
    return await syncAllCampaigns(env);
  }
  
  // POST /api/sync/zones - Sync all zones
  if (path === '/api/sync/zones' && request.method === 'POST') {
    return await syncAllZones(env);
  }
  
  // POST /api/sync/campaigns/:id - Sync a specific campaign
  if (pathParts.length === 4 && pathParts[1] === 'sync' && pathParts[2] === 'campaigns' && request.method === 'POST') {
    const campaignId = pathParts[3];
    if (campaignId === undefined) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return await syncCampaign(campaignId, env);
  }
  
  // POST /api/sync/zones/:id - Sync a specific zone
  if (pathParts.length === 4 && pathParts[1] === 'sync' && pathParts[2] === 'zones' && request.method === 'POST') {
    const zoneId = pathParts[3];
    if (zoneId === undefined) {
      return new Response(JSON.stringify({ error: 'Zone ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return await syncZone(zoneId, env);
  }
  
  return new Response(JSON.stringify({ error: 'Sync API endpoint not found' }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * Sync all campaigns and zones from D1 to KV
 */
export async function syncAll(env: SyncEnv): Promise<Response> {
  try {
    // Create dedicated functions that return responses without undefined values
    const syncCampaignsResponse = await syncAllCampaigns(env);
    const syncZonesResponse = await syncAllZones(env);
    
    // Get the status codes and response bodies
    const campaignsStatus = syncCampaignsResponse.status;
    const zonesStatus = syncZonesResponse.status;
    
    const campaignsData = await syncCampaignsResponse.json() as Record<string, unknown>;
    const zonesData = await syncZonesResponse.json() as Record<string, unknown>;
    
    // If either operation failed, return error response
    if (campaignsStatus !== 200 || zonesStatus !== 200) {
      return new Response(JSON.stringify({
        success: false,
        campaigns: campaignsData,
        zones: zonesData
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Success response
    return new Response(JSON.stringify({
      success: true,
      campaigns: campaignsData,
      zones: zonesData
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error syncing all data:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error syncing all data',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sync all active campaigns from D1 to KV
 */
export async function syncAllCampaigns(env: SyncEnv): Promise<Response> {
  try {
    // Get current timestamp in milliseconds
    const now = Date.now();
    
    // Fetch all active campaigns with targeting rules
    const campaignsResult = await env.DB.prepare(`
      SELECT c.id, c.name, c.redirect_url, c.status, c.start_date, c.end_date
      FROM campaigns c
      WHERE c.status = 'active'
      AND (c.start_date IS NULL OR c.start_date <= ?)
      AND (c.end_date IS NULL OR c.end_date >= ?)
    `).bind(now, now).all();
    
    if (campaignsResult.error) {
      throw new Error(`Database error: ${campaignsResult.error}`);
    }
    
    const campaigns = campaignsResult.results ?? [];
    
    // Get targeting rules for all active campaigns
    if (campaigns.length > 0) {
      const campaignIds = campaigns.map(campaign => (campaign as { id: number }).id);
      
      // Get rules for all campaigns
      const rulesResult = await env.DB.prepare(`
        SELECT 
          campaign_id, 
          targeting_rule_type_id, 
          targeting_method, 
          rule
        FROM 
          targeting_rules
        WHERE 
          campaign_id IN (${campaignIds.map(() => '?').join(',')})
      `).bind(...campaignIds).all();
      
      if (rulesResult.error) {
        throw new Error(`Database error: ${rulesResult.error}`);
      }
      
      const rules = rulesResult.results ?? [];
      
      // Organize rules by campaign
      const rulesByCampaign = rules.reduce<Record<number, TargetingRule[]>>((acc, rule) => {
        const campaignId = (rule as TargetingRule).campaign_id;
        if (campaignId !== undefined) {
          if (!acc[campaignId]) {
            acc[campaignId] = [];
          }
          acc[campaignId].push(rule as TargetingRule);
        }
        return acc;
      }, {});
      
      // Add targeting rules to each campaign
      for (const campaign of campaigns) {
        const campaignId = (campaign as { id: number }).id;
        (campaign as Campaign).targeting_rules = rulesByCampaign[campaignId] ?? [];
      }
    }
    
    // Store in KV - this replaces all campaigns with just the active ones
    await env.campaigns_zones.put('campaigns', JSON.stringify(campaigns));
    
    return new Response(JSON.stringify({
      success: true,
      synced_campaigns: campaigns.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error syncing campaigns:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error syncing campaigns',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sync all active zones from D1 to KV
 */
export async function syncAllZones(env: SyncEnv): Promise<Response> {
  try {
    // Fetch all active zones
    const zonesResult = await env.DB.prepare(`
      SELECT id, name, traffic_back_url
      FROM zones
      WHERE status = 'active'
    `).all();
    
    if (zonesResult.error) {
      throw new Error(`Database error: ${zonesResult.error}`);
    }
    
    const zones = zonesResult.results ?? [];
    const activeZoneIds = new Set(zones.map(zone => (zone as { id: number }).id));
    
    // Get all existing zone keys from KV
    const existingKeys = await env.campaigns_zones.list();
    const existingZoneKeys = existingKeys.keys
      .filter(key => key.name && key.name.startsWith('zones:'))
      .map(key => key.name as string);
    
    // Delete zones that exist in KV but not in D1
    const deletePromises = existingZoneKeys.map(async key => {
      const zoneId = parseInt(key.split(':')[1], 10);
      if (!activeZoneIds.has(zoneId)) {
        return env.campaigns_zones.delete(key);
      }
      return Promise.resolve();
    });
    
    // Store each active zone in its own KV key
    const putPromises = zones.map(zone => {
      const zoneId = (zone as { id: number }).id;
      return env.campaigns_zones.put(`zones:${zoneId}`, JSON.stringify({
        id: zoneId,
        traffic_back_url: (zone as { traffic_back_url?: string }).traffic_back_url
      }));
    });
    
    // Wait for all operations to complete
    await Promise.all([...deletePromises, ...putPromises]);
    
    return new Response(JSON.stringify({
      success: true,
      synced_zones: zones.length,
      deleted_zones: deletePromises.length - zones.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error syncing zones:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error syncing zones',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sync a specific campaign from D1 to KV
 */
export async function syncCampaign(campaignId: string, env: SyncEnv): Promise<Response> {
  try {
    // Validate ID
    const id = parseAndValidateId(campaignId, 'campaign');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid campaign ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get current timestamp in milliseconds
    const now = Date.now();
    
    // Get all campaigns from KV
    const campaignsJson = await env.campaigns_zones.get('campaigns');
    let campaigns: Campaign[] = [];
    
    if (campaignsJson) {
      try {
        campaigns = JSON.parse(campaignsJson) as Campaign[];
      } catch (e) {
        logError('Error parsing campaigns JSON from KV:');
        logError(e instanceof Error ? e.message : String(e));
        campaigns = [];
      }
    }
    
    // Fetch the specific campaign with targeting rules
    const campaignResult = await env.DB.prepare(`
      SELECT c.id, c.name, c.redirect_url, c.status, c.start_date, c.end_date
      FROM campaigns c
      WHERE c.id = ?
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
    
    const campaign = campaignResult.results[0] as Campaign;
    
    // Get targeting rules for the campaign
    const rulesResult = await env.DB.prepare(`
      SELECT 
        targeting_rule_type_id, 
        targeting_method, 
        rule
      FROM 
        targeting_rules
      WHERE 
        campaign_id = ?
    `).bind(id).all();
    
    if (rulesResult.error) {
      throw new Error(`Database error: ${rulesResult.error}`);
    }
    
    // Add targeting rules to the campaign
    campaign.targeting_rules = rulesResult.results as TargetingRule[] ?? [];
    
    // Check if campaign should be active based on dates
    const isActive = 
      (campaign.status === 'active') && 
      (!campaign.start_date || campaign.start_date <= now) &&
      (!campaign.end_date || campaign.end_date >= now);
    
    // Update the campaigns list for KV
    // Remove existing campaign with this ID if present
    campaigns = campaigns.filter((c: Campaign) => c.id !== id);
    
    // Add campaign if it's active
    if (isActive) {
      campaigns.push(campaign);
    }
    
    // Store updated campaign list in KV
    await env.campaigns_zones.put('campaigns', JSON.stringify(campaigns));
    
    return new Response(JSON.stringify({
      success: true,
      campaign_id: id,
      active: isActive,
      included_in_kv: isActive
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error syncing campaign:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error syncing campaign',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sync a specific zone from D1 to KV
 */
export async function syncZone(zoneId: string, env: SyncEnv): Promise<Response> {
  try {
    // Validate ID
    const id = parseAndValidateId(zoneId, 'zone');
    if (id === null) {
      return new Response(JSON.stringify({ error: 'Invalid zone ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Fetch the specific zone
    const zoneResult = await env.DB.prepare(`
      SELECT id, name, traffic_back_url, status
      FROM zones
      WHERE id = ?
    `).bind(id).all();
    
    if (zoneResult.error) {
      throw new Error(`Database error: ${zoneResult.error}`);
    }
    
    if (!zoneResult.results || zoneResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Zone not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const zone = zoneResult.results[0] as { 
      id: number; 
      name: string; 
      traffic_back_url?: string; 
      status: string 
    };
    const isActive = zone.status === 'active';
    
    if (isActive) {
      // Store zone in KV
      await env.campaigns_zones.put(`zones:${id}`, JSON.stringify({
        id,
        traffic_back_url: zone.traffic_back_url ?? null
      }));
    } else {
      // Delete zone from KV if it exists but is not active
      await env.campaigns_zones.delete(`zones:${id}`);
    }
    
    return new Response(JSON.stringify({
      success: true,
      zone_id: id,
      active: isActive,
      included_in_kv: isActive
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error syncing zone:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error syncing zone',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get the current state of campaigns and zones in KV
 */
export async function getSyncState(env: SyncEnv): Promise<Response> {
  try {
    // Get campaigns from KV
    const campaignsJson = await env.campaigns_zones.get('campaigns');
    const campaigns: Campaign[] = campaignsJson ? JSON.parse(campaignsJson) as Campaign[] : [];
    
    // List all KV keys to find zone entries
    const keys = await env.campaigns_zones.list();
    
    // Filter zone keys and get their values
    const zoneKeys = keys.keys.filter(key => key.name.startsWith('zones:'));
    
    const zonesPromises = zoneKeys.map(async key => {
      const zoneData = await env.campaigns_zones.get(key.name);
      return zoneData ? JSON.parse(zoneData) as Record<string, unknown> : null;
    });
    
    const zones = await Promise.all(zonesPromises);
    
    // Return the status response
    return new Response(JSON.stringify({
      campaigns: {
        count: campaigns.length,
        data: campaigns
      },
      zones: {
        count: zones.length,
        data: zones
      },
      last_updated: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('Error getting sync state:');
    logError(error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ 
      error: 'Server error getting sync state',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 