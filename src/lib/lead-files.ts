// Files kept with a favorite exhibitor on the Favorites page, e.g. quotes and
// presentations. They belong to the account: only its members can see and
// download them. The files are in the private Vercel Blob store (see
// src/lib/lead-files-run.ts); these are the rules that need no store.

export const MAX_LEAD_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_LEAD = 20;
export const MAX_LEAD_FILE_NAME = 200;

/** The kinds of files that can be kept, by extension. */
export const LEAD_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
};

export const LEAD_FILE_CONTENT_TYPES = [...new Set(Object.values(LEAD_FILE_TYPES))];

/** For the file picker: ".pdf,.doc,..." */
export const LEAD_FILE_ACCEPT = Object.keys(LEAD_FILE_TYPES).map((e) => `.${e}`).join(",");

/** The content type a file is stored with, from its name; undefined when that kind of file can't be kept. */
export function leadFileContentType(name: string): string | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext ? LEAD_FILE_TYPES[ext] : undefined;
}

/** Why this file can't be uploaded, or undefined when it can. */
export function leadFileProblem(name: string, size: number): string | undefined {
  if (!leadFileContentType(name)) return `${name} can't be uploaded. Use PDF, Word, Excel, PowerPoint, text, image or zip files.`;
  if (size > MAX_LEAD_FILE_BYTES) return `${name} is too large. Files can be up to ${MAX_LEAD_FILE_BYTES / 1024 / 1024} MB.`;
  if (size === 0) return `${name} is empty.`;
  return undefined;
}

/** The file name as shown and downloaded: no folders, no control characters, not too long. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (clean.length <= MAX_LEAD_FILE_NAME) return clean || "file";
  const ext = /\.[a-z0-9]{1,8}$/i.exec(clean)?.[0] ?? "";
  return clean.slice(0, MAX_LEAD_FILE_NAME - ext.length) + ext;
}

/** Where an account's files for a favorite go in the store. Every upload must land under this. */
export function leadFileFolder(organizationId: string, exhibitorId: string): string {
  return `lead-files/${organizationId}/${exhibitorId}/`;
}

/** The pathname a file is uploaded to, in plain letters; the store adds a random suffix so names never clash. */
export function leadFilePathname(organizationId: string, exhibitorId: string, name: string): string {
  const safe =
    cleanFileName(name)
      .replace(/[æÆ]/g, "ae")
      .replace(/[øØ]/g, "oe")
      .replace(/[åÅ]/g, "aa")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/-(?=\.)|^-|-$/g, "")
      .slice(-100) || "file";
  return leadFileFolder(organizationId, exhibitorId) + safe;
}

/** "640 KB", "12.4 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The Content-Disposition header that downloads the file under its own name, also with æøå. */
export function attachmentHeader(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
