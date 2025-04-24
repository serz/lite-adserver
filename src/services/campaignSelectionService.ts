/**
 * Campaign Selection Service
 * Handles campaign eligibility and targeting in a single step
 */

import { Env, CampaignDetail } from '../models/interfaces';
import { TargetingRule, TARGETING_RULE_TYPES, parseGeoRule, parseDeviceTypeRule, parseZoneIdRule } from '../models/TargetingRule';
import { detectDeviceType } from '../utils/deviceDetection';
import { parseAndValidateId } from '../utils/idValidation';

/**
 * Logger for error messages
 */
function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

/**
 * Select an eligible campaign based on request context and targeting rules
 * @param request The HTTP request containing headers
 * @param zoneId Target zone ID
 * @param env Environment for KV access
 * @returns The first eligible campaign or null if none match
 */
export async function selectEligibleCampaign(
  request: Request,
  zoneId: string,
  env: Env
): Promise<CampaignDetail | null> {
  try {
    // Extract targeting context from request
    const country = request.headers.get('CF-IPCountry') ?? '';
    const deviceType = detectDeviceType(request.headers.get('User-Agent') ?? '');

    // Validate zone ID
    const zoneIdNum = parseAndValidateId(zoneId, 'zone');
    if (zoneIdNum === null) {
      logError(`Invalid zone ID: ${zoneId}`);
      return null;
    }

    // Fetch campaigns from KV
    const campaignsJson = await env.campaigns_zones.get('campaigns');
    if (!campaignsJson) {
      return null;
    }
    
    // Parse campaigns JSON
    interface CampaignData {
      id: number;
      name: string;
      redirect_url: string;
      status: string;
      targeting_rules: Array<{
        targeting_rule_type_id: number;
        targeting_method: string;
        rule: string;
      }>;
      [key: string]: unknown;
    }
    
    const campaigns = JSON.parse(campaignsJson) as CampaignData[];
    
    // Find the first eligible campaign
    for (const campaign of campaigns) {
      if (isEligibleForAllRules(campaign, zoneIdNum, country, deviceType)) {
        // Convert to CampaignDetail format
        const targetingRules = campaign.targeting_rules as unknown as TargetingRule[];
        
        return {
          id: campaign.id,
          name: campaign.name,
          redirect_url: campaign.redirect_url,
          status: campaign.status,
          targeting_rules: targetingRules
        };
      }
    }
    
    // No eligible campaigns found
    return null;
  } catch (error) {
    logError(`Error selecting eligible campaign: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Check if a campaign passes all targeting rules
 */
function isEligibleForAllRules(
  campaign: {
    targeting_rules: Array<{
      targeting_rule_type_id: number;
      targeting_method: string;
      rule: string;
    }>;
  },
  zoneId: number,
  country: string,
  deviceType: string
): boolean {
  // Group targeting rules by type
  const rulesByType = new Map<number, Array<{ 
    targeting_method: string;
    rule: string;
  }>>();
  
  for (const rule of campaign.targeting_rules) {
    if (!rulesByType.has(rule.targeting_rule_type_id)) {
      rulesByType.set(rule.targeting_rule_type_id, []);
    }
    rulesByType.get(rule.targeting_rule_type_id)?.push({
      targeting_method: rule.targeting_method,
      rule: rule.rule
    });
  }
  
  // Check zone ID targeting rules
  const zoneRules = rulesByType.get(TARGETING_RULE_TYPES.ZONE_ID) ?? [];
  if (!passesZoneTargeting(zoneRules, zoneId)) {
    return false;
  }
  
  // Check geo targeting rules
  const geoRules = rulesByType.get(TARGETING_RULE_TYPES.GEO) ?? [];
  if (!passesGeoTargeting(geoRules, country)) {
    return false;
  }
  
  // Check device type targeting rules
  const deviceRules = rulesByType.get(TARGETING_RULE_TYPES.DEVICE_TYPE) ?? [];
  if (!passesDeviceTargeting(deviceRules, deviceType)) {
    return false;
  }
  
  // All targeting rules passed
  return true;
}

/**
 * Check if the zone ID passes targeting rules
 */
function passesZoneTargeting(
  zoneRules: Array<{ targeting_method: string; rule: string }>,
  zoneId: number
): boolean {
  // If no rules exist, default behavior is to allow
  if (zoneRules.length === 0) {
    return true;
  }
  
  // Check each rule
  for (const rule of zoneRules) {
    const zoneIds = parseZoneIdRule(rule.rule);
    const isInList = zoneIds.includes(zoneId);
    
    if (rule.targeting_method === 'whitelist' && !isInList) {
      return false;
    }
    
    if (rule.targeting_method === 'blacklist' && isInList) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if the country code passes targeting rules
 */
function passesGeoTargeting(
  geoRules: Array<{ targeting_method: string; rule: string }>,
  country: string
): boolean {
  // If no rules exist or country is missing, default behavior is to allow
  if (geoRules.length === 0 || !country) {
    return true;
  }
  
  // Check each rule
  for (const rule of geoRules) {
    const countries = parseGeoRule(rule.rule);
    const isInList = countries.includes(country);
    
    if (rule.targeting_method === 'whitelist' && !isInList) {
      return false;
    }
    
    if (rule.targeting_method === 'blacklist' && isInList) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if the device type passes targeting rules
 */
function passesDeviceTargeting(
  deviceRules: Array<{ targeting_method: string; rule: string }>,
  deviceType: string
): boolean {
  // If no rules exist, default behavior is to allow
  if (deviceRules.length === 0) {
    return true;
  }
  
  // Check each rule
  for (const rule of deviceRules) {
    const deviceTypes = parseDeviceTypeRule(rule.rule);
    const isInList = deviceTypes.includes(deviceType);
    
    if (rule.targeting_method === 'whitelist' && !isInList) {
      return false;
    }
    
    if (rule.targeting_method === 'blacklist' && isInList) {
      return false;
    }
  }
  
  return true;
} 