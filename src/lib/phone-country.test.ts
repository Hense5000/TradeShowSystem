import { describe, expect, it } from "vitest";
import { countryFromPhone, withPhoneCountry } from "@/lib/phone-country";

describe("countryFromPhone", () => {
  it("reads the country from the international prefix", () => {
    expect(countryFromPhone("+45 12 34 56 78")).toBe("DK");
    expect(countryFromPhone("0045 33 12 34 56")).toBe("DK");
    expect(countryFromPhone("+49 (0) 89 1234567")).toBe("DE");
    expect(countryFromPhone("+44 20 7946 0958")).toBe("GB");
    expect(countryFromPhone("+1 416 555 0100")).toBe("CA");
    expect(countryFromPhone("+1 212 555 0100")).toBe("US");
  });

  it("uses the prefix alone when only one country has it", () => {
    expect(countryFromPhone("+45 1234")).toBe("DK");
  });

  it("does not guess", () => {
    expect(countryFromPhone("12 34 56 78")).toBeNull();
    expect(countryFromPhone("+1 555")).toBeNull();
    expect(countryFromPhone("+999 123")).toBeNull();
    expect(countryFromPhone("")).toBeNull();
    expect(countryFromPhone(null)).toBeNull();
  });
});

describe("withPhoneCountry", () => {
  it("fills an empty country only", () => {
    expect(withPhoneCountry({ phone: "+46 8 123 456 78", country: null }).country).toBe("SE");
    expect(withPhoneCountry({ phone: "+46 8 123 456 78", country: "DK" }).country).toBe("DK");
    expect(withPhoneCountry({ phone: null, country: null }).country).toBeNull();
  });
});
