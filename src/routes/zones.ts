import { FastifyInstance } from 'fastify';
import { Zone, ZoneStatus, CreateZoneRequest } from '../models/Zone';

/**
 * Zone routes
 */
export async function zoneRoutes(fastify: FastifyInstance) {
  /**
   * Get all zones
   */
  fastify.get('/', async () => {
    // Mock response
    return {
      zones: [
        {
          id: 'zone1',
          name: 'Homepage Banner',
          site_url: 'https://example.com',
          traffic_back_url: 'https://example.com/fallback',
          status: 'active',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
      total: 1,
    };
  });

  /**
   * Get a zone by ID
   */
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    
    // Mock response
    if (id === 'zone1') {
      const now = Date.now();
      return {
        id: 'zone1',
        name: 'Homepage Banner',
        site_url: 'https://example.com',
        traffic_back_url: 'https://example.com/fallback',
        status: 'active',
        created_at: now,
        updated_at: now,
        // We no longer have direct campaign relationships,
        // but we can show campaigns targeting this zone
        targeting_campaigns: [
          {
            id: 'campaign1',
            name: 'Test Campaign',
            status: 'active',
            created_at: now,
          },
        ],
      };
    }
    
    return { error: 'Zone not found' };
  });

  /**
   * Create a new zone
   */
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          site_url: { type: 'string', format: 'uri' },
          traffic_back_url: { type: 'string', format: 'uri' },
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
      },
    },
  }, async (request, reply) => {
    const zone = request.body as CreateZoneRequest;
    
    // Mock zone creation
    reply.code(201);
    return {
      id: 'new_zone',
      name: zone.name,
      status: 'active',
      created_at: Date.now(),
    };
  });

  /**
   * Update a zone
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
          site_url: { type: 'string', format: 'uri' },
          traffic_back_url: { type: 'string', format: 'uri' },
          status: { type: 'string', enum: ['active', 'inactive'] },
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
    
    // Mock zone update
    if (id === 'zone1') {
      return {
        id,
        updated_at: Date.now(),
      };
    }
    
    reply.code(404);
    return { error: 'Zone not found' };
  });

  /**
   * Delete a zone
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
    
    // Mock zone deletion
    if (id === 'zone1') {
      reply.code(204);
      return;
    }
    
    reply.code(404);
    return { error: 'Zone not found' };
  });
  
  /**
   * Get code snippet for a zone
   */
  fastify.get('/:id/snippet', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    if (id === 'zone1') {
      const snippet = `
<!-- Lite Ad Server Zone: Homepage Banner -->
<script>
  (function() {
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://adserver.example.com/serve/${id}?cb=' + Math.floor(Math.random() * 10000000);
    document.head.appendChild(script);
  })();
</script>
<!-- End Lite Ad Server Zone -->`;
      
      return {
        zone_id: id,
        snippet,
      };
    }
    
    reply.code(404);
    return { error: 'Zone not found' };
  });
} 