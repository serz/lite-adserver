/**
 * Targeting Rule models
 */
import { TargetingMethod } from './Campaign';

export interface TargetingRuleType {
  id: string;
  name: string;
  description?: string;
  created_at: number;
}

export interface TargetingRule {
  id: string;
  campaign_id: string;
  targeting_rule_type_id: string;
  targeting_method: TargetingMethod;
  rule: string;
  weight: number;
  created_at: number;
  updated_at: number;
}

export interface CreateTargetingRuleRequest {
  campaign_id: string;
  targeting_rule_type_id: string;
  targeting_method: TargetingMethod;
  rule: string;
  weight?: number;
}

export interface UpdateTargetingRuleRequest {
  targeting_method?: TargetingMethod;
  rule?: string;
  weight?: number;
}

// Predefined rule types - should match values in migration
export const TARGETING_RULE_TYPES = {
  GEO: 'geo',
  DEVICE_TYPE: 'device_type',
  CAPPING: 'capping',
  ZONE_ID: 'zone_id'
};

// Helper functions for rule parsing
export function parseGeoRule(rule: string): string[] {
  return rule.split(',').map(country => country.trim());
}

export function parseDeviceTypeRule(rule: string): string[] {
  return rule.split(',').map(deviceType => deviceType.trim());
}

export function parseCappingRule(rule: string): number {
  return parseInt(rule, 10);
}

export function parseZoneIdRule(rule: string): string[] {
  return rule.split(',').map(zoneId => zoneId.trim());
} 