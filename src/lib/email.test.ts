import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { emailSender, sendEmail } = await import("./email");

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

describe("sendEmail", () => {
  it("sends attachments to Resend only when there are some", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const mail = { to: "a@b.com", subject: "S", html: "<p>H</p>", text: "H" };
    await sendEmail({ ...mail, attachments: [{ filename: "ad.png", content: "aGk=" }] });
    await sendEmail(mail);
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)));
    expect(bodies[0].attachments).toEqual([{ filename: "ad.png", content: "aGk=" }]);
    expect(bodies[1]).not.toHaveProperty("attachments");
    vi.unstubAllGlobals();
  });
});
