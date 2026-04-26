import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Match solenchain.io dark-mode palette. These shades are only
        // referenced via `dark:bg-slate-*` / `dark:border-slate-*` in this
        // codebase, so overriding them shifts dark-mode surfaces without
        // touching light mode.
        slate: {
          800: "#1f242e",
          900: "#1a1e27",
          950: "#11141b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
