export interface DeployerToken {
  name: string;
  symbol: string;
  marketCap: number;
  volume: number;
}

export interface Deployer {
  address: string;
  displayName: string;
  /** Pump.fun profile avatar URL (or placeholder). */
  avatarUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  tokenCount: number;
  totalVolume: number;
  totalMarketCap: number;
  totalCreatorFees: number;
  mindshare: number;
  topTokens: DeployerToken[];
}

function addr(seed: number): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  let v = seed;
  for (let i = 0; i < 44; i++) {
    s += chars[(v * 7 + i * 13) % chars.length];
    v = (v * 31 + 17) & 0x7fffffff;
  }
  return s;
}

function truncAddr(a: string): string {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}

const KNOWN_NAMES: Record<number, string> = {
  0: "raydium_chad",
  1: "sol_whale_42",
  3: "degen_larry",
  5: "pump_king",
  8: "ape_master",
  12: "moon_sniper",
  18: "based_dev",
  22: "giga_deployer",
  27: "sol_maxi",
};

const KNOWN_SOCIALS: Record<number, { twitterUrl?: string; telegramUrl?: string; websiteUrl?: string }> = {
  0: { twitterUrl: "https://x.com/raydium_chad", telegramUrl: "https://t.me/raydium_chad", websiteUrl: "https://raydiumchad.com" },
  1: { twitterUrl: "https://x.com/sol_whale_42", websiteUrl: "https://solwhale.io" },
  3: { twitterUrl: "https://x.com/degen_larry", telegramUrl: "https://t.me/degenlarry" },
  5: { twitterUrl: "https://x.com/pump_king", telegramUrl: "https://t.me/pumpking", websiteUrl: "https://pumpking.lol" },
  8: { twitterUrl: "https://x.com/ape_master" },
  12: { twitterUrl: "https://x.com/moon_sniper", websiteUrl: "https://moonsniper.xyz" },
  18: { twitterUrl: "https://x.com/based_dev", telegramUrl: "https://t.me/baseddev" },
  22: { twitterUrl: "https://x.com/giga_deployer" },
  27: { twitterUrl: "https://x.com/sol_maxi", websiteUrl: "https://solmaxi.dev" },
};

const TOKEN_NAMES = [
  "BONK2", "PEPE SOL", "DOGE2", "CATCOIN", "MOONSHOT", "PUMPKIN",
  "SOLARFLARE", "MEMEKING", "GIGACHAD", "SOLAPE", "WAGMI", "NGMI",
  "FROGCOIN", "LAMBO", "DEGENCOIN", "BULLRUN", "SENDIT", "YOLO",
  "MOONCOIN", "ROCKETFUEL", "ALPHACOIN", "BETACOIN", "GAMMATOKEN",
  "DELTASWAP", "EPSILON", "ZETACOIN", "THETASWAP", "IOTACHAIN",
  "KAPPAFI", "SIGMACOIN", "OMEGADEX", "PSISWAP", "PHITOKEN",
  "CHICOIN", "RHOCOIN", "TAUCOIN", "UPSILONFI", "XICHAIN",
];

function makeTopTokens(seed: number): DeployerToken[] {
  const count = 4 + (seed % 5);
  const tokens: DeployerToken[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (seed * 7 + i * 13) % TOKEN_NAMES.length;
    const name = TOKEN_NAMES[idx];
    const sym = name.replace(/\s/g, "").slice(0, 5).toUpperCase();
    const mcap = Math.round(((seed + 1) * 47 + i * 230) % 5000 + 100 + Math.pow(count - i, 2) * 200);
    const vol = Math.round(mcap * (0.3 + ((seed * 3 + i) % 10) / 10));
    tokens.push({ name, symbol: sym, marketCap: mcap, volume: vol });
  }
  return tokens.sort((a, b) => b.marketCap - a.marketCap);
}

/** Placeholder avatar URL (pump.fun-style or deterministic). Replace with real pump.fun avatar when available. */
function avatarUrl(address: string, displayName: string): string {
  const name = encodeURIComponent(displayName.replace(/\s/g, "+"));
  return `https://ui-avatars.com/api/?name=${name}&size=64&background=3b82f6&color=fff`;
}

const RAW: Omit<Deployer, "mindshare">[] = [];
for (let i = 0; i < 30; i++) {
  const a = addr(i + 1000);
  const displayName = KNOWN_NAMES[i] ?? truncAddr(a);
  const scale = Math.pow(1 - i / 32, 2.2);
  const socials = KNOWN_SOCIALS[i] ?? {};
  RAW.push({
    address: a,
    displayName,
    avatarUrl: avatarUrl(a, displayName),
    ...socials,
    tokenCount: Math.round(120 * scale + 3 + (i % 5)),
    totalVolume: Math.round(85000 * scale + 500 + ((i * 73) % 3000)),
    totalMarketCap: Math.round(210000 * scale + 1000 + ((i * 137) % 8000)),
    totalCreatorFees: Math.round(4200 * scale + 20 + ((i * 29) % 400)),
    topTokens: makeTopTokens(i),
  });
}

function normalise(vals: number[]): number[] {
  const max = Math.max(...vals, 1);
  return vals.map((v) => v / max);
}

const nVol = normalise(RAW.map((d) => d.totalVolume));
const nMcap = normalise(RAW.map((d) => d.totalMarketCap));
const nFees = normalise(RAW.map((d) => d.totalCreatorFees));

export const DEPLOYERS: Deployer[] = RAW.map((d, i) => ({
  ...d,
  mindshare: Math.round((nVol[i] * 0.4 + nMcap[i] * 0.35 + nFees[i] * 0.25) * 1000) / 10,
}));

export type MetricKey = "totalVolume" | "totalMarketCap" | "totalCreatorFees" | "mindshare";

export const METRIC_LABELS: Record<MetricKey, string> = {
  totalVolume: "Total Volume",
  totalMarketCap: "Total Market Cap",
  totalCreatorFees: "Creator Fees",
  mindshare: "Mindshare",
};

export const METRIC_UNITS: Record<MetricKey, string> = {
  totalVolume: "SOL",
  totalMarketCap: "SOL",
  totalCreatorFees: "SOL",
  mindshare: "",
};
