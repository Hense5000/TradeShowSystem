import { describe, expect, it } from "vitest";
import { attachmentHeader, cleanFileName, formatFileSize, leadFileContentType, leadFileFolder, leadFilePathname, leadFileProblem, MAX_LEAD_FILE_BYTES } from "./lead-files";

describe("leadFileContentType", () => {
  it("knows office documents, PDFs and images by extension", () => {
    expect(leadFileContentType("Tilbud.PDF")).toBe("application/pdf");
    expect(leadFileContentType("deck.pptx")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(leadFileContentType("photo.jpeg")).toBe("image/jpeg");
  });

  it("refuses other kinds of files", () => {
    expect(leadFileContentType("setup.exe")).toBeUndefined();
    expect(leadFileContentType("page.html")).toBeUndefined();
    expect(leadFileContentType("noextension")).toBeUndefined();
  });
});

describe("leadFileProblem", () => {
  it("accepts allowed files up to the limit", () => {
    expect(leadFileProblem("quote.pdf", MAX_LEAD_FILE_BYTES)).toBeUndefined();
  });

  it("explains what is wrong", () => {
    expect(leadFileProblem("quote.pdf", MAX_LEAD_FILE_BYTES + 1)).toMatch(/too large/);
    expect(leadFileProblem("virus.exe", 10)).toMatch(/can't be uploaded/);
    expect(leadFileProblem("empty.txt", 0)).toMatch(/empty/);
  });
});

describe("file names", () => {
  it("drops folders and control characters", () => {
    expect(cleanFileName("C:\\Users\\me\\Tilbud 2026.pdf")).toBe("Tilbud 2026.pdf");
    expect(cleanFileName("a\u0000b.pdf")).toBe("ab.pdf");
  });

  it("shortens long names but keeps the extension", () => {
    const name = cleanFileName(`${"x".repeat(300)}.docx`);
    expect(name).toHaveLength(200);
    expect(name.endsWith(".docx")).toBe(true);
  });

  it("uploads into the account's folder for the favorite with a safe name", () => {
    expect(leadFilePathname("org1", "exh1", "Præsentation æøå (v2).pptx")).toBe("lead-files/org1/exh1/Praesentation-aeoeaa-v2.pptx");
    expect(leadFilePathname("org1", "exh1", "Café.pdf")).toBe("lead-files/org1/exh1/Cafe.pdf");
    expect(leadFilePathname("org1", "exh1", "../../x.pdf").startsWith(leadFileFolder("org1", "exh1"))).toBe(true);
  });

  it("downloads under the real name", () => {
    expect(attachmentHeader("Tilbud æøå.pdf")).toBe(`attachment; filename="Tilbud ___.pdf"; filename*=UTF-8''Tilbud%20%C3%A6%C3%B8%C3%A5.pdf`);
  });
});

describe("formatFileSize", () => {
  it("shows bytes, KB and MB", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(640 * 1024)).toBe("640 KB");
    expect(formatFileSize(12.4 * 1024 * 1024)).toBe("12.4 MB");
  });
});
