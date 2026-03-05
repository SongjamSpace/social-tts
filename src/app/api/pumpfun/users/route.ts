import { NextResponse } from "next/server";

export interface PumpFunUserProfile {
  address: string;
  username?: string | null;
  profile_image?: string | null;
  followers?: number;
  following?: number;
  likes_received?: number;
  mentions_received?: number;
  bio?: string | null;
  x_username?: string | null;
}

/**
 * POST /api/pumpfun/users
 * Body: { addresses: string[] }
 * Returns a map of address -> profile for each successfully fetched creator.
 */
export async function POST(request: Request) {
  try {
    const { addresses } = (await request.json()) as { addresses: string[] };

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { success: false, error: "addresses array is required" },
        { status: 400 }
      );
    }

    const unique = [...new Set(addresses)].slice(0, 50);

    const results = await Promise.allSettled(
      unique.map(async (addr) => {
        const res = await fetch(
          `https://frontend-api-v3.pump.fun/users/${addr}`,
          { next: { revalidate: 300 } }
        );
        if (!res.ok) return { address: addr } as PumpFunUserProfile;
        const data = await res.json();
        return {
          address: data.address ?? addr,
          username: data.username ?? null,
          profile_image: data.profile_image ?? null,
          followers: data.followers ?? 0,
          following: data.following ?? 0,
          likes_received: data.likes_received ?? 0,
          mentions_received: data.mentions_received ?? 0,
          bio: data.bio ?? null,
          x_username: data.x_username ?? null,
        } as PumpFunUserProfile;
      })
    );

    const profiles: Record<string, PumpFunUserProfile> = {};
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value.address) {
        profiles[r.value.address] = r.value;
      }
    });

    return NextResponse.json({ success: true, profiles });
  } catch (error: any) {
    console.error("Error fetching pump.fun user profiles:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
