import type { NextConfig } from "next";

// Webapp serves under /asagiri everywhere — both behind the Caddy
// gateway (api.brightraven.world/asagiri/...) and on bare localhost
// (http://localhost:3689/asagiri/...). Single fixed prefix keeps the
// asset URLs aligned with the public path; visiting localhost:3689/
// will 404, which is intentional — always use /asagiri.
const nextConfig: NextConfig = {
  basePath: "/asagiri",
  assetPrefix: "/asagiri",
};

export default nextConfig;
