/**
 * Zone model
 */

export interface Zone {
  id: number;
  name: string;
  site_url?: string;
  traffic_back_url?: string;
  status: ZoneStatus;
  created_at: number;
  updated_at: number;
}

export type ZoneStatus = 'active' | 'inactive';

export interface ZoneStats {
  zone_id: number;
  total_impressions: number;
  total_clicks: number;
  clicks_by_day: {
    date: string;
    impressions: number;
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