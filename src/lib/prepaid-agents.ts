export interface PrepaidAgent {
  /** Synthetic mint identifier (not a real pump.fun mint). */
  mint: string;
  /** Owner wallet address. */
  wallet: string;
  name: string;
  ticker: string;
  /** Path served from /public, e.g. "https://firebasestorage.googleapis.com/v0/b/moltspaces.firebasestorage.app/o/openclaw%2Fmayor.jpeg?alt=media&token=f5420725-68c7-4051-85d1-ca41b071f4d7". */
  imageUrl: string;
  /** Droplet size to auto-select. */
  size: "2gb" | "4gb";
  /** Fake market cap shown on profile card. */
  fakeMcap: number;
}

export const PREPAID_AGENTS: PrepaidAgent[] = [
  {
    mint: "prepaid_mayor_31TpSHid",
    wallet: "31TpSHidXrpKZugvKQgZ3mRFhP8iCKyH2q9xMKL2fYH4",
    name: "Mayor",
    ticker: "$MAYOR",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/moltspaces.firebasestorage.app/o/openclaw%2Fmayor.jpeg?alt=media&token=f5420725-68c7-4051-85d1-ca41b071f4d7",
    size: "4gb",
    fakeMcap: 100_000,
  },
];

export function getPrepaidAgentsForWallet(wallet: string): PrepaidAgent[] {
  return PREPAID_AGENTS.filter((a) => a.wallet === wallet);
}

export function getPrepaidAgent(mint: string): PrepaidAgent | undefined {
  return PREPAID_AGENTS.find((a) => a.mint === mint);
}
