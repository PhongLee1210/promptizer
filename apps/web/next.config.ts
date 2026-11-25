import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/((?!_next/static|_next/image).*)", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

export default nextConfig;
