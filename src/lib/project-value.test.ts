import { describe, expect, it } from "vitest";
import { formatMoney, parseCurrency, parseProjectValue, projectValueText } from "./project-value";

describe("parseProjectValue", () => {
  it("reads whole amounts with or without thousands separators", () => {
    expect(parseProjectValue("12500")).toEqual({ value: 12500 });
    expect(parseProjectValue("12,500")).toEqual({ value: 12500 });
    expect(parseProjectValue("12.500")).toEqual({ value: 12500 });
    expect(parseProjectValue(" 1 250 000 ")).toEqual({ value: 1250000 });
    expect(parseProjectValue("€1.250.000")).toEqual({ value: 1250000 });
    expect(parseProjectValue("25000 EUR")).toEqual({ value: 25000 });
  });

  it("rounds off cents", () => {
    expect(parseProjectValue("1500,50")).toEqual({ value: 1501 });
    expect(parseProjectValue("1,500.4")).toEqual({ value: 1500 });
    expect(parseProjectValue("99.99")).toEqual({ value: 100 });
  });

  it("clears the value when empty", () => {
    expect(parseProjectValue("")).toEqual({ value: null });
    expect(parseProjectValue("  ")).toEqual({ value: null });
    expect(parseProjectValue(undefined)).toEqual({ value: null });
  });

  it("refuses text, negative and too large amounts", () => {
    expect(parseProjectValue("a lot")).toHaveProperty("error");
    expect(parseProjectValue("-500")).toHaveProperty("error");
    expect(parseProjectValue("12,50,0")).toHaveProperty("error");
    expect(parseProjectValue("3000000000")).toHaveProperty("error");
  });
});

describe("money", () => {
  it("formats in the account's currency without cents", () => {
    expect(formatMoney(12500, "EUR")).toBe("€12,500");
    expect(formatMoney(0, "USD")).toBe("$0");
    expect(formatMoney(1200000, "GBP")).toBe("£1,200,000");
  });

  it("shows the field value and reads currencies", () => {
    expect(projectValueText(12500)).toBe("12,500");
    expect(projectValueText(null)).toBe("");
    expect(parseCurrency("USD")).toBe("USD");
    expect(parseCurrency("DKK")).toBeUndefined();
  });
});
