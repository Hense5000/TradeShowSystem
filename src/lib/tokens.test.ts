import { describe, expect, it } from "vitest";
import { createToken, hashToken, invitationExpiry, invitationState } from "./tokens";

describe("tokens", () => {
  it("stores only a hash that matches the token", () => {
    const { token, tokenHash } = createToken();
    expect(tokenHash).not.toContain(token);
    expect(hashToken(token)).toBe(tokenHash);
    expect(createToken().token).not.toBe(token);
  });

  it("works out the invitation state", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const open = { acceptedAt: null, revokedAt: null, expiresAt: invitationExpiry(now) };
    expect(invitationState(open, now)).toBe("pending");
    expect(invitationState({ ...open, acceptedAt: now }, now)).toBe("accepted");
    expect(invitationState({ ...open, revokedAt: now }, now)).toBe("revoked");
    expect(invitationState(open, new Date("2026-01-09T00:00:00Z"))).toBe("expired");
  });
});
