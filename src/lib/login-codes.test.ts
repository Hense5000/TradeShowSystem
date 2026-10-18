import { describe, expect, it } from "vitest";
import { checkLoginCode, createLoginCode, LOGIN_CODE_MAX_ATTEMPTS, loginCodeHash, maskEmail, normalizeCode } from "./login-codes";

describe("login codes", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const record = {
    id: "lc1",
    codeHash: loginCodeHash("lc1", "042917"),
    attempts: 0,
    expiresAt: new Date("2026-10-18T12:10:00Z"),
    usedAt: null,
  };

  it("creates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(createLoginCode()).toMatch(/^\d{6}$/);
  });

  it("accepts the right code, also typed with spaces or a dash", () => {
    expect(checkLoginCode(record, "042917", now)).toBe("ok");
    expect(checkLoginCode(record, "042 917", now)).toBe("ok");
    expect(normalizeCode("042-917")).toBe("042917");
  });

  it("rejects wrong, expired, used and over-tried codes", () => {
    expect(checkLoginCode(record, "000000", now)).toBe("wrong");
    expect(checkLoginCode(record, "042917", new Date("2026-10-18T12:10:00Z"))).toBe("expired");
    expect(checkLoginCode({ ...record, usedAt: now }, "042917", now)).toBe("used");
    expect(checkLoginCode({ ...record, attempts: LOGIN_CODE_MAX_ATTEMPTS }, "042917", now)).toBe("too-many");
  });

  it("salts the hash with the code's id", () => {
    expect(loginCodeHash("a", "123456")).not.toBe(loginCodeHash("b", "123456"));
  });

  it("masks email addresses", () => {
    expect(maskEmail("henrik@example.com")).toBe("h***@example.com");
  });
});
