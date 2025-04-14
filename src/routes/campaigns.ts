import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Campaign, CampaignStatus, CreateCampaignRequest } from '../models/Campaign';
import { TargetingRule, TARGETING_RULE_TYPES } from '../models/TargetingRule';

/**
 * Campaign routes
 */
export async function campaignRoutes(fastify: FastifyInstance) {
  /**
   * Get all campaigns
   */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'paused', 'archived'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
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
                  id: { type: 'string' },
                  name: { type: 'string' },
                  status: { type: 'string' },
                  start_date: { type: 'integer' },
                  end_date: { type: 'integer' },
                  created_at: { type: 'integer' },
                  updated_at: { type: 'integer' },
                },
              },
            },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // This would normally query from D1 database
    // For now, return a mock response
    return {
      campaigns: [
        {
          id: 'campaign1',
          name: 'Test Campaign',
          status: 'active',
          start_date: Date.now(),
          end_date: Date.now() + 30 * 24 * 60 * 60 * 1000,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
      total: 1,
    };
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