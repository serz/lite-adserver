# API Documentation

This document describes the Lite Ad Server API endpoints, authentication, and usage. The documentation is organized by resource type and includes detailed information on request/response formats.

## Table of Contents

- [Authentication](#authentication)
- [Resources](#resources)
  - [Campaigns](#campaigns-api--implemented)
  - [Targeting Rule Types](#targeting-rule-types-api--implemented)
  - [Zones](#zones-api--coming-soon)
  - [Statistics](#statistics-api--coming-soon)
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

## Campaigns API ✅ (Implemented)

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
      "weight": 100,
      "created_at": 1657152000000,
      "updated_at": 1657152000000
    },
    {
      "id": 2,
      "campaign_id": 1,
      "targeting_rule_type_id": 1,
      "targeting_method": "whitelist",
      "rule": "US,CA",
      "weight": 100,
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
      "rule": "1,2",
      "weight": 100
    },
    {
      "targeting_rule_type_id": 2,
      "targeting_method": "whitelist",
      "rule": "mobile",
      "weight": 100
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
        "rule": "1,2",
        "weight": 100
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

## Targeting Rule Types API ✅ (Implemented)

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

## Zones API ⏳ (Coming Soon)

The Zones API will allow you to manage ad placement zones across your websites.

Planned endpoints:
- `GET /api/zones` - List all zones
- `GET /api/zones/:id` - Get a specific zone
- `POST /api/zones` - Create a new zone
- `PUT /api/zones/:id` - Update a zone
- `DELETE /api/zones/:id` - Delete a zone

## Statistics API ⏳ (Coming Soon)

The Statistics API will provide performance metrics and analytics for your campaigns and zones.

Planned endpoints:
- `GET /api/stats/campaigns/:id` - Get statistics for a campaign
- `GET /api/stats/zones/:id` - Get statistics for a zone
- `GET /api/stats/clicks` - Get detailed click data

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
