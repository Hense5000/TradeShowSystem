import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads comma separated rows", () => {
    expect(parseCsv("name,city\nMesse Berlin,Berlin\n")).toEqual([
      ["name", "city"],
      ["Messe Berlin", "Berlin"],
    ]);
  });

  it("reads semicolons, quotes and Windows line endings", () => {
    const text = '﻿name;city\r\n"Bella Center; Copenhagen";"København"\r\n"Say ""hi""";x\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "city"],
      ["Bella Center; Copenhagen", "København"],
      ['Say "hi"', "x"],
    ]);
  });

  it("keeps line breaks inside quoted cells", () => {
    expect(parseCsv('a,b\n"one\ntwo",3')).toEqual([
      ["a", "b"],
      ["one\ntwo", "3"],
    ]);
  });
});
