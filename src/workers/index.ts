/**
 * Lite Ad Server - Cloudflare Worker Entry Point
 */

// Note: We're not using CounterDO currently, but leaving the import for future frequency capping
import { TargetingRule } from '../models/TargetingRule';
import { CounterDO } from './counter';
import { TargetingMethod } from '../models/Campaign';
import { parseAndValidateId, parseId, isValidId } from '../utils/idValidation';

// Re-export the CounterDO class needed by the Durable Object binding
export { CounterDO };

export interface Env {
  // D1 Database
  DB: D1Database;
  // Durable Objects
  COUNTER: DurableObjectNamespace;
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
  // To be implemented: API for managing campaigns, zones, etc.
  return new Response('API not implemented yet', { status: 501 });
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
             tr.targeting_rule_type_id, tr.targeting_method, tr.rule, tr.weight
      FROM campaigns c
      JOIN targeting_rules tr ON tr.campaign_id = c.id
      JOIN targeting_rule_types trt ON tr.targeting_rule_type_id = trt.id
      WHERE c.status = 'active'
      AND c.start_date <= unixepoch() 
      AND (c.end_date IS NULL OR c.end_date >= unixepoch())
      AND trt.name = 'Zone ID'
      AND tr.targeting_method = 'whitelist'
      AND (tr.rule = ? OR tr.rule LIKE ? OR tr.rule LIKE ? OR tr.rule LIKE ?)
      ORDER BY tr.weight DESC
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
        weight: number;
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
          weight: rowData.weight,
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