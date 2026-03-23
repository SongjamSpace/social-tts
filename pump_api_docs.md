# Pump.fun API Documentation

This document provides a comprehensive overview of the Pump.fun APIs, including request parameters and response schemas.

## 1. User & Profile APIs

### User Created Coins
- **Endpoint**: `GET https://frontend-api-v3.pump.fun/coins-v2/user-created-coins/{address}`
- **Description**: Returns all coins created by a specific user address.
- **Parameters**:
  - `limit` (Query): Number of coins to return (default: 10).
  - `offset` (Query): Number of coins to skip (default: 0).
- **Response Schema**:
```json
{
  "limit": 10,
  "offset": 0,
  "count": 100,
  "coins": [
    {
      "mint": "string",
      "name": "string",
      "symbol": "string",
      "description": "string",
      "image_uri": "string",
      "video_uri": "string",
      "metadata_uri": "string",
      "twitter": "string",
      "website": "string",
      "telegram": "string",
      "bonding_curve": "string",
      "associated_bonding_curve": "string",
      "creator": "string",
      "created_timestamp": 1720000000000,
      "complete": true,
      "virtual_sol_reserves": 1000000000,
      "virtual_token_reserves": 1000000000,
      "total_supply": 1000000000,
      "market_cap": 2500.5,
      "usd_market_cap": 250000.0,
      "is_currently_live": true,
      "reply_count": 10
    }
  ]
}
```

### User Followers / Following
- **Endpoint**: `GET https://frontend-api-v3.pump.fun/following/followers/{address}`
- **Endpoint**: `GET https://frontend-api-v3.pump.fun/following/{address}`
- **Description**: Returns the list of followers or users followed by a specific address.
- **Response Schema**: `Array of User Objects` (e.g., `[]` if none).

### User Token Balances
- **Endpoint**: `GET https://profile-api.pump.fun/balance/tokens/{address}`
- **Description**: Returns a list of tokens held by the user with their current values.
- **Parameters**:
  - `page` (Query): Page number.
  - `size` (Query): Number of items per page.
- **Response Schema**:
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "mint": "string",
        "balance": 1000.0,
        "value_sol": 1.5,
        "value_usd": 300.0
      }
    ],
    "last_update_ts": 1720000000000
  },
  "pagination": { "page": 1, "size": 10, "total": 100 }
}
```

### User Holding Summary
- **Endpoint**: `GET https://profile-api.pump.fun/balance/summary/{address}`
- **Description**: Returns a summary of the user's portfolio value and SOL balance.
- **Response Schema**:
```json
{
  "success": true,
  "data": {
    "total_value": 356.81,
    "native_balance": 4.12,
    "native_lamports": 4127503893,
    "sol_price": 86.44,
    "token_count": 1,
    "last_update_ts": 1720000000000
  }
}
```

### Creator Fees
- **Endpoint**: `GET https://swap-api.pump.fun/v1/creators/{address}/fees/total`
- **Description**: Total fees earned by a creator.
- **Response Schema**:
```json
{
  "totalFees": "899389401990",
  "totalFeesSOL": "899.3894"
}
```

---

## 2. Global & Search APIs

### Currently Live Coins
- **Endpoint**: `GET https://frontend-api-v3.pump.fun/coins/search-unrestricted`
- **Parameters**:
  - `currentlyLive` (bool): `true` for live coins.
  - `sort` (string): e.g., `featured`, `last_trade_timestamp`.
  - `includeNsfw` (bool): Include NSFW content.
- **Response Schema**: `Array of Coin Objects` (Same as "User Created Coins" but without wrapper).

### Newly Created Coins
- **Endpoint**: `GET https://frontend-api-v3.pump.fun/coins`
- **Parameters**:
  - `offset`, `limit`: Pagination.
  - `sort`: `created_timestamp`.
  - `order`: `DESC` or `ASC`.
- **Response Schema**: `Array of Coin Objects`.

---

## 3. Coin-Specific APIs

### Coin Chat Invitation
- **Endpoint**: `GET https://chat-api-v1.pump.fun/invites/coin/{mint}`
- **Description**: Fetch chat room details for a specific coin.
- **Response Schema**:
```json
{
  "chatId": "string",
  "name": "string",
  "description": "string",
  "membersCount": 10,
  "tokenGateAddress": "string",
  "tokenGateMinAmount": 1
}
```

### Coin Trades
- **Endpoint**: `GET https://swap-api.pump.fun/v2/coins/{mint}/trades`
- **Parameters**:
  - `limit` (Query): Number of trades.
  - `cursor` (Query): For pagination.
  - `minSolAmount` (Query): Filter by minimum trade size.
- **Response Schema**: `Array of Trade Objects` (Includes signature, user, type, sol/token amount).

### Coin Top Holders
- **Endpoint**: `GET https://advanced-api-v2.pump.fun/coins/top-holders-and-sol-balance/{mint}`
- **Description**: Returns top holders, their token amounts, and SOL balances.
- **Response Schema**:
```json
{
  "topHolders": [
    { "address": "string", "amount": 1000000.0, "solBalance": 1.5 }
  ],
  "totalHolders": ["address1", "..."]
}
```

### Coin Details (V2)
- **Endpoint**: `GET https://frontend-api-v3.pump.fun/coins-v2/{mint}`
- **Description**: Comprehensive details about a specific coin.
- **Response Schema**: Detailed Coin Object (Includes market cap, reserves, ath, livestream info, etc.).

### Previous Streams (Clips)
- **Endpoint**: `GET https://livestream-api.pump.fun/clips/{mint}`
- **Parameters**:
  - `limit` (Query): Number of clips.
  - `clipType` (Query): e.g., `COMPLETE`.
- **Response Schema**:
```json
{
  "clips": [
    {
      "clipId": "string",
      "startTime": "ISO8601",
      "duration": 790,
      "playlistUrl": "string",
      "thumbnailUrl": "string",
      "title": "string"
    }
  ],
  "hasMore": true
}
```

### Market Activity
- **Endpoint**: `GET https://swap-api.pump.fun/v1/coins/{mint}/market-activity`
- **Description**: OHLC-like volume and transaction statistics for different timeframes (5m, 1h, 6h, 24h).
- **Response Schema**:
```json
{
  "5m": { "numTxs": 10, "volumeUSD": 100.5, "priceChangePercent": 2.5 },
  "1h": { ... },
  "6h": { ... },
  "24h": { ... }
}
```
