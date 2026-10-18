import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { emailSender } = await import("./email");

describe("emailSender", () => {
  it("keeps a correct sender as is", () => {
    expect(emailSender("Trade Show System <noreply@ngasoft.dk>")).toBe("Trade Show System <noreply@ngasoft.dk>");
    expect(emailSender("noreply@ngasoft.dk")).toBe("noreply@ngasoft.dk");
  });

  it("repairs what easily goes wrong when typed into Vercel", () => {
    expect(emailSender(' "Trade Show System <noreply@ngasoft.dk>" ')).toBe("Trade Show System <noreply@ngasoft.dk>");
    expect(emailSender("Trade Show System noreply@ngasoft.dk")).toBe("Trade Show System <noreply@ngasoft.dk>");
  });

  it("is empty when not set", () => {
    expect(emailSender("")).toBe("");
  });
});
