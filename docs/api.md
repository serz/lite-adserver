# API Documentation

This document describes the Lite Ad Server API endpoints, authentication, and usage. The documentation is organized by resource type and includes detailed information on request/response formats.

## Table of Contents

- [Authentication](#authentication)
- [Resources](#resources)
  - [Campaigns](#campaigns-api)
  - [Targeting Rule Types](#targeting-rule-types-api)
  - [Zones](#zones-api)
  - [Ad Events](#ad-events-api)
  - [Statistics](#statistics-api)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

## Authentication

All API requests require authentication using an API key. 

### API Key Authentication

Include your API key in the `Authorization` header of all requests using the Bearer token format:

```
Authorization: Bearer YOUR_API_KEY
```

Example with curl:

```bash
curl -H "Authorization: Bearer your-api-key-here" https://your-api-url.com/api/campaigns
```

The API key can be configured in your wrangler.toml file:

```toml
[vars]
API_KEY = "your-api-key-here"
```

### Response Codes

The API uses standard HTTP response codes:

- `200 OK`: The request was successful
- `201 Created`: The resource was successfully created
- `204 No Content`: The request was successful (used for delete operations)
- `400 Bad Request`: The request was invalid
- `401 Unauthorized`: Authentication failed
- `403 Forbidden`: The authenticated user doesn't have permission
- `404 Not Found`: The requested resource was not found
- `500 Server Error`: An error occurred on the server

## Campaigns API

The Campaigns API allows you to manage advertising campaigns.

### List Campaigns

Retrieves a paginated list of campaigns.

**Endpoint**: `GET /api/campaigns`

**Authentication**: Required

**Query Parameters**:

| Parameter | Type    | Description                                      | Default    |
|-----------|---------|--------------------------------------------------|------------|
| status    | string  | Filter by status (active, paused, archived)      | (all)      |
| limit     | integer | Number of results per page (1-100)               | 20         |
| offset    | integer | Number of results to skip                        | 0          |
| sort      | string  | Field to sort by (name, created_at, start_date)  | created_at |
| order     | string  | Sort order (asc, desc)                           | desc       |

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/campaigns?status=active&limit=10&sort=name&order=asc"
```

**Example Response**:

```json
{
  "campaigns": [
    {
      "id": 1,
      "name": "Summer Sale",
      "redirect_url": "https://example.com/summer",
      "status": "active",
      "start_date": 1658448000000,
      "end_date": 1660176000000,
      "created_at": 1657152000000,
      "updated_at": 1657238400000
    },
    {
      "id": 2,
      "name": "Holiday Promotion",
      "redirect_url": "https://example.com/holiday",
      "status": "active",
      "start_date": 1670544000000,
      "end_date": 1672444800000,
      "created_at": 1657152000000,
      "updated_at": 1657238400000
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### Get Campaign

Retrieves a specific campaign by ID, including its targeting rules.

**Endpoint**: `GET /api/campaigns/:id`

**Authentication**: Required

**URL Parameters**:

| Parameter | Type    | Description      |
|-----------|---------|------------------|
| id        | integer | Campaign ID      |

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/campaigns/1"
```

**Example Response**:

```json
{
  "id": 1,
  "name": "Summer Sale",
  "redirect_url": "https://example.com/summer",
  "start_date": 1658448000000,
  "end_date": 1660176000000,
  "status": "active",
  "created_at": 1657152000000,
  "updated_at": 1657238400000,
  "targeting_rules": [
    {
      "id": 1,
      "campaign_id": 1,
      "targeting_rule_type_id": 4,
      "targeting_method": "whitelist",
      "rule": "1,2,3",
      "created_at": 1657152000000,
      "updated_at": 1657152000000
    },
    {
      "id": 2,
      "campaign_id": 1,
      "targeting_rule_type_id": 1,
      "targeting_method": "whitelist",
      "rule": "US,CA",
      "created_at": 1657152000000,
      "updated_at": 1657152000000
    }
  ]
}
```

### Create Campaign

Creates a new campaign.

**Endpoint**: `POST /api/campaigns`

**Authentication**: Required

**Request Body**:

```json
{
  "name": "Black Friday Sale",
  "redirect_url": "https://example.com/black-friday",
  "start_date": 1637971200000,
  "end_date": 1638316800000,
  "targeting_rules": [
    {
      "targeting_rule_type_id": 4,
      "targeting_method": "whitelist",
      "rule": "1,2"
    },
    {
      "targeting_rule_type_id": 2,
      "targeting_method": "whitelist",
      "rule": "mobile"
    }
  ]
}
```

**Example Request**:

```bash
curl -X POST \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Black Friday Sale",
    "redirect_url": "https://example.com/black-friday",
    "start_date": 1637971200000,
    "end_date": 1638316800000,
    "targeting_rules": [
      {
        "targeting_rule_type_id": 4,
        "targeting_method": "whitelist",
        "rule": "1,2"
      }
    ]
  }' \
  "https://your-api-url.com/api/campaigns"
```

**Example Response**:

```json
{
  "id": 3,
  "name": "Black Friday Sale",
  "status": "paused",
  "created_at": 1635379200000
}
```

### Update Campaign

Updates an existing campaign.

**Endpoint**: `PUT /api/campaigns/:id`

**Authentication**: Required

**URL Parameters**:

| Parameter | Type    | Description      |
|-----------|---------|------------------|
| id        | integer | Campaign ID      |

**Request Body**:

```json
{
  "name": "Updated Campaign Name",
  "redirect_url": "https://example.com/updated",
  "status": "active"
}
```

**Example Request**:

```bash
curl -X PUT \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Campaign Name",
    "status": "active"
  }' \
  "https://your-api-url.com/api/campaigns/3"
```

**Example Response**:

```json
{
  "id": 3,
  "updated_at": 1635465600000
}
```

### Delete Campaign

Deletes a campaign and its associated targeting rules.

**Endpoint**: `DELETE /api/campaigns/:id`

**Authentication**: Required

**URL Parameters**:

| Parameter | Type    | Description      |
|-----------|---------|------------------|
| id        | integer | Campaign ID      |

**Example Request**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/campaigns/3"
```

**Response**: 204 No Content

## Targeting Rule Types API

The Targeting Rule Types API allows you to retrieve information about all available targeting rule types.

### List Targeting Rule Types

Retrieves a list of all targeting rule types.

**Endpoint**: `GET /api/targeting-rule-types`

**Authentication**: Required

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/targeting-rule-types"
```

**Example Response**:

```json
{
  "targeting_rule_types": [
    {
      "id": 1,
      "name": "Country",
      "description": "Target users by their country code (ISO 3166-1 alpha-2)"
    },
    {
      "id": 2,
      "name": "Device Type",
      "description": "Target users by their device type (desktop, mobile, tablet)"
    },
    {
      "id": 3,
      "name": "Browser",
      "description": "Target users by their browser (Chrome, Firefox, Safari, etc.)"
    },
    {
      "id": 4,
      "name": "Zone ID",
      "description": "Target specific ad zones where the ad should appear"
    }
  ]
}
```

## Zones API

The Zones API allows you to manage ad placement zones across your websites.

### List Zones

Retrieves a paginated list of zones.

**Endpoint**: `GET /api/zones`

**Authentication**: Required

**Query Parameters**:

| Parameter | Type    | Description                                      | Default    |
|-----------|---------|--------------------------------------------------|------------|
| status    | string  | Filter by status (active, inactive)              | (all)      |
| limit     | integer | Number of results per page (1-100)               | 20         |
| offset    | integer | Number of results to skip                        | 0          |
| sort      | string  | Field to sort by (name, created_at, site_url)    | created_at |
| order     | string  | Sort order (asc, desc)                           | desc       |

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/zones?status=active&limit=10&sort=name&order=asc"
```

**Example Response**:

```json
{
  "zones": [
    {
      "id": 1,
      "name": "Homepage Banner",
      "site_url": "https://example.com",
      "traffic_back_url": "https://example.com/fallback",
      "status": "active",
      "created_at": 1657152000000,
      "updated_at": 1657238400000
    },
    {
      "id": 2,
      "name": "Sidebar Ad",
      "site_url": "https://example.com/blog",
      "traffic_back_url": null,
      "status": "active",
      "created_at": 1657152000000,
      "updated_at": 1657238400000
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### Get Zone

Retrieves a specific zone by ID.

**Endpoint**: `GET /api/zones/:id`

**Authentication**: Required

**URL Parameters**:

| Parameter | Type    | Description      |
|-----------|---------|------------------|
| id        | integer | Zone ID          |

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/zones/1"
```

**Example Response**:

```json
{
  "id": 1,
  "name": "Homepage Banner",
  "site_url": "https://example.com",
  "traffic_back_url": "https://example.com/fallback",
  "status": "active",
  "created_at": 1657152000000,
  "updated_at": 1657238400000
}
```

### Create Zone

Creates a new zone.

**Endpoint**: `POST /api/zones`

**Authentication**: Required

**Request Body**:

```json
{
  "name": "Mobile Footer Ad",
  "site_url": "https://example.com/mobile",
  "traffic_back_url": "https://example.com/mobile/fallback"
}
```

**Example Request**:

```bash
curl -X POST \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile Footer Ad",
    "site_url": "https://example.com/mobile",
    "traffic_back_url": "https://example.com/mobile/fallback"
  }' \
  "https://your-api-url.com/api/zones"
```

**Example Response**:

```json
{
  "id": 3,
  "status": "active",
  "created_at": 1635379200000
}
```

### Update Zone

Updates an existing zone.

**Endpoint**: `PUT /api/zones/:id`

**Authentication**: Required

**URL Parameters**:

| Parameter | Type    | Description      |
|-----------|---------|------------------|
| id        | integer | Zone ID          |

**Request Body**:

```json
{
  "name": "Updated Zone Name",
  "site_url": "https://example.com/updated",
  "status": "inactive"
}
```

**Example Request**:

```bash
curl -X PUT \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Zone Name",
    "status": "inactive"
  }' \
  "https://your-api-url.com/api/zones/3"
```

**Example Response**:

```json
{
  "id": 3,
  "updated_at": 1635465600000
}
```

### Delete Zone

Deletes a zone.

**Endpoint**: `DELETE /api/zones/:id`

**Authentication**: Required

**URL Parameters**:

| Parameter | Type    | Description      |
|-----------|---------|------------------|
| id        | integer | Zone ID          |

**Example Request**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/zones/3"
```

**Response**: 204 No Content

## Ad Events API

The Ad Events API allows you to retrieve ad interaction events like impressions and clicks.

### List Ad Events

Retrieves a paginated list of ad events with filtering options.

**Endpoint**: `GET /api/ad_events`

**Authentication**: Required

**Query Parameters**:

| Parameter  | Type    | Description                                                 | Default    |
|------------|---------|-------------------------------------------------------------|------------|
| event_type | string  | Filter by event type (impression, click, conversion)        | (all)      |
| campaign_id| string  | Filter by campaign ID                                       | (all)      |
| zone_id    | string  | Filter by zone ID                                           | (all)      |
| country    | string  | Filter by country code                                      | (all)      |
| device_type| string  | Filter by device type (desktop, mobile, tablet)             | (all)      |
| start_time | integer | Filter events after this timestamp                          | (all)      |
| end_time   | integer | Filter events before this timestamp                          | (all)      |
| limit      | integer | Number of results per page (1-100)                          | 20         |
| offset     | integer | Number of results to skip                                   | 0          |
| sort       | string  | Field to sort by (id, event_time, event_type, campaign_id)  | event_time |
| order      | string  | Sort order (asc, desc)                                      | desc       |

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/ad_events?event_type=click&limit=10&sort=event_time&order=desc"
```

**Example Response**:

```json
{
  "ad_events": [
    {
      "id": 1,
      "event_type": "click",
      "event_time": 1657152000000,
      "campaign_id": 1,
      "zone_id": 2,
      "ip": "192.168.1.1",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "referer": "https://example.com/page",
      "country": "US",
      "device_type": "desktop",
      "browser": "Chrome",
      "os": "Windows"
    },
    {
      "id": 2,
      "event_type": "impression",
      "event_time": 1657151000000,
      "campaign_id": 2,
      "zone_id": 1,
      "ip": "192.168.1.2",
      "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
      "referer": "https://example.com/other-page",
      "country": "CA",
      "device_type": "mobile",
      "browser": "Safari",
      "os": "iOS"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

## Statistics API

The Statistics API provides performance metrics and analytics for your campaigns and zones.

### Get Statistics

Retrieves aggregated statistics based on various filters and grouping options.

**Endpoint**: `GET /api/stats`

**Authentication**: Required

**Query Parameters**:

| Parameter    | Type    | Description                                                | Default           |
|--------------|---------|------------------------------------------------------------| -----------------|
| from         | integer | Start timestamp in milliseconds                            | Start of current day |
| to           | integer | End timestamp in milliseconds                              | Current timestamp |
| campaign_ids | string  | Comma-separated list of campaign IDs to filter by          | (all)            |
| zone_ids     | string  | Comma-separated list of zone IDs to filter by              | (all)            |
| group_by     | string  | Field to group by (date, campaign_id, zone_id, country)    | date             |

**Example Request**:

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/stats?from=1657152000000&to=1657238400000&campaign_ids=1,2&group_by=date"
```

**Example Response**:

```json
{
  "stats": [
    {
      "date": "2022-07-07",
      "impressions": 1415,
      "clicks": 75,
      "unsold": 120,
      "fallbacks": 45,
      "ctr": 5.3
    },
    {
      "date": "2022-07-06",
      "impressions": 1100,
      "clicks": 45,
      "unsold": 90,
      "fallbacks": 30,
      "ctr": 4.09
    }
  ],
  "period": {
    "from": 1657152000000,
    "to": 1657238400000
  }
}
```

**Response Fields**:

| Field            | Description                                                            |
|------------------|------------------------------------------------------------------------|
| impressions      | Total ad requests (sum of clicks, unsold, and fallbacks)               |
| clicks           | Number of ad clicks recorded                                           |
| unsold           | Number of requests with no matching campaigns and no fallback URL      |
| fallbacks        | Number of requests redirected to a fallback URL (no matching campaigns)|
| ctr              | Click-through rate percentage (clicks / impressions × 100)             |

**Note:** The CTR is calculated using `impressions` (total of clicks, unsold, and fallbacks) as the denominator, which represents the total number of ad requests.

**Example: Group by campaign_id**

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/stats?from=1657152000000&to=1657238400000&group_by=campaign_id"
```

**Response**:

```json
{
  "stats": [
    {
      "campaign_id": 1,
      "impressions": 850,
      "clicks": 42,
      "unsold": 8,
      "fallbacks": 0,
      "ctr": 4.94
    },
    {
      "campaign_id": 2,
      "impressions": 750,
      "clicks": 35,
      "unsold": 25,
      "fallbacks": 10,
      "ctr": 4.67
    }
  ],
  "period": {
    "from": 1657152000000,
    "to": 1657238400000
  }
}
```

**Example: Group by zone_id**

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/stats?from=1657152000000&to=1657238400000&group_by=zone_id"
```

**Example: Group by country**

```bash
curl -H "Authorization: Bearer your-api-key-here" \
  "https://your-api-url.com/api/stats?from=1657152000000&to=1657238400000&group_by=country"
```

## Error Responses

All errors follow a standard format:

```json
{
  "error": "Error message describing what went wrong"
}
```

## Rate Limiting

API requests are rate limited to ensure system stability. Current limits are:
- 100 requests per minute per API key
- 1000 requests per hour per API key

Exceeding these limits will result in a 429 Too Many Requests response.
