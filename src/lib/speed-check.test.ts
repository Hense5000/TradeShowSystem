import { describe, expect, it } from "vitest";
import { median, NEON_REGIONS, neonRegion, VERCEL_REGIONS } from "./speed-check";

describe("speed check", () => {
  it("reads the Neon region from the database address", () => {
    expect(neonRegion("postgresql://u:p@ep-cool-name-a1b2c3-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require")).toBe("eu-central-1");
    expect(neonRegion("postgresql://u:p@ep-x.azure-gwc.azure.neon.tech/db")).toBe("azure-gwc");
    expect(neonRegion("postgres://u:p@ep-cool-name-a1b2c3-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require")).toBe("eu-central-1");
    expect(neonRegion("postgresql://app:app@localhost:5432/tradeshow")).toBeNull();
    expect(neonRegion(undefined)).toBeNull();
    expect(neonRegion("not a url")).toBeNull();
  });

  it("pairs every Neon region with a known Vercel region", () => {
    for (const r of Object.values(NEON_REGIONS)) expect(VERCEL_REGIONS[r.vercel]).toBeDefined();
  });

  it("takes the middle time", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
