export interface PumpFunCoin {
  mint: string;
  initialized: boolean;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  bonding_curve: string;
  associated_bonding_curve: string;
  creator: string;
  created_timestamp: number;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  total_supply: number;
  show_name: boolean;
  last_trade_timestamp: number;
  nsfw: boolean;
  inverted: boolean;
  is_banned: boolean;
  pump_swap_pool: string;
  real_sol_reserves: number;
  real_token_reserves: number;
  updated_at: string;
  livestream_ban_expiry: number;
  reply_count: number;
  is_currently_live: boolean;
  ath_market_cap: number;
  ath_market_cap_timestamp: number;
  hide_banner: boolean;
  program: string;
  token_program: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  pool_address: string;
  is_cashback_enabled: boolean;
  usd_market_cap: number;
  is_hackathon: boolean;
  created_at: number;
  candlesticks: any[];
  volatility_score: number;
  recommendation_rank: number;
  recommendation_id: string;
}

export interface CreatorAggregateToken {
  name: string;
  symbol: string;
  usd_market_cap: number;
  volume: number;
  mint?: string;
  description?: string;
  image_uri?: string;
  twitter?: string;
  created_timestamp?: number;
  last_trade_timestamp?: number;
  complete?: boolean;
  ath_market_cap?: number;
}

export interface CreatorAggregate {
  creator: string;
  creator_display_name: string;
  avatar_url?: string;
  twitter_url?: string;
  telegram_url?: string;
  website_url?: string;
  token_count: number;
  /** Number of tokens with complete === true (bonded) */
  bonded: number;
  volume: number;
  usd_market_cap: number;
  total_ath_market_cap: number;
  creator_fees: number;
  mindshare: number;
  top_tokens: CreatorAggregateToken[];
  /** All tokens where complete === true (bonded/migrated) */
  bonded_tokens: CreatorAggregateToken[];
  /** pump.fun profile fields */
  username?: string;
  profile_image?: string;
  followers_count?: number;
  following_count?: number;
  likes_received?: number;
  mentions_received?: number;
  bio?: string;
  x_username?: string;
  /** Engagement metric components */
  total_replies?: number;
  recent_trade_count?: number;
  /** 0–1 score: 0.4*replies + 0.4*recent_trades + 0.2*profile (likes+mentions), normalized */
  engagement?: number;
  /** Marginal volume by band [6h-24h, 1h-6h, 5m-1h, 0-5m] for ramp sparkline */
  volumeProfile?: number[];
}

export interface PumpFunFollower {
  username?: string | null;
  profile_image?: string | null;
  address: string;
  timestamp: number;
  followers?: number | null;
}

export interface PumpFunBalanceSummary {
  total_value: number;
  native_balance: number;
  native_lamports: number;
  sol_price: number;
  token_count: number;
  last_update_ts: number;
  portfolioPnL?: number | null;
}

export interface PumpFunBalanceToken {
  mint: string;
  amount: number;
  usd_value: number;
  symbol?: string;
  name?: string;
  image_uri?: string;
}

export interface PumpFunCreatorFees {
  totalFees?: string;
  totalFeesSOL?: string;
}

export interface DeployerAnalytics {
  followers: PumpFunFollower[];
  following: PumpFunFollower[];
  balanceSummary: PumpFunBalanceSummary | null;
  balances: PumpFunBalanceToken[];
  createdCoins: PumpFunCoin[];
  fees?: PumpFunCreatorFees | null;
}


/* ── Creator Insight Analytics ────────────────────────────────── */

export interface CoinTrade {
  slotIndexId: string;
  tx: string;
  timestamp: string;
  userAddress: string;
  type: "buy" | "sell";
  program: string;
  priceUsd: string;
  priceSol: string;
  amountUsd: string;
  amountSol: string;
  baseAmount: string;
  quoteAmount: string;
}

export interface CoinClipVariant {
  name: string;
  height: number;
  playlistUrl: string;
}

export interface CoinClip {
  roomName: string;
  clipId: string;
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  playlistUrl: string;
  variants: CoinClipVariant[];
  thumbnailUrl: string;
  title: string;
  clipType: string;
  createdAt: string;
  viewCount: number;
}

export interface ChatMessage {
  username: string;
  text: string;
  timestamp: number;
  profileImage?: string;
  userId?: string;
}

export interface ParticipantInsight {
  address: string;
  username?: string;
  profileImage?: string;
  buyCount: number;
  sellCount: number;
  buyVolumeSol: number;
  sellVolumeSol: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  netVolumeSol: number;
  messageCount: number;
  firstSeen: string;
  contributionScore: number;
}

export interface CreatorInsightCoin {
  mint: string;
  name: string;
  symbol: string;
  image_uri: string;
  usd_market_cap: number;
  ath_market_cap: number;
  created_timestamp: number;
  complete: boolean;
  reply_count: number;
  creator: string;
}

export interface CreatorInsightResponse {
  coin: CreatorInsightCoin;
  totalParticipants: number;
  totalBuyVolumeSol: number;
  totalSellVolumeSol: number;
  totalMessages: number;
  totalClips: number;
  participants: ParticipantInsight[];
}
