import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // `/final-shift` is unlisted — reachable only by direct link. The layout's `robots`
        // metadata covers the HTML; these headers cover everything it can't.
        source: "/final-shift/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, noimageindex",
          },
          {
            // The important one. Without it the invite URL leaks in the Referer header to
            // *.supabase.co on every signed image load, and to any link a guest taps out of
            // the wall.
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        source: "/api/final-shift/:path*",
        headers: [
          // API responses have no <head>, so the metadata export can't reach them.
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, noimageindex",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Vary", value: "Cookie" },
        ],
      },
    ];
  },
};

export default nextConfig;
