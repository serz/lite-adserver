/**
 * Click tracking model
 */

export interface Click {
  id: string;
  campaign_id: string;
  zone_id: string;
  ip?: string;
  user_agent?: string;
  referer?: string;
  country?: string;
  device_type?: string;
  timestamp: number;
}

export interface ClickStats {
  total: number;
  by_country: {
    country: string;
    clicks: number;
    percentage: number;
  }[];
  by_device: {
    device_type: string;
    clicks: number;
    percentage: number;
  }[];
  by_day: {
    date: string;
    clicks: number;
  }[];
  period: {
    start: string;
    end: string;
  };
}

export interface ClickFilter {
  campaign_id?: string;
  zone_id?: string;
  country?: string;
  device_type?: string;
  start_date?: number;
  end_date?: number;
} 