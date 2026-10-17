import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { columnName, toCsv, toXlsx } from "./spreadsheet";

describe("toCsv", () => {
  it("quotes cells that need it and reads back with the import parser", () => {
    const csv = toCsv({ headers: ["Name", "Profile"], rows: [["Æble, Øl & Co", 'Says "hi"\nnew line'], ["Acme", null]] });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(parseCsv(csv)).toEqual([
      ["Name", "Profile"],
      ["Æble, Øl & Co", 'Says "hi"\nnew line'],
      ["Acme", ""],
    ]);
  });

  it("stops formulas but keeps phone numbers", () => {
    const csv = toCsv({ headers: ["A"], rows: [["=HYPERLINK(1)"], ["+45 12 34 56 78"], ["-cmd"], ["@SUM(1)"]] });
    expect(parseCsv(csv).slice(1).map((r) => r[0])).toEqual(["'=HYPERLINK(1)", "+45 12 34 56 78", "'-cmd", "'@SUM(1)"]);
  });
});

describe("columnName", () => {
  it("counts like Excel", () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });
});

describe("toXlsx", () => {
  /** The files inside the zip, read from its central directory. */
  function unzip(buf: Buffer): Record<string, string> {
    const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = buf.readUInt16LE(end + 10);
    let pos = buf.readUInt32LE(end + 16);
    const files: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const size = buf.readUInt32LE(pos + 20);
      const nameLen = buf.readUInt16LE(pos + 28);
      const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString();
      const local = buf.readUInt32LE(pos + 42);
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      files[name] = inflateRawSync(buf.subarray(start, start + size)).toString();
      pos += 46 + nameLen;
    }
    return files;
  }

  it("writes a workbook with escaped text in each cell", () => {
    const files = unzip(toXlsx({ headers: ["Name", "Email"], rows: [["A <b> & \"Co\"\u0001", null]] }, "Exhibitors"));
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Name</t></is></c>');
    expect(sheet).toContain("A &lt;b&gt; &amp; &quot;Co&quot;</t>");
    expect(sheet).not.toContain('r="B2"');
    expect(sheet).toContain('<autoFilter ref="A1:B2"/>');
    expect(files["xl/workbook.xml"]).toContain('<sheet name="Exhibitors"');
  });

  it("makes any list name a sheet name Excel accepts", () => {
    const name = (n: string) => unzip(toXlsx({ headers: ["A"], rows: [] }, n))["xl/workbook.xml"].match(/<sheet name="([^"]*)"/)![1];
    expect(name("Leads: Q1/Q2 [hot]?")).toBe("Leads  Q1 Q2  hot");
    expect(name("'quoted'")).toBe("quoted");
    expect(name("***")).toBe("Sheet1");
    expect(name("x".repeat(40))).toHaveLength(31);
  });
});
