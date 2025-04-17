# Feature Proposal: Campaign Targeting and selection algorithm


## Overview

This proposal outlines the architecture and logic for implementing fast and flexible campaign targeting and delivery within the existing Cloudflare Worker-based ad server. The goal is to eliminate performance bottlenecks caused by real-time SQL queries (D1), and replace them with a KV-based in-memory targeting system that enables fast lookup, clean rule evaluation, and better maintainability.

---

## Goals

- Replace complex D1 SQL queries with efficient KV-based campaign matching
- Improve performance, especially under high request load
- Simplify targeting logic and allow flexible rule expansion
- Maintain near real-time data freshness with background sync from D1
- Keep architecture maintainable and easy to test

---

## Architecture Summary

### Data Storage

- **Cloudflare Workers KV** will be used as the primary storage layer for campaigns and zones.
- **D1** remains the source of truth but is not queried on each request.

### KV Keys Structure

| Key Format             | Type       | Description                          |
|------------------------|------------|--------------------------------------|
| `campaigns`            | JSON Array | All active campaigns (matching to from/to dates) |
| `zones:{zone_id}`      | JSON Object| Individual zone definitions          |

---

## Request Flow

1. Incoming request includes a known `zone_id`
2. Fetch zone config from KV: `zones:{zone_id}`
3. Fetch all active campaigns from KV: `campaigns`
4. Loop through each campaign and evaluate rules
5. Return first campaign that matches all rules

---

## Campaign Matching Logic

Campaign data includes a list of rules (country, device_type, zone_id). Each rule is evaluated sequentially. If **any rule fails**, the campaign is skipped.

## Matching Logic in JavaScript example (use cloudflare headers)
```js
const matchers = {
  country: (req, val) => req.country === val,
  userAgent: (req, val) => req.userAgent.includes(val),
};

function doesCampaignMatch(campaign, request) {
  for (const rule of campaign.rules) {
    const fn = matchers[rule.type];
    if (!fn || !fn(request, rule.value || rule.contains)) return false;
  }
  return true;
}
```

## Data Sync Strategy
A background job will be responsible for syncing data from D1 to KV.

## Sync Details
-Job runs on a timer (e.g., every minute) and/or triggered on campaign/zone updates
-Writes to:
`campaigns` key with all active campaigns
`zones:{zone_id}` keys individually

## Performance Considerations
- KV read latency is low (sub-10ms typical)
- No cold start penalty for KV access
- Memory limit of 25MB per key applies — currently not expected to exceed this
- Worker runtime remains light and fast, no large in-memory state

## Future Improvements (Out of Scope for Initial Version)
- Campaign Bucketing

Store campaigns in multiple KV keys segmented by geo or targeting category

Improves matching speed for large-scale setups

- Zone-based Campaign Filtering

Allow each zone to define allowed campaign IDs

Filter campaigns before rule matching for improved performance

```js
if (!zone.allowedCampaigns.includes(campaign.id)) continue;
```

- Fallback to D1
In case of sync failure, fallback logic could retrieve fresh data from D1

## Summary
This approach provides a high-performance, scalable, and developer-friendly way to serve targeted ads using Cloudflare Workers. It offloads runtime complexity to precomputed KV data, keeps request-time logic lightweight, and remains extensible for future needs.