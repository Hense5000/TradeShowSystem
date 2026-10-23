import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { LEAD_FILE_CONTENT_TYPES, leadFileFolder, MAX_FILES_PER_LEAD, MAX_LEAD_FILE_BYTES } from "@/lib/lead-files";
import { isFileStoreConfigured } from "@/lib/lead-files-run";
import { requireMembership } from "@/lib/tenant";

/**
 * Gives the browser a short-lived permission to upload one file for a favorite
 * exhibitor straight to the private Blob store (files are too large to pass
 * through the app). The permission only covers the account's own folder for
 * that favorite, private access, the allowed kinds of files and the size
 * limit. The browser then saves the file on the favorite with addLeadFile.
 */
export async function POST(request: Request, { params }: RouteContext<"/a/[slug]/favorites/files/upload">) {
  const { slug } = await params;
  const { organization } = await requireMembership(slug);
  if (!isFileStoreConfigured()) return Response.json({ error: "File uploads are not set up yet." }, { status: 503 });

  const body = (await request.json()) as HandleUploadBody;
  // Only token requests; the app saves the file itself, so no upload-completed callback is used.
  if (body.type !== "blob.generate-client-token") return Response.json({ error: "Not supported" }, { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const exhibitorId = clientPayload ?? "";
        const item = await db.savedListItem.findFirst({
          where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
          select: { _count: { select: { files: true } } },
        });
        if (!item) throw new Error("This exhibitor is no longer in Favorites.");
        if (item._count.files >= MAX_FILES_PER_LEAD) throw new Error(`A favorite can have up to ${MAX_FILES_PER_LEAD} files. Delete one first.`);
        if (!pathname.startsWith(leadFileFolder(organization.id, exhibitorId)) || pathname.includes("..")) throw new Error("Wrong place to upload to.");
        return {
          allowedContentTypes: LEAD_FILE_CONTENT_TYPES,
          maximumSizeInBytes: MAX_LEAD_FILE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "The upload could not start." }, { status: 400 });
  }
}
