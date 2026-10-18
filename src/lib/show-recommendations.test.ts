import { describe, expect, it } from "vitest";
import { rankRecommendations, recommendationReason } from "./show-recommendations";

describe("trade show recommendations", () => {
  it("explains why a show is recommended", () => {
    expect(recommendationReason({ tradeShowId: "a", leads: ["Ambu", "Coloplast", "Dräger"], industries: [{ industry: "Medical devices", count: 12 }] })).toBe(
      "3 of your leads exhibit here: Ambu, Coloplast and Dräger · 12 exhibitors in Medical devices",
    );
    expect(recommendationReason({ tradeShowId: "a", leads: ["Ambu"], industries: [] })).toBe("1 of your leads exhibits here: Ambu");
    expect(recommendationReason({ tradeShowId: "a", leads: ["A", "B", "C", "D", "E"], industries: [] })).toBe("5 of your leads exhibit here: A, B and 3 more");
  });

  it("ranks favorite companies above similar exhibitors and leaves out weak matches", () => {
    const ranked = rankRecommendations([
      { tradeShowId: "similar", leads: [], industries: [{ industry: "Food", count: 15 }] },
      { tradeShowId: "leads", leads: ["Ambu", "Dräger"], industries: [] },
      { tradeShowId: "one-similar", leads: [], industries: [{ industry: "Food", count: 1 }] },
      { tradeShowId: "one-lead", leads: ["Ambu"], industries: [{ industry: "Food", count: 3 }] },
    ]);
    expect(ranked.map((r) => r.tradeShowId)).toEqual(["leads", "similar", "one-lead"]);
  });

  it("returns at most the limit", () => {
    const signals = Array.from({ length: 8 }, (_, i) => ({ tradeShowId: `s${i}`, leads: ["X"], industries: [] }));
    expect(rankRecommendations(signals)).toHaveLength(5);
  });
});
