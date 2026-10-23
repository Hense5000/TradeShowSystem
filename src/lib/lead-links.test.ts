import { describe, expect, it } from "vitest";
import { checkLeadLink, storageName } from "./lead-links";

describe("storageName", () => {
  it("knows the common storage services", () => {
    expect(storageName("https://drive.google.com/file/d/1AbC/view")).toBe("Google Drive");
    expect(storageName("https://docs.google.com/presentation/d/1x/edit")).toBe("Google Drive");
    expect(storageName("https://www.dropbox.com/scl/fi/abc/Tilbud.pdf?dl=0")).toBe("Dropbox");
    expect(storageName("https://app.box.com/s/abc")).toBe("Box");
    expect(storageName("https://1drv.ms/b/s!abc")).toBe("OneDrive");
    expect(storageName("https://ngasoft-my.sharepoint.com/:b:/g/x")).toBe("OneDrive");
    expect(storageName("https://ngasoft.sharepoint.com/sites/sales/x")).toBe("SharePoint");
  });

  it("shows other sites by their own name", () => {
    expect(storageName("https://www.files.acme.com/x")).toBe("files.acme.com");
    expect(storageName("not a link")).toBe("");
  });
});

describe("checkLeadLink", () => {
  it("keeps a link with its name", () => {
    expect(checkLeadLink(" https://drive.google.com/file/d/1AbC/view ", " Tilbud 2026 ")).toEqual({
      url: "https://drive.google.com/file/d/1AbC/view",
      title: "Tilbud 2026",
    });
  });

  it("adds https:// when it is missing", () => {
    expect(checkLeadLink("dropbox.com/s/abc/deck.pptx", "Deck")).toEqual({ url: "https://dropbox.com/s/abc/deck.pptx", title: "Deck" });
  });

  it("names a link without a name after its file, else its storage", () => {
    expect(checkLeadLink("https://www.dropbox.com/scl/fi/abc/Tilbud%20%C3%A6%C3%B8%C3%A5.pdf?dl=0", "")).toMatchObject({ title: "Tilbud æøå.pdf" });
    expect(checkLeadLink("https://drive.google.com/file/d/1AbC/view", "")).toMatchObject({ title: "Google Drive" });
  });

  it("refuses what is not a web link", () => {
    expect(checkLeadLink("", "x")).toEqual({ error: "Paste the link to the file or folder." });
    expect(checkLeadLink("javascript:alert(1)", "x")).toEqual({ error: "The link must start with https://" });
    expect(checkLeadLink("ftp://files.acme.com/x", "x")).toEqual({ error: "The link must start with https://" });
    expect(checkLeadLink("just words", "x")).toEqual({ error: "That is not a valid link." });
    expect(checkLeadLink("https://acme.com/x", "x".repeat(121))).toMatchObject({ error: expect.stringMatching(/under 120/) });
  });
});
