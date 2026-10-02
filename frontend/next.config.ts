import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// This computer's LAN addresses, so the dev server can be opened from a phone
// (QR codes point to this IP) even after the router hands out a new one.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter(a => a && a.family === "IPv4" && !a.internal)
  .map(a => a!.address);

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
