import type { FeatureRollout } from "@prisma/client";
import { z } from "zod";

// Features are switched on by platform admins on the super admin page. A
// customer account only ever sees a feature when this says it may.

export const ROLLOUT_LABEL: Record<FeatureRollout, string> = {
  OFF: "Off",
  SELECTED: "Selected accounts",
  EVERYONE: "Everyone",
};

/** Whether an account can see a feature. */
export function isFeatureVisible(
  feature: { rollout: FeatureRollout; access?: { organizationId: string }[] },
  organizationId: string,
): boolean {
  if (feature.rollout === "EVERYONE") return true;
  if (feature.rollout === "SELECTED") return (feature.access ?? []).some((a) => a.organizationId === organizationId);
  return false;
}

export const featureSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for the feature.").max(80, "Name can be at most 80 characters."),
  description: z
    .string()
    .trim()
    .max(500, "Description can be at most 500 characters.")
    .transform((v) => v || null),
  rollout: z.enum(["OFF", "SELECTED", "EVERYONE"], "Choose who can see the feature."),
});

export type FeatureInput = z.infer<typeof featureSchema>;

/** Database filter for the features an account can see (see isFeatureVisible). */
export function visibleFeaturesWhere(organizationId: string) {
  return {
    OR: [{ rollout: "EVERYONE" as const }, { rollout: "SELECTED" as const, access: { some: { organizationId } } }],
  };
}
