/**
 * Replace macros in a URL with their actual values
 */
export function replaceMacros(url: string, macroValues: {
    click_id?: string | null,
    zone_id?: string | null,
    aff_sub_id?: string | null
  }): string {
    let result = url;
    
    // Only replace if the value exists and isn't null
    if (macroValues.click_id) {
      result = result.replace(/{click_id}/g, macroValues.click_id);
    }
    
    if (macroValues.zone_id) {
      result = result.replace(/{zone_id}/g, macroValues.zone_id);
    }
    
    if (macroValues.aff_sub_id) {
      result = result.replace(/{aff_sub_id}/g, macroValues.aff_sub_id);
    }
    
    return result;
  }