/**
 * Test file for macro replacement functionality
 */

// Import the replaceMacros function if it's exported, or redefine it for testing
function replaceMacros(url: string, macroValues: {
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

// Test cases
console.log("---- Testing Macro Replacement Functionality ----");

// Test 1: Replace all macros
const test1 = replaceMacros(
  "https://advertiser.example.com/sports-promo?clid={click_id}&source={aff_sub_id}&zone_id={zone_id}",
  {
    click_id: "123456789",
    zone_id: "42",
    aff_sub_id: "partner_a"
  }
);
console.log("Test 1 - Replace all macros:");
console.log("Expected: https://advertiser.example.com/sports-promo?clid=123456789&source=partner_a&zone_id=42");
console.log("Actual:   " + test1);
console.log("Pass:     " + (test1 === "https://advertiser.example.com/sports-promo?clid=123456789&source=partner_a&zone_id=42"));

// Test 2: Replace some macros (missing aff_sub_id)
const test2 = replaceMacros(
  "https://advertiser.example.com/sports-promo?clid={click_id}&source={aff_sub_id}&zone_id={zone_id}",
  {
    click_id: "123456789",
    zone_id: "42",
    aff_sub_id: null
  }
);
console.log("\nTest 2 - Missing aff_sub_id:");
console.log("Expected: https://advertiser.example.com/sports-promo?clid=123456789&source={aff_sub_id}&zone_id=42");
console.log("Actual:   " + test2);
console.log("Pass:     " + (test2 === "https://advertiser.example.com/sports-promo?clid=123456789&source={aff_sub_id}&zone_id=42"));

// Test 3: Multiple replacements of the same macro
const test3 = replaceMacros(
  "https://advertiser.example.com/promo?id={click_id}&tracking={click_id}",
  {
    click_id: "123456789"
  }
);
console.log("\nTest 3 - Multiple replacements of the same macro:");
console.log("Expected: https://advertiser.example.com/promo?id=123456789&tracking=123456789");
console.log("Actual:   " + test3);
console.log("Pass:     " + (test3 === "https://advertiser.example.com/promo?id=123456789&tracking=123456789"));

// Test 4: URL with no macros
const test4 = replaceMacros(
  "https://advertiser.example.com/no-macros",
  {
    click_id: "123456789",
    zone_id: "42",
    aff_sub_id: "partner_a"
  }
);
console.log("\nTest 4 - URL with no macros:");
console.log("Expected: https://advertiser.example.com/no-macros");
console.log("Actual:   " + test4);
console.log("Pass:     " + (test4 === "https://advertiser.example.com/no-macros"));

console.log("\n---- Test Complete ----"); 