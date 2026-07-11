import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  outputFileTracingIncludes: {
    "/*": ["./data/tamyz-ops.db"],
    "/api/import": ["./data/source/shymkent_prof_chem_contacts.xlsx"],
    "/data": ["./data/source/shymkent_prof_chem_contacts.xlsx"],
  },
};

export default nextConfig;
