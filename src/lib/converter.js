// Pure client-side image conversion engine.
// - Raster ↔ raster via Canvas API.
// - TIFF read/write via lazy-imported UTIF.
// - SVG output wraps the raster as a base64 image.
// - SVG input rasterizes through an <img>.
// - ICO output emits a PNG-embedded ICO container.
//
// All work happens in the user's browser. Nothing is uploaded.

const CANVAS_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/png", // We render the first frame to PNG, then re-encode below.
};

const SUPPORTED = ["png", "jpg", "webp", "gif", "svg", "ico", "tiff"];

/**
 * Convert a single File to the target format. Returns a Blob.
 * @param {File} file
 * @param {{ to: string, quality?: number, resize?: { mode: "px"|"percent", width?: number, height?: number, percent?: number, lockAspect?: boolean }, background?: string }} opts
 */
export async function convertImage(file, opts) {
  const to = String(opts.to).toLowerCase();
  if (!SUPPORTED.includes(to)) {
    throw new Error(`Unsupported target format: ${to}`);
  }

  // 1) Decode the input to an ImageBitmap-equivalent on a canvas.
  const decoded = await decodeToCanvas(file);

  // 2) Apply resize.
  const sized = resizeCanvas(decoded, opts.resize);

  // 3) Apply background fill if the target is non-transparent.
  const opaque = ["jpg", "jpeg"].includes(to);
  const final = opaque ? flattenBackground(sized, opts.background || "#ffffff") : sized;

  // 4) Encode to target.
  return await encodeCanvas(final, to, opts);
}

/* ───────────────────────── Decoding ───────────────────────── */

async function decodeToCanvas(file) {
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
  // GIF, PNG, JPG, WebP, BMP — all decode through HTMLImageElement.
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
        const ctx = canvas.getContext("2d", { willReadFrequently: false });
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
  // Encode as a data URL so an <img> can decode it.
  const blob = new Blob([text], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    // SVG may not report intrinsic size — fall back to 1024px.
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
  const imageData = new ImageData(new Uint8ClampedArray(rgba), ifds[0].width, ifds[0].height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function decodeIco(file) {
  // ICO is a container — most browsers can decode through <img>.
  // Fall back to manual parsing if needed.
  try {
    return await decodeViaImage(file);
  } catch {
    // Manual parse: pull the largest entry, render as PNG via the bytes.
    const buf = new Uint8Array(await file.arrayBuffer());
    const count = buf[4] | (buf[5] << 8);
    let best = null;
    for (let i = 0; i < count; i++) {
      const off = 6 + i * 16;
      const w = buf[off] || 256;
      const h = buf[off + 1] || 256;
      const size = buf[off + 8] | (buf[off + 9] << 8) | (buf[off + 10] << 16) | (buf[off + 11] << 24);
      const dataOff = buf[off + 12] | (buf[off + 13] << 8) | (buf[off + 14] << 16) | (buf[off + 15] << 24);
      if (!best || w * h > best.w * best.h) best = { w, h, size, dataOff };
    }
    if (!best) throw new Error("Failed to decode ICO.");
    const slice = buf.slice(best.dataOff, best.dataOff + best.size);
    // PNG entries start with 0x89 'P' 'N' 'G'.
    if (slice[0] === 0x89 && slice[1] === 0x50) {
      const blob = new Blob([slice], { type: "image/png" });
      return await decodeViaImage(new File([blob], "icon.png"));
    }
    throw new Error("Unsupported ICO format (BMP entry).");
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

/* ───────────────────────── Transform ───────────────────────── */

function resizeCanvas(canvas, resize) {
  if (!resize) return canvas;
  let targetW = canvas.width;
  let targetH = canvas.height;

  if (resize.mode === "px") {
    if (resize.width && resize.height) {
      targetW = resize.width;
      targetH = resize.height;
    } else if (resize.width) {
      targetW = resize.width;
      targetH = Math.round((canvas.height / canvas.width) * targetW);
    } else if (resize.height) {
      targetH = resize.height;
      targetW = Math.round((canvas.width / canvas.height) * targetH);
    }
  } else if (resize.mode === "percent" && resize.percent && resize.percent !== 100) {
    targetW = Math.round((canvas.width * resize.percent) / 100);
    targetH = Math.round((canvas.height * resize.percent) / 100);
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

function flattenBackground(canvas, color) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/* ───────────────────────── Encoding ───────────────────────── */

async function encodeCanvas(canvas, to, opts) {
  switch (to) {
    case "png":
      return await canvasToBlob(canvas, "image/png");
    case "jpg":
    case "jpeg":
      return await canvasToBlob(canvas, "image/jpeg", (opts.quality ?? 92) / 100);
    case "webp":
      return await canvasToBlob(canvas, "image/webp", (opts.quality ?? 92) / 100);
    case "gif":
      // Canvas can't natively encode GIF — emit PNG inside a .gif wrapper is wrong.
      // Best we can do without a GIF encoder is single-frame PNG with .gif extension flagged.
      // Use a minimal single-frame GIF encoder fallback.
      return await encodeStaticGif(canvas);
    case "svg":
      return await encodeSvgWrapper(canvas);
    case "ico":
      return await encodeIco(canvas);
    case "tiff":
      return await encodeTiff(canvas);
    default:
      throw new Error(`Unsupported encode: ${to}`);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Canvas toBlob returned null."));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function encodeTiff(canvas) {
  const UTIF = (await import("utif")).default || (await import("utif"));
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const buf = UTIF.encodeImage(data.data, canvas.width, canvas.height);
  return new Blob([buf], { type: "image/tiff" });
}

async function encodeSvgWrapper(canvas) {
  const dataUrl = canvas.toDataURL("image/png");
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">\n` +
    `  <image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/>\n` +
    `</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

async function encodeIco(canvas) {
  // ICO with one PNG-embedded entry. Cap at 256x256 (ICO spec).
  let src = canvas;
  if (canvas.width > 256 || canvas.height > 256) {
    src = resizeCanvas(canvas, { mode: "px", width: 256, height: 256 });
  }
  const pngBlob = await canvasToBlob(src, "image/png");
  const pngBuf = new Uint8Array(await pngBlob.arrayBuffer());

  const header = new Uint8Array(6);
  header.set([0, 0, 1, 0, 1, 0]); // reserved, type=1 (ICO), count=1

  const entry = new Uint8Array(16);
  entry[0] = src.width >= 256 ? 0 : src.width;
  entry[1] = src.height >= 256 ? 0 : src.height;
  entry[2] = 0; // color palette
  entry[3] = 0; // reserved
  entry[4] = 1; entry[5] = 0; // color planes
  entry[6] = 32; entry[7] = 0; // bit depth
  // size
  const size = pngBuf.byteLength;
  entry[8] = size & 0xff;
  entry[9] = (size >> 8) & 0xff;
  entry[10] = (size >> 16) & 0xff;
  entry[11] = (size >> 24) & 0xff;
  // offset = 22
  entry[12] = 22; entry[13] = 0; entry[14] = 0; entry[15] = 0;

  const out = new Uint8Array(22 + pngBuf.byteLength);
  out.set(header, 0);
  out.set(entry, 6);
  out.set(pngBuf, 22);
  return new Blob([out], { type: "image/x-icon" });
}

// Tiny single-frame GIF encoder (87a) — produces a GIF from a canvas.
// Adapted from the public-domain LZW + GIF layout. Good for our static use case.
async function encodeStaticGif(canvas) {
  const ctx = canvas.getContext("2d");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { palette, indices } = quantizeTo256(data);
  const bytes = writeGif(width, height, palette, indices);
  return new Blob([bytes], { type: "image/gif" });
}

// Median-cut color quantization down to a 256-color palette.
function quantizeTo256(rgba) {
  const pixels = [];
  for (let i = 0; i < rgba.length; i += 4) {
    pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  // Median cut
  function bucketize(bucket, depth) {
    if (depth === 0 || bucket.length <= 1) {
      const avg = bucket.reduce(
        (a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]],
        [0, 0, 0],
      ).map((v) => Math.round(v / bucket.length));
      return [avg];
    }
    const ranges = [0, 1, 2].map((c) => {
      let min = 255, max = 0;
      for (const p of bucket) { if (p[c] < min) min = p[c]; if (p[c] > max) max = p[c]; }
      return max - min;
    });
    const channel = ranges.indexOf(Math.max(...ranges));
    bucket.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(bucket.length / 2);
    return [
      ...bucketize(bucket.slice(0, mid), depth - 1),
      ...bucketize(bucket.slice(mid), depth - 1),
    ];
  }
  const palette = bucketize(pixels.slice(), 8).slice(0, 256);
  while (palette.length < 256) palette.push([0, 0, 0]);

  const indices = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    let best = 0, bestDist = Infinity;
    const p = pixels[i];
    for (let j = 0; j < palette.length; j++) {
      const q = palette[j];
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d < bestDist) { bestDist = d; best = j; }
    }
    indices[i] = best;
  }
  return { palette, indices };
}

function writeGif(width, height, palette, indices) {
  const out = [];
  // Header
  for (const c of "GIF87a") out.push(c.charCodeAt(0));
  // Logical Screen Descriptor
  out.push(width & 0xff, (width >> 8) & 0xff);
  out.push(height & 0xff, (height >> 8) & 0xff);
  out.push(0b11110111); // global color table flag + color res + size (256 colors)
  out.push(0); // bg color index
  out.push(0); // aspect

  // Global color table
  for (let i = 0; i < 256; i++) {
    const c = palette[i] || [0, 0, 0];
    out.push(c[0], c[1], c[2]);
  }

  // Image descriptor
  out.push(0x2c);
  out.push(0, 0, 0, 0);
  out.push(width & 0xff, (width >> 8) & 0xff);
  out.push(height & 0xff, (height >> 8) & 0xff);
  out.push(0);

  // LZW
  out.push(8); // min code size
  const lzw = lzwEncode(indices, 8);
  // Pack into sub-blocks
  for (let i = 0; i < lzw.length; i += 255) {
    const chunk = lzw.slice(i, i + 255);
    out.push(chunk.length);
    for (const b of chunk) out.push(b);
  }
  out.push(0); // block terminator

  out.push(0x3b); // trailer

  return new Uint8Array(out);
}

function lzwEncode(data, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const dict = new Map();
  for (let i = 0; i < clearCode; i++) dict.set(String.fromCharCode(i), i);

  const out = [];
  let buffer = 0;
  let bufferBits = 0;
  const emit = (code, bits) => {
    buffer |= code << bufferBits;
    bufferBits += bits;
    while (bufferBits >= 8) {
      out.push(buffer & 0xff);
      buffer >>= 8;
      bufferBits -= 8;
    }
  };

  emit(clearCode, codeSize);

  let w = String.fromCharCode(data[0]);
  for (let i = 1; i < data.length; i++) {
    const c = String.fromCharCode(data[i]);
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc;
    } else {
      emit(dict.get(w), codeSize);
      if (nextCode < 4096) {
        dict.set(wc, nextCode++);
        if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
      } else {
        emit(clearCode, codeSize);
        dict.clear();
        for (let k = 0; k < clearCode; k++) dict.set(String.fromCharCode(k), k);
        codeSize = minCodeSize + 1;
        nextCode = eoiCode + 1;
      }
      w = c;
    }
  }
  emit(dict.get(w), codeSize);
  emit(eoiCode, codeSize);
  if (bufferBits > 0) out.push(buffer & 0xff);
  return out;
}

/* ───────────────────────── Helpers ───────────────────────── */

export function humanFileSize(bytes) {
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
