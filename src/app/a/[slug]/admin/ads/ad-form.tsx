"use client";

import { useActionState, useState, useTransition } from "react";
import { AD_IMAGE_TYPES, trimBounds } from "@/lib/dashboard-ads";
import { removeAd, saveAd } from "./actions";

// Before the upload the image is prepared in the browser: a plain white or
// transparent frame around the ad is cut away, so the ad fills the whole space,
// and big photos are made smaller. An ad space is about 350 x 120 pixels on
// screen, so 1500 pixels wide is plenty, also on sharp screens.
const MAX_WIDTH = 1500;
const SHRINK_ABOVE_BYTES = 1024 * 1024;

async function prepare(file: File): Promise<File> {
  if (file.type === "image/gif") return file; // keeps animated GIFs moving
  const bitmap = await createImageBitmap(file);
  const full = document.createElement("canvas");
  full.width = bitmap.width;
  full.height = bitmap.height;
  const ctx = full.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const crop = trimBounds(ctx.getImageData(0, 0, full.width, full.height).data, full.width, full.height) ?? {
    x: 0,
    y: 0,
    width: full.width,
    height: full.height,
  };
  const trimmed = crop.width !== full.width || crop.height !== full.height;
  if (!trimmed && bitmap.width <= MAX_WIDTH && file.size <= SHRINK_ABOVE_BYTES) return file;
  const scale = Math.min(1, MAX_WIDTH / crop.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  canvas.getContext("2d")!.drawImage(full, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }) : file;
}

/** Upload, link and preview for one ad space. */
export function AdForm({
  slug,
  slot,
  position,
  pageName,
  ad,
  boxClass,
}: {
  slug: string;
  slot: number;
  /** The space's place on its page, 1 = leftmost. */
  position: number;
  /** Where the ad is shown, e.g. "dashboard". */
  pageName: string;
  ad: { imageUrl: string; linkUrl: string; name: string | null } | null;
  boxClass: string;
}) {
  const [state, formAction, pending] = useActionState(saveAd.bind(null, slug), undefined);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string>();

  async function choose(file: File | undefined) {
    setImage(null);
    setPreview(null);
    if (!file) return;
    setPreparing(true);
    try {
      const ready = await prepare(file);
      setImage(ready);
      setPreview(URL.createObjectURL(ready));
    } catch {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    } finally {
      setPreparing(false);
    }
  }

  const shown = preview ?? ad?.imageUrl;
  const error = (state && "error" in state ? state.error : undefined) ?? removeError;
  const saved = state && "saved" in state;

  return (
    <section id={`ad-${slot}`} className="card flex scroll-mt-6 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">Ad space {position}</h3>
        <span className={`pill ${ad ? "pill-ok" : "pill-neutral"}`}>{ad ? "Showing ad" : "Free: shows “Your ad here!”"}</span>
      </div>

      {/* The preview has the size of the space on a wide screen. */}
      <div className={`mx-auto grid w-full max-w-[21rem] place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface ${boxClass}`}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <p className="text-2xl font-extrabold tracking-tight text-faint">Your ad here!</p>
        )}
      </div>

      <form
        action={(formData) => {
          formData.delete("image");
          if (image) formData.set("image", image, image.name);
          formAction(formData);
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="slot" value={slot} />
        <fieldset disabled={pending || removing} className="contents">
          <div>
            <label htmlFor={`ad-image-${slot}`} className="label">{ad ? "New image (optional)" : "Image"}</label>
            <input
              id={`ad-image-${slot}`}
              type="file"
              accept={AD_IMAGE_TYPES.join(",")}
              onChange={(e) => choose(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold hover:file:bg-subtle"
            />
            <p className="hint">PNG, JPG, WebP or GIF, max 2 MB. Best size: 1050 x 360 pixels (about 3 : 1). The space has this shape on every screen. A white or transparent frame around the ad is cut away; other sizes fill the space and have their edges cut.</p>
          </div>
          <div>
            <label htmlFor={`ad-link-${slot}`} className="label">Link to the advertiser&apos;s website</label>
            <input id={`ad-link-${slot}`} name="linkUrl" className="input" required defaultValue={ad?.linkUrl ?? ""} placeholder="https://www.advertiser.com" />
          </div>
          <div>
            <label htmlFor={`ad-name-${slot}`} className="label">Advertiser name (optional)</label>
            <input id={`ad-name-${slot}`} name="name" className="input" maxLength={200} defaultValue={ad?.name ?? ""} placeholder="Shown when the mouse is over the ad" />
          </div>
          {error && <p className="error">{error}</p>}
          {saved && <p className="success">Saved. The ad is now on the {pageName}.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {ad ? (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  if (!window.confirm(`Remove the ad in space ${position} on the ${pageName}? It will show “Your ad here!” again.`)) return;
                  startRemove(async () => setRemoveError((await removeAd(slug, slot))?.error));
                }}
              >
                {removing ? "Removing…" : "Remove ad"}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn" disabled={preparing || (!ad && !image)}>
              {pending ? "Saving…" : preparing ? "Preparing image…" : "Save ad"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
