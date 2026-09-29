import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Dev server opened from a phone on the local network (QR codes point to this IP)
  allowedDevOrigins: ['192.168.0.242'],
};

export default nextConfig;
