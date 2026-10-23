import "server-only";
import type { Prisma } from "@prisma/client";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";

// The store side of the files on favorite exhibitors (see src/lib/lead-files.ts).
// Vercel adds BLOB_READ_WRITE_TOKEN when a Blob store is connected to the project.

export function isFileStoreConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Deletes the stored files of the lead files matching `where` from the store.
 * Call it before deleting favorites, exhibitors or trade shows: the database
 * rows go with them, but the files in the store would be left behind.
 */
export async function deleteLeadFileBlobs(where: Prisma.LeadFileWhereInput): Promise<void> {
  if (!isFileStoreConfigured()) return;
  const files = await db.leadFile.findMany({ where, select: { pathname: true } });
  if (files.length === 0) return;
  try {
    for (let i = 0; i < files.length; i += 500) await del(files.slice(i, i + 500).map((f) => f.pathname));
  } catch (e) {
    // The favorite is still removed; a file left in the store is only space.
    console.error("Deleting lead files from the store failed", e);
  }
}
