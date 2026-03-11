"use client";

import React from "react";
import { type PumpFunCoin } from "@/types/pumpfun";
import LiveTokenCard from "./LiveTokenCard";

interface LiveTokenGridProps {
  coins: PumpFunCoin[];
  viewerCounts: Record<string, number>;
}

export default function LiveTokenGrid({ coins, viewerCounts }: LiveTokenGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {coins.map((coin) => (
        <LiveTokenCard key={coin.mint} coin={coin} viewers={viewerCounts[coin.mint]} />
      ))}
    </div>
  );
}
