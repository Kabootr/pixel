// Local-first image library. Everything lives in the browser's IndexedDB —
// nothing is ever uploaded. Images are stored as Blobs alongside a small
// thumbnail data URL for the library grid.
//
// Adapted from the same pattern used in our PDF tools project (idb + manifest-zip backup).

import { openDB } from "idb";

const DB_NAME = "pixelmorph";
const DB_VERSION = 1;
const STORE = "images";

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by-updatedAt", "updatedAt");
      },
    });
  }
  return dbPromise;
}

/**
 * @typedef {Object} StoredImage
 * @property {string} id
 * @property {string} name           Original or renamed filename
 * @property {Blob} blob             The current image data
 * @property {number} size
 * @property {number} width
 * @property {number} height
 * @property {string} format         "png" | "jpg" | "webp" | "gif" | "svg" | "tiff"
 * @property {string} [thumbnail]    Data URL preview, ~256px on the long side
 * @property {number} addedAt
 * @property {number} updatedAt
 */

/** @typedef {Omit<StoredImage, "blob">} ImageMeta */

/** Collision-resistant short id. */
export function uid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/** @returns {Promise<ImageMeta[]>} */
export async function listImages() {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE, "by-updatedAt");
  return all
    .map(({ blob: _blob, ...meta }) => meta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** @returns {Promise<StoredImage|undefined>} */
export async function getImage(id) {
  const db = await getDB();
  return db.get(STORE, id);
}

/**
 * @param {{ name: string, blob: Blob, width: number, height: number, format: string, thumbnail?: string }} input
 * @returns {Promise<StoredImage>}
 */
export async function addImage(input) {
  const db = await getDB();
  const now = Date.now();
  const record = {
    id: uid(),
    name: input.name,
    blob: input.blob,
    size: input.blob.size,
    width: input.width,
    height: input.height,
    format: input.format,
    thumbnail: input.thumbnail,
    addedAt: now,
    updatedAt: now,
  };
  await db.put(STORE, record);
  return record;
}

/**
 * Patch an existing image record. Recomputes size when blob changes.
 * @returns {Promise<StoredImage|undefined>}
 */
export async function updateImage(id, patch) {
  const db = await getDB();
  const existing = await db.get(STORE, id);
  if (!existing) return undefined;
  const updated = {
    ...existing,
    ...patch,
    size: patch.blob ? patch.blob.size : existing.size,
    updatedAt: Date.now(),
  };
  await db.put(STORE, updated);
  return updated;
}

/**
 * Insert a restored image from a backup, preserving its original timestamps when given.
 * @returns {Promise<StoredImage>}
 */
export async function restoreImage(input) {
  const db = await getDB();
  const now = Date.now();
  const record = {
    id: uid(),
    name: input.name,
    blob: input.blob,
    size: input.blob.size,
    width: input.width,
    height: input.height,
    format: input.format,
    thumbnail: input.thumbnail,
    addedAt: input.addedAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  await db.put(STORE, record);
  return record;
}

export async function deleteImage(id) {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function clearAll() {
  const db = await getDB();
  await db.clear(STORE);
}

/** Total bytes used by the library. */
export async function storageUsage() {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.reduce((sum, f) => sum + f.size, 0);
}

/**
 * Generate a small thumbnail data URL from a canvas. Defaults to 256 long side.
 * Always emits JPEG for compact thumbnails (the original blob keeps full fidelity).
 */
export function makeThumbnail(canvas, maxSide = 256, quality = 0.78) {
  const long = Math.max(canvas.width, canvas.height);
  if (long <= maxSide) {
    return canvas.toDataURL("image/jpeg", quality);
  }
  const scale = maxSide / long;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(canvas.width * scale));
  c.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Flat white background so PNG transparency renders nicely in the library grid.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}
