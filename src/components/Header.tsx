"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { useTheme } from "@/context/ThemeContext";
import { SearchBar } from "./SearchBar";
import { NetworkBanner } from "./NetworkBanner";

const mainNavItems = [
  { href: "/blocks", label: "Blocks" },
  { href: "/txs", label: "Transactions" },
  { href: "/events", label: "Events" },
  { href: "/validators", label: "Validators" },
  { href: "/stats", label: "Status" },
  { href: "/richlist", label: "Rich List" },
];

const moreNavItems = [
  { href: "/contracts", label: "Contracts" },
  { href: "/governance", label: "Governance" },
  { href: "/rollups", label: "Rollups" },
  { href: "/intents", label: "Intents" },
];

const allNavItems = [...mainNavItems, ...moreNavItems];

export function Header() {
  void useNetwork(); // context needed for re-render on network change
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <NetworkBanner />
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="SolenScan"
                  width={28}
                  height={28}
                  className="h-7 w-7"
                />
                <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  SolenScan
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setMoreOpen(!moreOpen)}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
                  >
                    More
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}>
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {moreOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                      {moreNavItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <SearchBar />
              </div>
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <nav className="md:hidden pb-3 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {item.label}
                </Link>
              ))}
              <div className="px-3 pt-2">
                <SearchBar />
              </div>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
