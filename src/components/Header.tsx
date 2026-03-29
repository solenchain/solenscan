"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useNetwork } from "@/context/NetworkContext";
import { NetworkId, networks, enabledNetworks } from "@/lib/networks";
import { SearchBar } from "./SearchBar";
import { NetworkBanner } from "./NetworkBanner";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/blocks", label: "Blocks" },
  { href: "/txs", label: "Transactions" },
  { href: "/events", label: "Events" },
];

export function Header() {
  const { networkId, setNetwork } = useNetwork();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <NetworkBanner />
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
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
                <span className="font-bold text-lg text-gray-900">
                  SolenScan
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <SearchBar />
              </div>
              {enabledNetworks.length > 1 ? (
                <select
                  value={networkId}
                  onChange={(e) => setNetwork(e.target.value as NetworkId)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{
                    borderLeftColor: networks[networkId].color,
                    borderLeftWidth: 3,
                  }}
                >
                  {enabledNetworks.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
                  style={{
                    borderLeftColor: networks[networkId].color,
                    borderLeftWidth: 3,
                  }}
                >
                  {networks[networkId].name}
                </span>
              )}
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <nav className="md:hidden pb-3 border-t border-gray-100 pt-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
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
