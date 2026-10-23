import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // CVs are uploaded through server actions; Vercel caps request bodies at
  // 4.5 MB, so the app limits a CV to 4 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default withNextIntl(nextConfig);
