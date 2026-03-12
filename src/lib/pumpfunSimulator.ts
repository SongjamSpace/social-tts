export type LiveTokenUpdate = {
  mint: string;
  timestamp: number;
  viewer_count: number;
  market_cap: number;
  token_age: number;
  buy_tx_last_30s: number;
  sell_tx_last_30s: number;
  name?: string;
  symbol?: string;
};

export type CheckResult = {
  condition: string;
  status: "pass" | "fail";
  value?: any;
  threshold?: any;
};

export type CheckLog = {
  mint: string;
  name: string;
  symbol: string;
  timestamp: number;
  results: CheckResult[];
  passed: boolean;
};

export type SimulatorPosition = {
  mint: string;
  name: string;
  symbol: string;
  entryMarketCap: number;
  entryTimestamp: number;
  entryViewers: number;
  stakeSol: number;
  peakMarketCap: number;
};

export type SimulatorTrade = {
  mint: string;
  name: string;
  symbol: string;
  entryMarketCap: number;
  exitMarketCap: number;
  pnlRatio: number;
  pnlSol: number;
  stakeSol: number;
  entryTimestamp: number;
  exitTimestamp: number;
  holdMs: number;
  exitReason: "take_profit" | "stop_loss" | "viewer_collapse" | "time_exit" | "trailing_stop";
};

export type SimulatorState = {
  initialCapital: number;
  capital: number;
  riskPct: number;
  positions: Record<string, SimulatorPosition>;
  trades: SimulatorTrade[];
  logs: CheckLog[];
  lastByMint: Record<string, { viewer_count: number; market_cap: number; timestamp: number }>;
  summary: {
    totalTrades: number;
    winRate: number;
    totalPnLSol: number;
    avgHoldMs: number;
  };
};

type HistoryPoint = {
  timestamp: number;
  viewer_count: number;
  market_cap: number;
};

export class PumpfunLivestreamSimulator {
  private positions: Record<string, SimulatorPosition>;
  private history: Record<string, HistoryPoint[]>;
  private trades: SimulatorTrade[];
  private logs: CheckLog[];
  private lastByMint: Record<string, { viewer_count: number; market_cap: number; timestamp: number }>;
  private capital: number;
  private initialCapital: number;
  private riskPct: number;

  constructor(initialCapital = 5, riskPct = 0.02) {
    this.positions = {};
    this.history = {};
    this.trades = [];
    this.logs = [];
    this.lastByMint = {};
    this.initialCapital = initialCapital;
    this.capital = initialCapital;
    this.riskPct = riskPct;
  }

  update(token: LiveTokenUpdate) {
    const { mint, viewer_count, market_cap, timestamp } = token;

    if (!this.history[mint]) {
      this.history[mint] = [];
    }

    const history = this.history[mint];
    history.push({ viewer_count, market_cap, timestamp });
    this.lastByMint[mint] = { viewer_count, market_cap, timestamp };

    // Trim old history beyond 10 minutes to keep memory bounded.
    const cutoff = timestamp - 10 * 60 * 1000;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }

    const viewers30s = this.getViewersAtOrBefore(history, timestamp - 30_000);
    const viewers60s = this.getViewersAtOrBefore(history, timestamp - 60_000);

    // ENTRY STRATEGY
    if (!this.positions[mint]) {
      if (viewers30s !== null && viewers60s !== null) {
        const viewerVelocity = viewer_count - viewers30s;
        
        const results: CheckResult[] = [
          { condition: "Min Viewers", status: viewer_count >= 8 ? "pass" : "fail", value: viewer_count, threshold: 8 },
          { condition: "Max Viewers", status: viewer_count <= 25 ? "pass" : "fail", value: viewer_count, threshold: 25 },
          { condition: "Viewer Velocity", status: viewerVelocity >= 4 ? "pass" : "fail", value: viewerVelocity, threshold: 4 },
          { condition: "Viewer Trend", status: viewer_count > viewers60s ? "pass" : "fail", value: viewer_count, threshold: `> ${viewers60s}` },
          { condition: "Min Mcap", status: market_cap >= 15_000 ? "pass" : "fail", value: Math.round(market_cap), threshold: 15_000 },
          { condition: "Max Mcap", status: market_cap <= 250_000 ? "pass" : "fail", value: Math.round(market_cap), threshold: 250_000 },
          { condition: "Token Age", status: token.token_age > 90 ? "pass" : "fail", value: Math.round(token.token_age), threshold: 90 },
          { condition: "Buy Pressure", status: token.buy_tx_last_30s > token.sell_tx_last_30s ? "pass" : "fail", value: token.buy_tx_last_30s, threshold: `> ${token.sell_tx_last_30s}` }
        ];

        const meetsEntry = results.every(r => r.status === "pass");

        this.logs.unshift({
          mint,
          name: token.name ?? mint,
          symbol: token.symbol ?? "",
          timestamp: Date.now(),
          results,
          passed: meetsEntry
        });

        if (this.logs.length > 50) this.logs.pop();

        if (meetsEntry) {
          const stakeSol = this.capital * this.riskPct;
          if (stakeSol > 0 && this.capital >= stakeSol) {
            this.positions[mint] = {
              mint,
              name: token.name ?? mint,
              symbol: token.symbol ?? "",
              entryMarketCap: market_cap,
              entryTimestamp: timestamp,
              entryViewers: viewer_count,
              stakeSol,
              peakMarketCap: market_cap
            };
            this.capital -= stakeSol;
          }
        }
      }
    }

    // EXIT STRATEGY
    const pos = this.positions[mint];
    if (!pos) return;

    if (market_cap > pos.peakMarketCap) {
      pos.peakMarketCap = market_cap;
    }

    const takeProfit = market_cap >= pos.entryMarketCap * 2;
    const stopLoss = market_cap <= pos.entryMarketCap * 0.7;
    const viewerCollapse = viewer_count <= pos.entryViewers * 0.6;
    const timeExit = timestamp - pos.entryTimestamp >= 6 * 60 * 1000;
    const trailingStop =
      pos.peakMarketCap >= pos.entryMarketCap * 3 && market_cap <= pos.peakMarketCap * 0.8;

    if (takeProfit) {
      this.closePosition(mint, market_cap, timestamp, "take_profit");
    } else if (stopLoss) {
      this.closePosition(mint, market_cap, timestamp, "stop_loss");
    } else if (viewerCollapse) {
      this.closePosition(mint, market_cap, timestamp, "viewer_collapse");
    } else if (timeExit) {
      this.closePosition(mint, market_cap, timestamp, "time_exit");
    } else if (trailingStop) {
      this.closePosition(mint, market_cap, timestamp, "trailing_stop");
    }
  }

  private closePosition(
    mint: string,
    exitMarketCap: number,
    timestamp: number,
    exitReason: SimulatorTrade["exitReason"]
  ) {
    const pos = this.positions[mint];
    if (!pos) return;

    const pnlRatio = (exitMarketCap - pos.entryMarketCap) / pos.entryMarketCap;
    const pnlSol = pos.stakeSol * pnlRatio;
    const returnedSol = pos.stakeSol + pnlSol;
    const holdMs = timestamp - pos.entryTimestamp;

    this.trades.push({
      mint,
      name: pos.name,
      symbol: pos.symbol,
      entryMarketCap: pos.entryMarketCap,
      exitMarketCap,
      pnlRatio,
      pnlSol,
      stakeSol: pos.stakeSol,
      entryTimestamp: pos.entryTimestamp,
      exitTimestamp: timestamp,
      holdMs,
      exitReason
    });

    this.capital += returnedSol;
    delete this.positions[mint];
  }

  private getViewersAtOrBefore(history: HistoryPoint[], targetTs: number) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].timestamp <= targetTs) {
        return history[i].viewer_count;
      }
    }
    return null;
  }

  getState(): SimulatorState {
    const totalTrades = this.trades.length;
    const wins = this.trades.filter((t) => t.pnlRatio > 0).length;
    const totalPnLSol = this.trades.reduce((acc, t) => acc + t.pnlSol, 0);
    const avgHoldMs =
      totalTrades > 0 ? this.trades.reduce((acc, t) => acc + t.holdMs, 0) / totalTrades : 0;

    return {
      initialCapital: this.initialCapital,
      capital: this.capital,
      riskPct: this.riskPct,
      positions: { ...this.positions },
      trades: [...this.trades].reverse(),
      logs: [...this.logs],
      lastByMint: { ...this.lastByMint },
      summary: {
        totalTrades,
        winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
        totalPnLSol,
        avgHoldMs
      }
    };
  }
}
