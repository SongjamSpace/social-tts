"use client";

import { Providers } from "@/components/providers";

export function ProvidersWithRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
