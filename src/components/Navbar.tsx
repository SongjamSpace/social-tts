"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/** Elegant female profile — outline only (stroke) so the face contour is unmistakable. */
function EveLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Closed outline: neck → chin → lips → nose → forehead → crown → hair → nape → neck */}
      <path
        d="M 8 26
           C 6 24 7 21 8 22
           C 9 20 10 18 11 18.5
           C 12 17 13 15 13 12.5
           C 13 10 12 8 11 8.5
           C 10 6 10 4 11 3
           C 13 1 16 1 18 2.5
           C 21 1 25 3 26 7
           C 27 11 26 16 23 19
           C 20 22 15 24 10 25
           C 9 25 8 26 8 26 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Analytics" },
  { href: "/voices", label: "Voice Unleashed" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#060608]/80 backdrop-blur-xl">
      <div className="px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group text-white">
          <EveLogoIcon className="w-7 h-7 shrink-0" />
          <span className="text-lg font-black tracking-tight" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
            Eve
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  active
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className="ml-3 px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 border border-violet-400/60 rounded-lg transition-colors"
          >
            Log in
          </button>
        </div>
      </div>
    </nav>
  );
}
