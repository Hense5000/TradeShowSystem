import { describe, expect, it } from "vitest";
import { featureSchema, isFeatureVisible } from "./features";

describe("isFeatureVisible", () => {
  const access = [{ organizationId: "a" }];

  it("hides features that are off, even from accounts that were picked", () => {
    expect(isFeatureVisible({ rollout: "OFF", access }, "a")).toBe(false);
  });

  it("shows selected features only to the picked accounts", () => {
    expect(isFeatureVisible({ rollout: "SELECTED", access }, "a")).toBe(true);
    expect(isFeatureVisible({ rollout: "SELECTED", access }, "b")).toBe(false);
    expect(isFeatureVisible({ rollout: "SELECTED" }, "a")).toBe(false);
  });

  it("shows features switched on for everyone to every account", () => {
    expect(isFeatureVisible({ rollout: "EVERYONE" }, "b")).toBe(true);
  });
});

describe("featureSchema", () => {
  it("needs a name and a known rollout", () => {
    expect(featureSchema.safeParse({ name: "", description: "", rollout: "OFF" }).success).toBe(false);
    expect(featureSchema.safeParse({ name: "X", description: "", rollout: "SOME" }).success).toBe(false);
    expect(featureSchema.parse({ name: " X ", description: " ", rollout: "SELECTED" })).toEqual({
      name: "X",
      description: null,
      rollout: "SELECTED",
    });
  });
});
