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
  created_at: number;
  updated_at: number;
}

export interface CreateTargetingRuleRequest {
  campaign_id: number;
  targeting_rule_type_id: number;
  targeting_method: TargetingMethod;
  rule: string;
}

export interface UpdateTargetingRuleRequest {
  targeting_method?: TargetingMethod;
  rule?: string;
}

export const TARGETING_RULE_TYPES = {
  GEO: 1,
  DEVICE_TYPE: 2,
  CAPPING: 3,
  ZONE_ID: 4
};

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