"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 text-center bg-[#060608] text-white">
      <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
      <p className="text-zinc-400 text-sm mb-4 max-w-md">{typeof error.message === "string" ? error.message : "An unexpected error occurred."}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 text-sm font-medium"
        >
          Back to Eve
        </Link>
      </div>
    </div>
  );
}
