import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Campaign, CampaignStatus, CreateCampaignRequest } from '../models/Campaign';
import { TargetingRule, TARGETING_RULE_TYPES } from '../models/TargetingRule';

// Type for D1 database environment
interface Env {
  DB: D1Database;
}

/**
 * Campaign routes
 */
export async function campaignRoutes(fastify: FastifyInstance) {
  /**
   * Get all campaigns
   * 
   * Returns a paginated list of campaigns that can be filtered by status
   */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'paused', 'archived'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          sort: { type: 'string', enum: ['name', 'created_at', 'start_date'], default: 'created_at' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            campaigns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  redirect_url: { type: 'string' },
                  status: { type: 'string' },
                  start_date: { type: 'integer' },
                  end_date: { type: 'integer' },
                  created_at: { type: 'integer' },
                  updated_at: { type: 'integer' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                has_more: { type: 'boolean' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Get query parameters
      const { status, limit = 20, offset = 0, sort = 'created_at', order = 'desc' } = request.query as {
        status?: CampaignStatus;
        limit?: number;
        offset?: number;
        sort?: string;
        order?: 'asc' | 'desc';
      };
      
      // Access the D1 database
      const env = fastify.d1Env as Env | undefined;
      
      // If we have D1 access, query the database
      if (env?.DB) {
        // Build the SQL query
        let sql = 'SELECT * FROM campaigns';
        const params: any[] = [];
        
        // Add status filter if provided
        if (status) {
          sql += ' WHERE status = ?';
          params.push(status);
        }
        
        // Add sorting
        sql += ` ORDER BY ${sort} ${order}`;
        
        // Add pagination
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        // Count total for pagination
        let countSql = 'SELECT COUNT(*) as total FROM campaigns';
        if (status) {
          countSql += ' WHERE status = ?';
        }
        
        // Execute the queries
        const [campaignsResult, countResult] = await Promise.all([
          env.DB.prepare(sql).bind(...params).all(),
          env.DB.prepare(countSql).bind(status || []).get(),
        ]);
        
        // Handle database error
        if (campaignsResult.error) {
          throw new Error(`Database error: ${campaignsResult.error}`);
        }
        
        const campaigns = campaignsResult.results as Campaign[];
        const total = (countResult.results as { total: number }).total;
        
        return {
          campaigns,
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + limit < total,
          },
        };
      } else {
        // Fallback to mock data when no D1 is available (for development/testing)
        const mockCampaigns = [
          {
            id: 1,
            name: 'Summer Sale',
            redirect_url: 'https://example.com/summer',
            status: 'active' as CampaignStatus,
            start_date: Date.now(),
            end_date: Date.now() + 30 * 24 * 60 * 60 * 1000,
            created_at: Date.now() - 5 * 24 * 60 * 60 * 1000,
            updated_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
          },
          {
            id: 2,
            name: 'Holiday Promotion',
            redirect_url: 'https://example.com/holiday',
            status: 'paused' as CampaignStatus,
            start_date: Date.now() + 60 * 24 * 60 * 60 * 1000,
            end_date: Date.now() + 90 * 24 * 60 * 60 * 1000,
            created_at: Date.now() - 10 * 24 * 60 * 60 * 1000,
            updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
          },
        ];
        
        // Filter by status if provided
        const filteredCampaigns = status 
          ? mockCampaigns.filter(campaign => campaign.status === status)
          : mockCampaigns;
        
        return {
          campaigns: filteredCampaigns.slice(offset, offset + limit),
          pagination: {
            total: filteredCampaigns.length,
            limit,
            offset,
            has_more: offset + limit < filteredCampaigns.length,
          },
        };
      }
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return {
        error: 'An error occurred fetching campaigns',
      };
    }
  });

  /**
   * Get a campaign by ID
   */
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            redirect_url: { type: 'string' },
            start_date: { type: 'integer' },
            end_date: { type: 'integer' },
            status: { type: 'string' },
            created_at: { type: 'integer' },
            updated_at: { type: 'integer' },
            targeting_rules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  targeting_rule_type_id: { type: 'string' },
                  targeting_method: { type: 'string' },
                  rule: { type: 'string' },
                  weight: { type: 'integer' },
                  created_at: { type: 'integer' },
                  updated_at: { type: 'integer' },
                },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Mock response for now
    if (id === 'campaign1') {
      const now = Date.now();
      return {
        id: 'campaign1',
        name: 'Test Campaign',
        redirect_url: 'https://example.com',
        start_date: now,
        end_date: now + 30 * 24 * 60 * 60 * 1000,
        status: 'active',
        created_at: now,
        updated_at: now,
        targeting_rules: [
          {
            id: 'rule1',
            campaign_id: 'campaign1',
            targeting_rule_type_id: TARGETING_RULE_TYPES.ZONE_ID,
            targeting_method: 'whitelist',
            rule: 'zone1,zone2',
            weight: 100,
            created_at: now,
            updated_at: now,
          },
          {
            id: 'rule2',
            campaign_id: 'campaign1',
            targeting_rule_type_id: TARGETING_RULE_TYPES.GEO,
            targeting_method: 'whitelist',
            rule: 'US,CA',
            weight: 100,
            created_at: now,
            updated_at: now,
          },
          {
            id: 'rule3',
            campaign_id: 'campaign1',
            targeting_rule_type_id: TARGETING_RULE_TYPES.CAPPING,
            targeting_method: 'whitelist',
            rule: '10',
            weight: 100,
            created_at: now,
            updated_at: now,
          }
        ]
      };
    }
    
    reply.code(404);
    return { error: 'Campaign not found' };
  });

  /**
   * Create a new campaign
   */
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'redirect_url', 'start_date', 'targeting_rules'],
        properties: {
          name: { type: 'string', minLength: 1 },
          redirect_url: { type: 'string', format: 'uri' },
          start_date: { type: 'integer' },
          end_date: { type: 'integer' },
          targeting_rules: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['targeting_rule_type_id', 'targeting_method', 'rule'],
              properties: {
                targeting_rule_type_id: { type: 'string', minLength: 1 },
                targeting_method: { type: 'string', enum: ['whitelist', 'blacklist'] },
                rule: { type: 'string', minLength: 1 },
                weight: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
              }
            }
          }
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string' },
            created_at: { type: 'integer' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const campaign = request.body as CreateCampaignRequest;
    
    // Mock campaign creation
    reply.code(201);
    return {
      id: 'campaign_new',
      name: campaign.name,
      status: 'paused',
      created_at: Date.now(),
    };
  });

  /**
   * Update a campaign
   */
  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          redirect_url: { type: 'string', format: 'uri' },
          start_date: { type: 'integer' },
          end_date: { type: 'integer' },
          status: { type: 'string', enum: ['active', 'paused', 'archived'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            updated_at: { type: 'integer' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Mock campaign update
    if (id === 'campaign1') {
      return {
        id,
        updated_at: Date.now(),
      };
    }
    
    reply.code(404);
    return { error: 'Campaign not found' };
  });

  /**
   * Delete a campaign
   */
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Mock campaign deletion
    if (id === 'campaign1') {
      reply.code(204);
      return;
    }
    
    reply.code(404);
    return { error: 'Campaign not found' };
  });
  
  /**
   * Routes for managing targeting rules
   */
  fastify.register(async (fastify) => {
    // Get all targeting rules for a campaign
    fastify.get('/:campaignId/targeting', async (request) => {
      const { campaignId } = request.params as { campaignId: string };
      const now = Date.now();
      
      return {
        targeting_rules: [
          {
            id: 'rule1',
            campaign_id: campaignId,
            targeting_rule_type_id: TARGETING_RULE_TYPES.ZONE_ID,
            targeting_method: 'whitelist',
            rule: 'zone1,zone2',
            weight: 100,
            created_at: now,
            updated_at: now,
          }
        ],
        total: 1
      };
    });
    
    // Add a targeting rule to a campaign
    fastify.post('/:campaignId/targeting', async (request, reply) => {
      const { campaignId } = request.params as { campaignId: string };
      const now = Date.now();
      
      reply.code(201);
      return {
        id: 'new_rule',
        campaign_id: campaignId,
        created_at: now
      };
    });
    
    // Delete a targeting rule
    fastify.delete('/:campaignId/targeting/:ruleId', async (request, reply) => {
      reply.code(204);
      return;
    });
  });
} 