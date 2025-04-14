/**
 * Counter Durable Object
 * Handles frequency caps and could be used for real-time analytics
 * 
 * NOTE: While we now store raw click data in D1, this Durable Object
 * is still useful for frequency capping and could be extended for
 * real-time analytics that don't require persistence.
 */

// Interface for impression data
interface ImpressionData {
  campaignId: number;
  zoneId?: number;
  userId?: string;
  timestamp?: number;
}

// Interface for click data
interface ClickData {
  campaignId: number;
  zoneId?: number;
  userId?: string;
  timestamp?: number;
}

// Interface for frequency capping check
interface CappingCheckData {
  campaignId: number;
  userId: string;
  cappingValue?: number;
}

// Interface for statistics response
interface StatsResponse {
  campaignId: string | null;
  zoneId?: string | null;
  date?: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
}

export class CounterDO implements DurableObject {
  private state: DurableObjectState;
  
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();
    
    if (request.method === 'POST') {
      const data = await request.json();
      
      switch (action) {
        case 'impression':
          return await this.recordImpression(data as ImpressionData);
        case 'click':
          return await this.recordClick(data as ClickData);
        case 'check-cap':
          return await this.checkCap(data as CappingCheckData);
        default:
          return new Response('Unknown action', { status: 400 });
      }
    } else if (request.method === 'GET') {
      switch (action) {
        case 'stats':
          return await this.getStats(url.searchParams);
        default:
          return new Response('Unknown action', { status: 400 });
      }
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
  
  /**
   * Record an impression for a campaign
   */
  private async recordImpression(data: ImpressionData): Promise<Response> {
    const { campaignId, zoneId, userId, timestamp = Date.now() } = data;
    
    if (!campaignId) {
      return new Response('Campaign ID required', { status: 400 });
    }
    
    // Increment campaign impression counter
    const campaignKey = `campaign:${campaignId}:impressions`;
    let impressions = await this.state.storage.get(campaignKey) || 0;
    await this.state.storage.put(campaignKey, impressions + 1);
    
    // If zone ID is provided, track zone-specific impressions
    if (zoneId) {
      const zoneKey = `zone:${zoneId}:impressions`;
      let zoneImpressions = await this.state.storage.get(zoneKey) || 0;
      await this.state.storage.put(zoneKey, zoneImpressions + 1);
      
      // Track campaign-zone combination
      const campaignZoneKey = `campaign:${campaignId}:zone:${zoneId}:impressions`;
      let campaignZoneImpressions = await this.state.storage.get(campaignZoneKey) || 0;
      await this.state.storage.put(campaignZoneKey, campaignZoneImpressions + 1);
      
      // Store daily stats
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `daily:${today}:campaign:${campaignId}:zone:${zoneId}:impressions`;
      let dailyImpressions = await this.state.storage.get(dailyKey) || 0;
      await this.state.storage.put(dailyKey, dailyImpressions + 1);
    }
    
    // If user ID is provided, track user-specific impressions for capping
    if (userId) {
      const userKey = `user:${userId}:campaign:${campaignId}:impressions`;
      const userImpressions: number[] = await this.state.storage.get(userKey) || [];
      userImpressions.push(timestamp);
      
      // Only keep impressions from the last 24 hours
      const recentImpressions = userImpressions.filter(
        (ts: number) => ts > Date.now() - 24 * 60 * 60 * 1000
      );
      
      await this.state.storage.put(userKey, recentImpressions);
    }
    
    return new Response('Impression recorded', { status: 200 });
  }
  
  /**
   * Record a click for a campaign
   */
  private async recordClick(data: ClickData): Promise<Response> {
    const { campaignId, zoneId, userId, timestamp = Date.now() } = data;
    
    if (!campaignId) {
      return new Response('Campaign ID required', { status: 400 });
    }
    
    // Increment campaign click counter
    const campaignKey = `campaign:${campaignId}:clicks`;
    let clicks = await this.state.storage.get(campaignKey) || 0;
    await this.state.storage.put(campaignKey, clicks + 1);
    
    // If zone ID is provided, track zone-specific clicks
    if (zoneId) {
      const zoneKey = `zone:${zoneId}:clicks`;
      let zoneClicks = await this.state.storage.get(zoneKey) || 0;
      await this.state.storage.put(zoneKey, zoneClicks + 1);
      
      // Track campaign-zone combination
      const campaignZoneKey = `campaign:${campaignId}:zone:${zoneId}:clicks`;
      let campaignZoneClicks = await this.state.storage.get(campaignZoneKey) || 0;
      await this.state.storage.put(campaignZoneKey, campaignZoneClicks + 1);
      
      // Store daily stats
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `daily:${today}:campaign:${campaignId}:zone:${zoneId}:clicks`;
      let dailyClicks = await this.state.storage.get(dailyKey) || 0;
      await this.state.storage.put(dailyKey, dailyClicks + 1);
    }
    
    // If user ID is provided, track user-specific clicks
    if (userId) {
      const userKey = `user:${userId}:campaign:${campaignId}:clicks`;
      const userClicks: number[] = await this.state.storage.get(userKey) || [];
      userClicks.push(timestamp);
      await this.state.storage.put(userKey, userClicks);
    }
    
    return new Response('Click recorded', { status: 200 });
  }
  
  /**
   * Check if a user has reached frequency cap for a campaign
   */
  private async checkCap(data: CappingCheckData): Promise<Response> {
    const { campaignId, userId, cappingValue = 10 } = data;
    
    if (!campaignId || !userId) {
      return new Response('Campaign ID and User ID required', { status: 400 });
    }
    
    const userKey = `user:${userId}:campaign:${campaignId}:impressions`;
    const userImpressions: number[] = await this.state.storage.get(userKey) || [];
    
    // Only count impressions from the last 24 hours
    const recentImpressions = userImpressions.filter(
      (ts: number) => ts > Date.now() - 24 * 60 * 60 * 1000
    );
    
    const cappedStatus = recentImpressions.length >= cappingValue;
    
    return new Response(JSON.stringify({ 
      capped: cappedStatus,
      impressions: recentImpressions.length,
      limit: cappingValue
    }), { 
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  
  /**
   * Get statistics for a campaign
   */
  private async getStats(params: URLSearchParams): Promise<Response> {
    const campaignId = params.get('campaignId');
    const zoneId = params.get('zoneId');
    const date = params.get('date');
    
    if (!campaignId) {
      return new Response('Campaign ID required', { status: 400 });
    }
    
    let impressions = 0;
    let clicks = 0;
    let ctr = 0;
    
    if (zoneId && date) {
      // Get daily stats for specific campaign-zone combination
      const impressionsKey = `daily:${date}:campaign:${campaignId}:zone:${zoneId}:impressions`;
      const clicksKey = `daily:${date}:campaign:${campaignId}:zone:${zoneId}:clicks`;
      
      impressions = await this.state.storage.get(impressionsKey) || 0;
      clicks = await this.state.storage.get(clicksKey) || 0;
    } else if (zoneId) {
      // Get total stats for specific campaign-zone combination
      const impressionsKey = `campaign:${campaignId}:zone:${zoneId}:impressions`;
      const clicksKey = `campaign:${campaignId}:zone:${zoneId}:clicks`;
      
      impressions = await this.state.storage.get(impressionsKey) || 0;
      clicks = await this.state.storage.get(clicksKey) || 0;
    } else {
      // Get total campaign stats
      impressions = await this.state.storage.get(`campaign:${campaignId}:impressions`) || 0;
      clicks = await this.state.storage.get(`campaign:${campaignId}:clicks`) || 0;
    }
    
    ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    
    const response: StatsResponse = {
      campaignId,
      zoneId,
      date,
      impressions,
      clicks,
      ctr
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
} 