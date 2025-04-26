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
  ZONE_ID: 4,
  OS: 5,
  BROWSER: 6,
  WEEKDAYS: 7,
  HOURS: 8,
  UNIQUE_USERS: 9
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

export function parseOsRule(rule: string): string[] {
  return rule.split(',').map(os => os.trim());
}

export function parseBrowserRule(rule: string): string[] {
  return rule.split(',').map(browser => browser.trim());
}

export function parseWeekdaysRule(rule: string): number[] {
  // Expects comma-separated days of week (1-7, where 1 is Monday)
  return rule.split(',').map(day => parseInt(day.trim(), 10));
}

export function parseHoursRule(rule: string): number[] {
  // Expects comma-separated hours (0-23)
  return rule.split(',').map(hour => parseInt(hour.trim(), 10));
}

export function parseUniqueUsersRule(rule: string): { visits: number; hours: number } {
  // Expects format "visits/hours", e.g., "3/12" for 3 visits per 12 hours
  const parts = rule.split('/');
  
  const visits = parseInt(parts[0]?.trim() ?? '0', 10);
  const hours = parseInt(parts[1]?.trim() ?? '0', 10);
  
  if (parts.length !== 2 || isNaN(visits) || isNaN(hours)) {
    throw new Error(`Invalid unique_users rule format: ${rule}. Expected format: "visits/hours"`);
  }
  
  return { visits, hours };
} 