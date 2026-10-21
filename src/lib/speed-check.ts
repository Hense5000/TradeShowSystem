// The Speed check page (Super admin) compares where the app runs with where
// its database is. Each database query travels between the two, so they
// should be in the same place.

/** Vercel's function regions, by code (VERCEL_REGION). */
export const VERCEL_REGIONS: Record<string, string> = {
  iad1: "Washington, D.C., USA",
  cle1: "Cleveland, USA",
  pdx1: "Portland, USA",
  sfo1: "San Francisco, USA",
  yul1: "Montréal, Canada",
  gru1: "São Paulo, Brazil",
  fra1: "Frankfurt, Germany",
  arn1: "Stockholm, Sweden",
  cdg1: "Paris, France",
  dub1: "Dublin, Ireland",
  lhr1: "London, United Kingdom",
  sin1: "Singapore",
  syd1: "Sydney, Australia",
  hnd1: "Tokyo, Japan",
  kix1: "Osaka, Japan",
  icn1: "Seoul, South Korea",
  hkg1: "Hong Kong",
  bom1: "Mumbai, India",
  cpt1: "Cape Town, South Africa",
  dxb1: "Dubai, UAE",
};

/** Neon's database regions, with the Vercel region next to each. */
export const NEON_REGIONS: Record<string, { place: string; vercel: string }> = {
  "us-east-1": { place: "N. Virginia, USA", vercel: "iad1" },
  "us-east-2": { place: "Ohio, USA", vercel: "cle1" },
  "us-west-2": { place: "Oregon, USA", vercel: "pdx1" },
  "eu-central-1": { place: "Frankfurt, Germany", vercel: "fra1" },
  "eu-west-2": { place: "London, United Kingdom", vercel: "lhr1" },
  "ap-southeast-1": { place: "Singapore", vercel: "sin1" },
  "ap-southeast-2": { place: "Sydney, Australia", vercel: "syd1" },
  "sa-east-1": { place: "São Paulo, Brazil", vercel: "gru1" },
  "azure-eastus2": { place: "Virginia, USA (Azure)", vercel: "iad1" },
  "azure-westus3": { place: "Arizona, USA (Azure)", vercel: "sfo1" },
  "azure-gwc": { place: "Frankfurt, Germany (Azure)", vercel: "fra1" },
};

/** The Neon region in a database address, e.g. "eu-central-1" from ep-x-pooler.eu-central-1.aws.neon.tech, or null. */
export function neonRegion(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  let host: string;
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = /^[^.]+\.([a-z0-9-]+)\.(?:aws|azure)\.neon\.tech$/.exec(host);
  return match ? match[1] : null;
}

/** The middle of the sorted times. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
