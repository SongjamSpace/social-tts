# Analytics Dashboard API Documentation

## Overview of `AnalyticsDashboard.tsx`

The `AnalyticsDashboard` is a comprehensive frontend component built using React and Apache ECharts to visualize data about top token deployers on Pump.fun.

It currently relies on mock data loaded synchronously but expects an array of `Deployer` objects containing metrics like volume, market cap, creator fees, mindshare, and a list of their top tokens.
The dashboard supports multiple chart views (Treemap, Bar, Pie, Scatter, Radar, etc.) and allows users to drill down into a specific deployer's performance.

To fully back this dashboard with a real backend, the following API endpoint and response schema are recommended:

---

## Endpoints

### 1. Get Top Deployers

Retrieves a list of the top token deployers with their aggregated metrics.

- **URL:** `/api/v1/deployers/top`
- **Method:** `GET`
- **Description:** Fetches the top deployers data required to populate the charts.

#### Query Parameters (Optional)

| Parameter | Type     | Description                                          |
| --------- | -------- | ---------------------------------------------------- |
| `limit`   | `number` | Number of top deployers to return (default: 30)      |
| `sort`    | `string` | Metric to sort by (e.g., `mindshare`, `totalVolume`) |

---

## Response Schema

The response needs to return a JSON object with a `data` array containing the deployers.

```json
{
  "success": true,
  "data": [
    {
      "address": "string",
      "displayName": "string",
      "avatarUrl": "string | null",
      "twitterUrl": "string | null",
      "telegramUrl": "string | null",
      "websiteUrl": "string | null",
      "tokenCount": "number",
      "totalVolume": "number",
      "totalMarketCap": "number",
      "totalCreatorFees": "number",
      "mindshare": "number",
      "topTokens": [
        {
          "name": "string",
          "symbol": "string",
          "marketCap": "number",
          "volume": "number"
        }
      ]
    }
  ]
}
```

### Type Definitions (TypeScript)

If you are building the backend in TypeScript, these are the exact interfaces the dashboard expects:

```typescript
export interface DeployerToken {
  name: string;
  symbol: string;
  marketCap: number; // in SOL
  volume: number; // in SOL
}

export interface Deployer {
  address: string; // Wallet address
  displayName: string; // Alias or truncated address
  avatarUrl?: string; // Profile picture
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  tokenCount: number; // Total tokens deployed
  totalVolume: number; // Aggregated volume in SOL
  totalMarketCap: number; // Aggregated market cap in SOL
  totalCreatorFees: number; // Accumulated fees in SOL
  mindshare: number; // Calculated influence score
  topTokens: DeployerToken[]; // Array of their most successful tokens
}
```
