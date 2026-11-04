import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secret-box";

describe("secret box", () => {
  it("opens what it sealed", () => {
    const sealed = sealSecret("abc123key", "s1");
    expect(sealed).not.toContain("abc123key");
    expect(openSecret(sealed, "s1")).toBe("abc123key");
  });

  it("gives a new text each time", () => {
    expect(sealSecret("same", "s1")).not.toBe(sealSecret("same", "s1"));
  });

  it("cannot be opened with another secret or after tampering", () => {
    const sealed = sealSecret("abc123key", "s1");
    expect(openSecret(sealed, "s2")).toBeNull();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(openSecret(parts.join("."), "s1")).toBeNull();
    expect(openSecret("garbage", "s1")).toBeNull();
  });
});
