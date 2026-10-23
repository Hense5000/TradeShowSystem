// Links on a favorite exhibitor to files and folders in the customer's own
// storage, e.g. a quote in Google Drive or a presentation in Dropbox. Only the
// link and its name are kept; the customer's storage decides who can open it.

export const MAX_LINKS_PER_LEAD = 30;
export const MAX_LINK_TITLE = 120;
export const MAX_LINK_URL = 2000;

// Known storage services by host, so a link shows where the file is.
const STORAGE: [RegExp, string][] = [
  [/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/, "Google Drive"],
  [/(^|\.)dropbox\.com$|(^|\.)dropboxusercontent\.com$/, "Dropbox"],
  [/(^|\.)box\.com$|(^|\.)app\.box\.com$/, "Box"],
  [/(^|\.)1drv\.ms$|(^|\.)onedrive\.live\.com$|-my\.sharepoint\.com$/, "OneDrive"],
  [/(^|\.)sharepoint\.com$/, "SharePoint"],
  [/(^|\.)icloud\.com$/, "iCloud"],
  [/(^|\.)wetransfer\.com$|(^|\.)we\.tl$/, "WeTransfer"],
];

/** Where the link points, e.g. "Google Drive", or the site's own name, e.g. "files.acme.com". */
export function storageName(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
  return STORAGE.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "");
}

/**
 * The link and name to save, or an error message. A link without http(s)://
 * gets https://; an empty name becomes the link's own last part.
 */
export function checkLeadLink(urlValue: unknown, titleValue: unknown): { url: string; title: string; error?: undefined } | { error: string } {
  let text = typeof urlValue === "string" ? urlValue.trim() : "";
  if (!text) return { error: "Paste the link to the file or folder." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: "That is not a valid link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "The link must start with https://" };
  if (!url.hostname.includes(".")) return { error: "That is not a valid link." };
  if (url.href.length > MAX_LINK_URL) return { error: "The link is too long." };

  let title = typeof titleValue === "string" ? titleValue.trim() : "";
  if (title.length > MAX_LINK_TITLE) return { error: `Keep the name under ${MAX_LINK_TITLE} characters.` };
  if (!title) title = defaultTitle(url);
  return { url: url.href, title };
}

/** A name for a link without one: its last path part, else where it points. */
function defaultTitle(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
  let part = "";
  try {
    part = decodeURIComponent(last);
  } catch {
    part = last;
  }
  // Storage links end in ids such as "view" or "1AbC...", which say nothing.
  const useful = /\.[a-z0-9]{2,5}$/i.test(part) && part.length <= MAX_LINK_TITLE;
  return useful ? part : storageName(url.href) || "Link";
}
