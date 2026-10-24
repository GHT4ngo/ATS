import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // CVs are uploaded through server actions; Vercel caps request bodies at
  // 4.5 MB, so the app limits a CV to 4 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // Pages merged into others; old links and bookmarks still land somewhere.
  async redirects() {
    return [
      { source: "/team", destination: "/dashboard", permanent: false },
      { source: "/settings", destination: "/dashboard", permanent: false },
      {
        source: "/admin/:page(organizations|users)",
        destination: "/admin/customers",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
