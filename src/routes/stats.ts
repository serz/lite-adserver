import { FastifyInstance } from 'fastify';
import { ClickStats } from '../models/Click';

/**
 * Statistics routes
 */
export async function statRoutes(fastify: FastifyInstance) {
  /**
   * Get campaign stats
   */
  fastify.get('/campaigns/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { start, end } = request.query as { start?: string; end?: string };
    
    const startDate = start ? new Date(start).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endDate = end ? new Date(end).getTime() : Date.now();
    
    // Mock stats response
    return {
      campaign_id: id,
      total_clicks: 250,
      by_country: [
        {
          country: 'US',
          clicks: 120,
          percentage: 48
        },
        {
          country: 'CA',
          clicks: 80,
          percentage: 32
        },
        {
          country: 'GB',
          clicks: 50,
          percentage: 20
        }
      ],
      by_device: [
        {
          device_type: 'desktop',
          clicks: 150,
          percentage: 60
        },
        {
          device_type: 'mobile',
          clicks: 80,
          percentage: 32
        },
        {
          device_type: 'tablet',
          clicks: 20,
          percentage: 8
        }
      ],
      clicks_by_day: [
        {
          date: '2023-10-25',
          clicks: 35
        },
        {
          date: '2023-10-26',
          clicks: 42
        },
        {
          date: '2023-10-27',
          clicks: 38
        }
      ],
      period: {
        start: new Date(startDate).toISOString().split('T')[0],
        end: new Date(endDate).toISOString().split('T')[0]
      }
    };
  });

  /**
   * Get zone stats
   */
  fastify.get('/zones/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { start, end } = request.query as { start?: string; end?: string };
    
    const startDate = start ? new Date(start).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endDate = end ? new Date(end).getTime() : Date.now();
    
    // Mock stats response
    return {
      zone_id: id,
      total_clicks: 580,
      campaign_stats: [
        {
          campaign_id: 'campaign1',
          campaign_name: 'Test Campaign',
          clicks: 250
        },
        {
          campaign_id: 'campaign2',
          campaign_name: 'Another Campaign',
          clicks: 330
        }
      ],
      by_country: [
        {
          country: 'US',
          clicks: 290,
          percentage: 50
        },
        {
          country: 'CA',
          clicks: 174,
          percentage: 30
        },
        {
          country: 'GB',
          clicks: 116,
          percentage: 20
        }
      ],
      clicks_by_day: [
        {
          date: '2023-10-25',
          clicks: 85
        },
        {
          date: '2023-10-26',
          clicks: 82
        },
        {
          date: '2023-10-27',
          clicks: 88
        }
      ],
      period: {
        start: new Date(startDate).toISOString().split('T')[0],
        end: new Date(endDate).toISOString().split('T')[0]
      }
    };
  });

  /**
   * Get summary stats
   */
  fastify.get('/summary', async (request) => {
    const { start, end } = request.query as { start?: string; end?: string };
    
    const startDate = start ? new Date(start).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endDate = end ? new Date(end).getTime() : Date.now();
    
    // Mock summary stats
    return {
      total_clicks: 3250,
      active_campaigns: 12,
      active_zones: 8,
      top_campaigns: [
        {
          campaign_id: 'campaign1',
          campaign_name: 'Test Campaign',
          clicks: 980
        },
        {
          campaign_id: 'campaign2',
          campaign_name: 'Another Campaign',
          clicks: 720
        },
        {
          campaign_id: 'campaign3',
          campaign_name: 'Third Campaign',
          clicks: 550
        }
      ],
      top_zones: [
        {
          zone_id: 'zone1',
          zone_name: 'Homepage Banner',
          clicks: 1200
        },
        {
          zone_id: 'zone2',
          zone_name: 'Sidebar Ad',
          clicks: 950
        }
      ],
      by_country: [
        {
          country: 'US',
          clicks: 1625,
          percentage: 50
        },
        {
          country: 'CA',
          clicks: 975,
          percentage: 30
        },
        {
          country: 'GB',
          clicks: 650,
          percentage: 20
        }
      ],
      period: {
        start: new Date(startDate).toISOString().split('T')[0],
        end: new Date(endDate).toISOString().split('T')[0]
      }
    };
  });
  
  /**
   * Get raw click data
   */
  fastify.get('/clicks', async (request) => {
    const { campaign_id, zone_id, country, device_type, start, end, limit, offset } = 
      request.query as { 
        campaign_id?: string; 
        zone_id?: string; 
        country?: string; 
        device_type?: string;
        start?: string;
        end?: string;
        limit?: string;
        offset?: string;
      };
    
    const startDate = start ? new Date(start).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endDate = end ? new Date(end).getTime() : Date.now();
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    // Mock raw click data
    return {
      clicks: [
        {
          id: 'click1',
          campaign_id: 'campaign1',
          zone_id: 'zone1',
          country: 'US',
          device_type: 'desktop',
          timestamp: Date.now() - 3600000, // 1 hour ago
          ip: '192.168.1.1', // Masked for privacy in a real implementation
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          referer: 'https://example.com/page1'
        },
        {
          id: 'click2',
          campaign_id: 'campaign1',
          zone_id: 'zone1',
          country: 'CA',
          device_type: 'mobile',
          timestamp: Date.now() - 7200000, // 2 hours ago
          ip: '192.168.1.2',
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          referer: 'https://example.com/page2'
        }
      ],
      total: 2,
      filter: {
        campaign_id,
        zone_id,
        country,
        device_type,
        start: new Date(startDate).toISOString().split('T')[0],
        end: new Date(endDate).toISOString().split('T')[0],
        limit: limitNum,
        offset: offsetNum
      }
    };
  });
} 