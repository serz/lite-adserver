/**
 * Ad Creative model
 */

export interface AdCreative {
  id: string;
  campaign_id: string;
  name: string;
  html: string;
  width?: number;
  height?: number;
  created_at: number;
  updated_at: number;
}

export interface CreateAdCreativeRequest {
  campaign_id: string;
  name: string;
  html: string;
  width?: number;
  height?: number;
}

export interface UpdateAdCreativeRequest {
  name?: string;
  html?: string;
  width?: number;
  height?: number;
} 