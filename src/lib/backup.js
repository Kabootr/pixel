// Library backup / restore as a single .zip with manifest.json.
// Mirrors the format used by our PDF tools project — same shape, different content type.

import { unzip, zip } from "fflate";
import { getImage, listImages, restoreImage } from "./storage.js";

const MANIFEST = "manifest.json";
const BACKUP_VERSION = 1;

const enc = new TextEncoder();
const dec = new TextDecoder();

function safeEntryName(name, format, used) {
  const baseRaw = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || `image.${format}`;
  const lower = baseRaw.toLowerCase();
  let candidate = lower.endsWith(`.${format}`) ? baseRaw : `${baseRaw}.${format}`;
  let i = 1;
  while (used.has(candidate)) {
    candidate = candidate.replace(/(\.[a-zA-Z0-9]+)$/, `_${i++}$1`);
  }
  used.add(candidate);
  return candidate;
}

function zipAsync(data) {
  return new Promise((resolve, reject) =>
    zip(data, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out))),
  );
}

function unzipAsync(data) {
  return new Promise((resolve, reject) =>
    unzip(data, (err, out) => (err ? reject(err) : resolve(out))),
  );
}

async function fileToUint8Array(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const MIME_FOR_FORMAT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  tif: "image/tiff",
  ico: "image/x-icon",
};

/**
 * Export the entire library as a downloadable .zip (images + manifest).
 * @returns {Promise<number>} count of images exported
 */
export async function exportLibrary() {
  const metas = await listImages();
  if (metas.length === 0) return 0;

  const used = new Set();
  const entries = {};
  const manifest = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    files: [],
  };

  for (const meta of metas) {
    const full = await getImage(meta.id);
    if (!full) continue;
    const entryName = safeEntryName(meta.name, meta.format, used);
    entries[`files/${entryName}`] = await fileToUint8Array(full.blob);
    manifest.files.push({
      file: `files/${entryName}`,
      name: meta.name,
      width: meta.width,
      height: meta.height,
      format: meta.format,
      thumbnail: meta.thumbnail,
      addedAt: meta.addedAt,
      updatedAt: meta.updatedAt,
      size: meta.size,
    });
  }

  entries[MANIFEST] = enc.encode(JSON.stringify(manifest, null, 2));
  const zipped = await zipAsync(entries);

  const date = new Date(manifest.exportedAt).toISOString().slice(0, 10);
  downloadBlob(
    new Blob([zipped], { type: "application/zip" }),
    `pixelmorph-backup-${date}.zip`,
  );
  return manifest.files.length;
}

/**
 * @typedef {{ imported: number, skipped: number }} ImportResult
 */

/**
 * Import a backup .zip. Files already present (same name + size) are skipped, so
 * re-importing is safe.
 * @param {Blob} zipFile
 * @returns {Promise<ImportResult>}
 */
export async function importLibrary(zipFile) {
  const bytes = await fileToUint8Array(zipFile);
  const contents = await unzipAsync(bytes);

  const manifestRaw = contents[MANIFEST];
  if (!manifestRaw) {
    throw new Error("Not a PixelMorph backup — manifest.json is missing.");
  }
  const manifest = JSON.parse(dec.decode(manifestRaw));

  const existing = await listImages();
  const seen = new Set(existing.map((f) => `${f.name}::${f.size}`));

  let imported = 0;
  let skipped = 0;

  for (const entry of manifest.files) {
    const data = contents[entry.file];
    if (!data) {
      skipped++;
      continue;
    }
    if (seen.has(`${entry.name}::${entry.size ?? data.byteLength}`)) {
      skipped++;
      continue;
    }
    const mime = MIME_FOR_FORMAT[entry.format] || "application/octet-stream";
    const blob = new Blob([data], { type: mime });
    await restoreImage({
      name: entry.name,
      blob,
      width: entry.width ?? 0,
      height: entry.height ?? 0,
      format: entry.format ?? "png",
      thumbnail: entry.thumbnail,
      addedAt: entry.addedAt,
      updatedAt: entry.updatedAt,
    });
    seen.add(`${entry.name}::${blob.size}`);
    imported++;
  }

  return { imported, skipped };
}
