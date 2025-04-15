import { TargetingRule } from './TargetingRule';

/**
 * Campaign model
 */

export interface Campaign {
  id: number;
  name: string;
  redirect_url: string;
  start_date: number;
  end_date?: number;
  status: CampaignStatus;
  created_at: number;
  updated_at: number;
}

export type CampaignStatus = 'active' | 'paused' | 'archived';

export type TargetingMethod = 'whitelist' | 'blacklist';

export interface CampaignWithDetails extends Campaign {
  targeting_rules: TargetingRule[];
}

export interface CampaignStats {
  campaign_id: number;
  total_clicks: number;
  clicks_by_day: {
    date: string;
    clicks: number;
  }[];
  period: {
    start: string;
    end: string;
  };
}

export interface CreateCampaignRequest {
  name: string;
  redirect_url: string;
  start_date: number;
  end_date?: number;
  targeting_rules: {
    targeting_rule_type_id: number;
    targeting_method: TargetingMethod;
    rule: string;
  }[];
}

export interface UpdateCampaignRequest {
  name?: string;
  redirect_url?: string;
  start_date?: number;
  end_date?: number;
  status?: CampaignStatus;
} 