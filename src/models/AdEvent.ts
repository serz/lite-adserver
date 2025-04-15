/**
 * Ad Event model
 */

export interface AdEvent {
  id: number;
  event_type: string; // 'impression', 'click', 'conversion', etc.
  event_time: number; // Unix timestamp
  campaign_id: number;
  zone_id: number;
  ip?: string;
  user_agent?: string;
  referer?: string;
  country?: string;
  device_type?: string;
  browser?: string;
  os?: string;
}

export interface AdEventStats {
  total: number;
  by_event_type: {
    event_type: string;
    count: number;
    percentage: number;
  }[];
  by_campaign: {
    campaign_id: number;
    count: number;
    percentage: number;
  }[];
  by_zone: {
    zone_id: number;
    count: number;
    percentage: number;
  }[];
  by_country: {
    country: string;
    count: number;
    percentage: number;
  }[];
  by_device: {
    device_type: string;
    count: number;
    percentage: number;
  }[];
  by_day: {
    date: string;
    count: number;
  }[];
  period: {
    start: string;
    end: string;
  };
}

export interface AdEventFilter {
  event_type?: string;
  campaign_id?: number;
  zone_id?: number;
  country?: string;
  device_type?: string;
  start_time?: number;
  end_time?: number;
} 