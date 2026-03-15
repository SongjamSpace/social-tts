"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirect legacy hatch URL to spawn flow.
 */
export default function HatchRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const mint = params?.mint as string | undefined;

  useEffect(() => {
    if (mint) router.replace(`/spawn/${encodeURIComponent(mint)}`);
  }, [mint, router]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#060608] text-white px-4">
      <p className="text-zinc-400">Redirecting to spawn…</p>
    </div>
  );
}
