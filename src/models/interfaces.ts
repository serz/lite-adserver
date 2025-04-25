/**
 * Shared interface definitions for the lite ad server
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { TargetingRule } from './TargetingRule';
import { TargetingMethod } from './Campaign';

/**
 * Environment variables and bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;
  // Durable Objects
  COUNTER: DurableObjectNamespace;
  // API Key
  API_KEY?: string;
  // Allowed origins for CORS
  ALLOWED_ORIGINS?: string;
  // KV namespace for campaigns and zones
  campaigns_zones: KVNamespace;
  // Flag to indicate if this is a demo instance
  DEMO_INSTANCE?: string;
}

/**
 * Campaign with targeting rules for selection
 */
export interface CampaignDetail {
  id: number;
  name: string;
  redirect_url: string;
  status: string;
  targeting_rules: TargetingRule[];
}

/**
 * Database campaign representation
 */
export interface DbCampaign {
  id: number;
  name: string;
  redirect_url: string;
  start_date?: number;
  end_date?: number;
  status: string;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
}

/**
 * Data for updating a campaign
 */
export interface CampaignUpdateData {
  name?: string;
  redirect_url?: string;
  status?: string;
  start_date?: number | null;
  end_date?: number | null;
  traffic_back_url?: string;
  [key: string]: unknown;
}

/**
 * Data for updating a zone
 */
export interface ZoneUpdateData {
  name?: string;
  site_url?: string;
  traffic_back_url?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Data for creating a new campaign
 */
export interface CreateCampaignRequestData {
  name: string;
  redirect_url: string;
  start_date?: number;
  end_date?: number;
  targeting_rules: Array<{
    targeting_rule_type_id: number;
    targeting_method: TargetingMethod;
    rule: string;
  }>;
  [key: string]: unknown;
}

/**
 * Data representation for a targeting rule in API requests/responses
 */
export interface TargetingRuleData {
  id?: number; // Optional for creation
  campaign_id: number; // Usually derived from path param, not in body
  targeting_rule_type_id: number;
  targeting_method: TargetingMethod;
  rule: string;
  created_at?: number; // Added by server
  updated_at?: number; // Added by server
} 