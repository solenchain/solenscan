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
        placeholder="Search by block, tx (384-0), or account..."
        className="w-full sm:w-80 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
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
  // Account ID: hex string
  return `/account/${q}`;
}
