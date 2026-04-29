"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(resolveSearch(q));
    setQuery("");
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by block, tx (384-0 or hash), or account..."
        className="w-full sm:w-80 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-950 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-indigo-600"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </form>
  );
}

export function resolveSearch(q: string): string {
  // Transaction ID: 384-0
  if (/^\d+-\d+$/.test(q)) {
    return `/tx/${q}`;
  }
  // Block height: pure number
  if (/^\d+$/.test(q)) {
    return `/block/${q}`;
  }
  // Transaction hash: 64 hex chars, optional 0x prefix.
  // Addresses also fit this pattern when in hex form, but they're 32 bytes
  // and rarely pasted as raw hex (Base58 is ~44 chars). We resolve to /tx/hash/
  // first; the page falls back to account lookup on 404.
  const hex = q.replace(/^0x/i, "").toLowerCase();
  if (/^[0-9a-f]{64}$/.test(hex)) {
    return `/tx/hash/${hex}`;
  }
  // Account ID: hex or Base58 address
  return `/account/${q}`;
}
