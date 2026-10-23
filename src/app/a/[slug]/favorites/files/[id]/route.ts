import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { attachmentHeader } from "@/lib/lead-files";
import { requireMembership } from "@/lib/tenant";

// Streams the file from the store, which can take a while for a large one.
export const maxDuration = 60;

/**
 * Downloads a file kept with a favorite exhibitor. The store is private, so
 * the file only comes through here, and only to members of the account it
 * belongs to.
 */
export async function GET(_request: Request, { params }: RouteContext<"/a/[slug]/favorites/files/[id]">) {
  const { slug, id } = await params;
  const { organization } = await requireMembership(slug);
  const file = await db.leadFile.findFirst({ where: { id, organizationId: organization.id } });
  if (!file) return new Response("Not found", { status: 404 });

  const blob = await get(file.pathname, { access: "private" });
  if (blob?.statusCode !== 200) return new Response("The file is missing from the store.", { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": attachmentHeader(file.name),
      "Content-Length": String(blob.blob.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
