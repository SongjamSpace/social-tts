"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#060608", color: "#fafafa", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#a1a1aa", fontSize: "0.875rem", marginBottom: "1.5rem" }}>{error.message}</p>
        <button
          type="button"
          onClick={reset}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "0.75rem", padding: "0.5rem 1rem", color: "#fafafa", fontSize: "0.875rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
