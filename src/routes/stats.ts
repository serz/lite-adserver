/**
 * Stats API routes
 */
import { FastifyInstance } from 'fastify';

/**
 * Gets start of day timestamp
 */
function startOfDay(date: Date): number {
  const startOfDayDate = new Date(date);
  startOfDayDate.setHours(0, 0, 0, 0);
  return startOfDayDate.getTime();
}

/**
 * Stats routes
 */
export async function statRoutes(fastify: FastifyInstance) {
  /**
   * Get aggregated statistics
   * 
   * Returns aggregated stats based on group_by and other filters
   */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'integer', description: 'Start timestamp (defaults to start of current day)' },
          to: { type: 'integer', description: 'End timestamp' },
          campaign_ids: { type: 'string', description: 'Comma-separated list of campaign IDs' },
          zone_ids: { type: 'string', description: 'Comma-separated list of zone IDs' },
          group_by: { 
            type: 'string', 
            enum: ['date', 'campaign_id', 'zone_id', 'country'], 
            default: 'date', 
            description: 'Field to group statistics by' 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            stats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', nullable: true },
                  campaign_id: { type: 'integer', nullable: true },
                  zone_id: { type: 'integer', nullable: true },
                  country: { type: 'string', nullable: true },
                  impressions: { type: 'integer' },
                  clicks: { type: 'integer' },
                  unsold: { type: 'integer' },
                  fallbacks: { type: 'integer' },
                  ctr: { type: 'number' }
                }
              }
            },
            period: {
              type: 'object',
              properties: {
                from: { type: 'integer' },
                to: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { d1Env } = fastify;
      
      if (!d1Env?.DB) {
        return reply.code(500).send({ error: 'Database connection not available' });
      }

      const { DB } = d1Env;
      const query = request.query as {
        from?: number;
        to?: number;
        campaign_ids?: string;
        zone_ids?: string;
        group_by?: 'date' | 'campaign_id' | 'zone_id' | 'country';
      };
      
      const { 
        from = startOfDay(new Date()), 
        to = Date.now(), 
        campaign_ids, 
        zone_ids, 
        group_by = 'date'
      } = query;

      // Build SQL query
      let sqlWhereClauses: string[] = [];
      const queryParams: any[] = [];

      // Add time range filters
      sqlWhereClauses.push('event_time >= ?');
      queryParams.push(from);
      
      sqlWhereClauses.push('event_time <= ?');
      queryParams.push(to);

      // Add campaign filter if provided
      if (campaign_ids) {
        const campaignIdList = campaign_ids.split(',').map(id => id.trim());
        sqlWhereClauses.push(`campaign_id IN (${campaignIdList.map(() => '?').join(', ')})`);
        queryParams.push(...campaignIdList);
      }

      // Add zone filter if provided
      if (zone_ids) {
        const zoneIdList = zone_ids.split(',').map(id => id.trim());
        sqlWhereClauses.push(`zone_id IN (${zoneIdList.map(() => '?').join(', ')})`);
        queryParams.push(...zoneIdList);
      }

      // Determine group by clause and select statement
      let groupByClause = '';
      let selectClause = '';
      
      switch (group_by) {
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
      }
      
      // Build the final SQL query
      const sql = `
        SELECT 
          ${selectClause},
          SUM(CASE WHEN event_type IN ('click', 'unsold', 'fallback') THEN 1 ELSE 0 END) as impressions,
          SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks,
          SUM(CASE WHEN event_type = 'unsold' THEN 1 ELSE 0 END) as unsold,
          SUM(CASE WHEN event_type = 'fallback' THEN 1 ELSE 0 END) as fallbacks,
          CASE 
            WHEN SUM(CASE WHEN event_type IN ('click', 'unsold', 'fallback') THEN 1 ELSE 0 END) > 0 
            THEN ROUND((SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) * 100.0) / 
                 SUM(CASE WHEN event_type IN ('click', 'unsold', 'fallback') THEN 1 ELSE 0 END), 2)
            ELSE 0 
          END as ctr
        FROM ad_events
        WHERE ${sqlWhereClauses.join(' AND ')}
        GROUP BY ${groupByClause}
        ORDER BY ${groupByClause === 'campaign_id' || groupByClause === 'zone_id' ? groupByClause : 2} DESC
      `;

      // Execute query
      const result = await DB.prepare(sql).bind(...queryParams).all();
      
      if (result.error) {
        throw new Error(`Database error: ${result.error}`);
      }

      // Return response
      return {
        stats: result.results || [],
        period: {
          from,
          to
        }
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return reply.code(500).send({ 
        error: 'Error fetching statistics',
        details: process.env['NODE_ENV'] === 'development' ? String(error) : undefined
      });
    }
  });
} 