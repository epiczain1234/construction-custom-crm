import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project sits on the iCloud-synced Desktop, where iCloud churns the dev build dir
  // and corrupts it mid-write (missing manifests, "Unable to write SST file"). macOS skips
  // syncing any path ending in `.nosync`. Use that only for the dev server; production
  // build/start keep the standard `.next` so the deploy pipeline is unaffected.
  distDir: process.env.NODE_ENV === "development" ? ".next.nosync" : ".next",
};

export default nextConfig;
