import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages (custom domain finance.ayudhas.com → served from the domain root;
 * ayudhas.com itself is the separate Ayudhas brand website).
 * No server features are used: all data is fetched client-side from NEXT_PUBLIC_API_BASE_URL.
 * Set NEXT_PUBLIC_BASE_PATH only when hosting under a sub-path (e.g. user.github.io/repo).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // /loans/ → loans/index.html, which GitHub Pages serves on refresh
  images: { unoptimized: true },
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
