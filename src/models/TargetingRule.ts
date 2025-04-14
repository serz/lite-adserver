/**
 * Targeting Rule models
 */
import { TargetingMethod } from './Campaign';
import { parseIdList } from '../utils/idValidation';

export interface TargetingRuleType {
  id: number;
  name: string;
  description?: string;
  created_at: number;
}

export interface TargetingRule {
  id: number;
  campaign_id: number;
  targeting_rule_type_id: number;
  targeting_method: TargetingMethod;
  rule: string;
  weight: number;
  created_at: number;
  updated_at: number;
}

export interface CreateTargetingRuleRequest {
  campaign_id: number;
  targeting_rule_type_id: number;
  targeting_method: TargetingMethod;
  rule: string;
  weight?: number;
}

export interface UpdateTargetingRuleRequest {
  targeting_method?: TargetingMethod;
  rule?: string;
  weight?: number;
}

// Predefined rule types - match the values used in the database schema
// These are now the sequence IDs (1-4) that correspond to the rule types in the database
export const TARGETING_RULE_TYPES = {
  GEO: 1, // 'Geographic Location'
  DEVICE_TYPE: 2, // 'Device Type'
  CAPPING: 3, // 'Frequency Capping'
  ZONE_ID: 4  // 'Zone ID'
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

export function parseZoneIdRule(rule: string): number[] {
  return parseIdList(rule);
} 