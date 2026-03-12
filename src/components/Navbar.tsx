"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/** Eve logo: inverted (white on transparent). Container sets size; img keeps aspect ratio. */
function EveLogoIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`}>
      <img
        src="/images/eve-logo.png"
        alt=""
        className="max-h-full max-w-full object-contain"
        aria-hidden
      />
    </span>
  );
}

const BIP_OPTIONS = [
  { id: "001", label: "#001", href: "https://moltspaces.com/pumpfun", external: true },
  { id: "002", label: "#002", href: "/voices", external: false },
  { id: "003", label: "#003", href: "/", external: false },
  { id: "004", label: "#004", href: "/openclaw", external: false },
  { id: "005", label: "Profile", href: "/profile", external: false },
];

export default function Navbar() {
  const pathname = usePathname();
  const [bipOpen, setBipOpen] = useState(false);
  const bipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bipRef.current && !bipRef.current.contains(e.target as Node)) {
        setBipOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#060608]/80 backdrop-blur-xl">
      <div className="px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group text-white">
          <EveLogoIcon className="w-7 h-7 shrink-0" />
          <span className="text-lg font-black tracking-tight" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
            Eve<sup className="ml-0.5 text-[10px] font-semibold opacity-80 align-super">alpha</sup>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <div className="relative" ref={bipRef}>
            <button
              type="button"
              onClick={() => setBipOpen((o) => !o)}
              className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                pathname === "/voices" || pathname === "/" || pathname === "/openclaw" || pathname?.startsWith("/profile")
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {(pathname === "/voices" || pathname === "/" || pathname === "/openclaw" || pathname?.startsWith("/profile")) && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">BiP</span>
              <span className="relative z-10 ml-1 opacity-70">▾</span>
            </button>
            {bipOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-lg bg-[#111113] border border-white/10 shadow-xl z-50">
                {BIP_OPTIONS.map((opt) =>
                  opt.external ? (
                    <a
                      key={opt.id}
                      href={opt.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setBipOpen(false)}
                    >
                      {opt.label}
                    </a>
                  ) : (
                    <Link
                      key={opt.id}
                      href={opt.href}
                      className="block px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setBipOpen(false)}
                    >
                      {opt.label}
                    </Link>
                  )
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
