/**
 * Zone model
 */

export interface Zone {
  id: string;
  name: string;
  site_url?: string;
  traffic_back_url?: string;
  status: ZoneStatus;
  created_at: number;
  updated_at: number;
}

export type ZoneStatus = 'active' | 'inactive';

export interface ZoneStats {
  zone_id: string;
  total_clicks: number;
  campaign_stats: {
    campaign_id: string;
    campaign_name: string;
    clicks: number;
  }[];
  clicks_by_day: {
    date: string;
    clicks: number;
  }[];
  period: {
    start: string;
    end: string;
  };
}

export interface CreateZoneRequest {
  name: string;
  site_url?: string;
  traffic_back_url?: string;
}

export interface UpdateZoneRequest {
  name?: string;
  site_url?: string;
  traffic_back_url?: string;
  status?: ZoneStatus;
} 