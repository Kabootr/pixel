// Pure client-side image operations shared by the resize / compress / crop / adjust tools.
// All work happens inside the user's browser — no uploads, no servers.
//
// Decoding handles PNG / JPG / WebP / GIF / BMP via <img>, SVG via inline rasterisation,
// and TIFF via lazy-imported UTIF (matches the format coverage of converter.js).

const RASTER_OUTPUTS = new Set(["png", "jpg", "jpeg", "webp"]);

/* ───────────────────────── Decoding ───────────────────────── */

export async function decodeToCanvas(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = file.type || "";

  if (ext === "tiff" || ext === "tif" || type === "image/tiff") {
    return await decodeTiff(file);
  }
  if (ext === "svg" || type === "image/svg+xml") {
    return await decodeSvg(file);
  }
  if (ext === "ico" || type === "image/x-icon" || type === "image/vnd.microsoft.icon") {
    return await decodeIco(file);
  }
  return await decodeViaImage(file);
}

function decodeViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image."));
    };
    img.src = url;
  });
}

async function decodeSvg(file) {
  const text = await file.text();
  const blob = new Blob([text], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || 1024;
    const h = img.naturalHeight || 1024;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeTiff(file) {
  const UTIF = (await import("utif")).default || (await import("utif"));
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) throw new Error("Empty TIFF file.");
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const canvas = document.createElement("canvas");
  canvas.width = ifds[0].width;
  canvas.height = ifds[0].height;
  const ctx = canvas.getContext("2d");
  const imageData = new ImageData(
    new Uint8ClampedArray(rgba),
    ifds[0].width,
    ifds[0].height,
  );
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function decodeIco(file) {
  try {
    return await decodeViaImage(file);
  } catch {
    throw new Error("ICO decoding requires the full converter — use /png-to-ico for ICO output.");
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load."));
    img.src = src;
  });
}

/* ───────────────────────── Transforms ───────────────────────── */

/**
 * Resize a canvas. Returns the original if no change is needed.
 * @param {HTMLCanvasElement} canvas
 * @param {{ mode: "px"|"percent"|"fit", width?: number, height?: number, percent?: number, maxSide?: number, lockAspect?: boolean }} resize
 */
export function resizeCanvas(canvas, resize) {
  if (!resize) return canvas;
  let targetW = canvas.width;
  let targetH = canvas.height;
  const ratio = canvas.width / canvas.height;

  if (resize.mode === "px") {
    const w = resize.width;
    const h = resize.height;
    if (w && h) {
      targetW = w;
      targetH = h;
    } else if (w) {
      targetW = w;
      targetH = Math.round(w / ratio);
    } else if (h) {
      targetH = h;
      targetW = Math.round(h * ratio);
    }
  } else if (resize.mode === "percent" && resize.percent && resize.percent !== 100) {
    targetW = Math.round((canvas.width * resize.percent) / 100);
    targetH = Math.round((canvas.height * resize.percent) / 100);
  } else if (resize.mode === "fit" && resize.maxSide) {
    const longSide = Math.max(canvas.width, canvas.height);
    if (longSide <= resize.maxSide) return canvas;
    const scale = resize.maxSide / longSide;
    targetW = Math.round(canvas.width * scale);
    targetH = Math.round(canvas.height * scale);
  } else {
    return canvas;
  }

  if (targetW === canvas.width && targetH === canvas.height) return canvas;

  const out = document.createElement("canvas");
  out.width = Math.max(1, targetW);
  out.height = Math.max(1, targetH);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/**
 * Crop a canvas to a rectangle. Coordinates are in source pixels.
 * Out-of-bounds rectangles are clamped.
 * @param {HTMLCanvasElement} canvas
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export function cropCanvas(canvas, rect) {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const w = Math.max(1, Math.min(canvas.width - x, Math.round(rect.w)));
  const h = Math.max(1, Math.min(canvas.height - y, Math.round(rect.h)));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return out;
}

/**
 * Apply color/tonal adjustments via ctx.filter. Returns a new canvas.
 * All values are sliders centred on 0 except brightness/contrast/saturation (default 100).
 * @param {HTMLCanvasElement} canvas
 * @param {{ brightness?: number, contrast?: number, saturation?: number, hue?: number, sepia?: number, grayscale?: number, blur?: number, invert?: number }} adj
 */
export function applyAdjust(canvas, adj) {
  const filter = buildCssFilter(adj);
  if (!filter) return canvas;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.filter = filter;
  ctx.drawImage(canvas, 0, 0);
  // Reset for subsequent draws on the same ctx (defensive).
  ctx.filter = "none";
  return out;
}

/**
 * Build the equivalent CSS filter string from an adjustments object.
 * Returns null / "" when no adjustments are active so callers can short-circuit.
 */
export function buildCssFilter(adj = {}) {
  if (!adj) return "";
  const parts = [];
  if (adj.brightness != null && adj.brightness !== 100) {
    parts.push(`brightness(${Math.max(0, adj.brightness) / 100})`);
  }
  if (adj.contrast != null && adj.contrast !== 100) {
    parts.push(`contrast(${Math.max(0, adj.contrast) / 100})`);
  }
  if (adj.saturation != null && adj.saturation !== 100) {
    parts.push(`saturate(${Math.max(0, adj.saturation) / 100})`);
  }
  if (adj.hue) parts.push(`hue-rotate(${adj.hue}deg)`);
  if (adj.sepia) parts.push(`sepia(${Math.max(0, Math.min(100, adj.sepia)) / 100})`);
  if (adj.grayscale) parts.push(`grayscale(${Math.max(0, Math.min(100, adj.grayscale)) / 100})`);
  if (adj.blur) parts.push(`blur(${Math.max(0, adj.blur)}px)`);
  if (adj.invert) parts.push(`invert(${Math.max(0, Math.min(100, adj.invert)) / 100})`);
  return parts.join(" ");
}

/**
 * Fill the canvas with a solid background underneath the existing pixels.
 * Use before encoding to JPG so transparency doesn't render as black.
 */
export function flattenBackground(canvas, color) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = color || "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/* ───────────────────────── Encoding ───────────────────────── */

export function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null."))),
      mime,
      quality,
    );
  });
}

/**
 * Encode a canvas to one of the four raster output formats.
 * @param {HTMLCanvasElement} canvas
 * @param {{ format: "png"|"jpg"|"jpeg"|"webp", quality?: number, background?: string }} opts
 */
export async function encodeRaster(canvas, opts) {
  const format = String(opts.format || "png").toLowerCase();
  if (!RASTER_OUTPUTS.has(format)) throw new Error(`Unsupported raster output: ${format}`);

  const opaque = format === "jpg" || format === "jpeg";
  const target = opaque ? flattenBackground(canvas, opts.background || "#ffffff") : canvas;

  const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
  const quality = opts.quality != null ? Math.max(0, Math.min(100, opts.quality)) / 100 : undefined;
  return await canvasToBlob(target, mime, quality);
}

/* ───────────────────────── Helpers ───────────────────────── */

export function humanFileSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "bmp", "tif", "tiff"].includes(ext);
}

export function inferFormatId(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext === "tif") return "tiff";
  return ext;
}

export function rasterExtFor(format) {
  const f = String(format).toLowerCase();
  if (f === "jpeg") return "jpg";
  return f;
}

/**
 * Replace the extension on a filename.
 */
export function replaceExt(name, newExt) {
  return `${name.replace(/\.[^.]+$/, "")}.${newExt}`;
}

/**
 * "Smart" default quality for compress UI when the user hasn't picked one.
 * Photos compress aggressively; flat graphics stay high.
 */
export function smartQualityFor(format) {
  const f = String(format).toLowerCase();
  if (f === "webp") return 82;
  if (f === "jpg" || f === "jpeg") return 78;
  return 92;
}
