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
}

export interface CreatorAggregate {
  creator: string;
  creator_display_name: string;
  avatar_url?: string;
  twitter_url?: string;
  telegram_url?: string;
  website_url?: string;
  token_count: number;
  volume: number;
  usd_market_cap: number;
  creator_fees: number;
  mindshare: number;
  top_tokens: CreatorAggregateToken[];
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

