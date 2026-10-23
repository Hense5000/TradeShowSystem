"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import {
  formatFileSize,
  LEAD_FILE_ACCEPT,
  leadFileContentType,
  leadFilePathname,
  leadFileProblem,
  MAX_FILES_PER_LEAD,
  MAX_LEAD_FILE_BYTES,
} from "@/lib/lead-files";
import { addLeadFile, deleteLeadFile } from "./actions";

export type LeadFileRow = { id: string; name: string; size: number; uploadedBy: string | null; date: string };

/**
 * The files kept with a favorite exhibitor, e.g. quotes and presentations,
 * under its Lead and Notes. Files are picked or dropped on the area and go
 * straight from the browser to the private file store; everyone in the
 * account can download and delete them.
 */
export function LeadFiles({
  slug,
  organizationId,
  exhibitorId,
  name,
  files,
  configured,
}: {
  slug: string;
  organizationId: string;
  exhibitorId: string;
  name: string;
  files: LeadFileRow[];
  configured: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState<LeadFileRow | null>(null);
  const [deleting, startDelete] = useTransition();

  async function uploadAll(list: FileList | File[]) {
    setError("");
    const chosen = [...list];
    const room = MAX_FILES_PER_LEAD - files.length;
    if (chosen.length > room) {
      setError(room > 0 ? `You can add ${room} more ${room === 1 ? "file" : "files"} to ${name}.` : `A favorite can have up to ${MAX_FILES_PER_LEAD} files. Delete one first.`);
      return;
    }
    for (const file of chosen) {
      const problem = leadFileProblem(file.name, file.size);
      if (problem) {
        setError(problem);
        continue;
      }
      setProgress({ name: file.name, percent: 0 });
      try {
        const blob = await upload(leadFilePathname(organizationId, exhibitorId, file.name), file, {
          access: "private",
          handleUploadUrl: `/a/${slug}/favorites/files/upload`,
          clientPayload: exhibitorId,
          contentType: leadFileContentType(file.name),
          multipart: file.size > 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress({ name: file.name, percent: Math.round(percentage) }),
        });
        const saved = await addLeadFile(slug, exhibitorId, blob.pathname, file.name);
        if (saved?.error) setError(saved.error);
      } catch (e) {
        console.error("Lead file upload failed", e);
        setError(`${file.name} could not be uploaded. Try again.`);
      }
    }
    setProgress(null);
  }

  const busy = progress !== null;

  return (
    <div
      className={`rounded-lg border border-dashed px-3 py-2.5 ${dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-subtle/60"}`}
      onDragOver={(e) => {
        if (!configured || busy || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!configured || busy) return;
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void uploadAll(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          className="btn-secondary py-1"
          disabled={!configured || busy}
          onClick={() => picker.current?.click()}
          aria-label={`Upload a file for ${name}`}
        >
          <Icon name="upload" className="size-4" /> Upload file
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          accept={LEAD_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const chosen = e.currentTarget.files;
            if (chosen?.length) void uploadAll([...chosen]);
            e.currentTarget.value = "";
          }}
        />
        <p className="text-xs text-muted">
          {configured
            ? busy
              ? `Uploading ${progress.name} … ${progress.percent}%`
              : `Quotes, presentations and other documents, or drop files here. Up to ${MAX_LEAD_FILE_BYTES / 1024 / 1024} MB each. Only your account can see them.`
            : "File uploads are not switched on yet."}
        </p>
      </div>
      {busy && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brand transition-[width]" style={{ width: `${progress.percent}%` }} />
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-bad">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {files.map((f) => (
            <li key={f.id} className="flex min-w-0 items-center gap-2 rounded-md bg-surface px-2 py-1">
              <Icon name="file" className="size-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <a href={`/a/${slug}/favorites/files/${f.id}`} className="block truncate text-sm font-medium hover:text-brand hover:underline" title={`Download ${f.name}`}>
                  {f.name}
                </a>
                <p className="truncate text-xs text-muted tabular-nums">
                  {[formatFileSize(f.size), f.uploadedBy, f.date].filter(Boolean).join(" · ")}
                </p>
              </div>
              <a href={`/a/${slug}/favorites/files/${f.id}`} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-subtle hover:text-brand" title="Download" aria-label={`Download ${f.name}`}>
                <Icon name="download" className="size-4" />
              </a>
              <button
                type="button"
                className="grid size-7 shrink-0 place-items-center rounded-md text-lg leading-none text-muted hover:bg-bad-soft hover:text-bad"
                title="Delete"
                aria-label={`Delete ${f.name}`}
                onClick={() => setConfirm(f)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => !deleting && setConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label="Delete file?" className="card flex w-full max-w-lg flex-col gap-4 text-left" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Delete file?</h2>
            <p className="text-sm break-words text-muted">
              <strong className="text-ink">{confirm.name}</strong> is deleted for everyone in your account. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const result = await deleteLeadFile(slug, confirm.id);
                    setError(result?.error ?? "");
                    setConfirm(null);
                  })
                }
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
