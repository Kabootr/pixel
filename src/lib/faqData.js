// Shared FAQ data: rendered as visible HTML by <FAQ /> and serialized into
// FAQPage JSON-LD on the home page. Visible answer text must stay
// byte-identical to the JSON-LD `text` field — Google's FAQ rich-result
// guidelines require the two to match.

export const productFaq = [
  {
    q: "Are my images really not uploaded?",
    a: "Correct. The entire conversion pipeline runs in your browser using the Canvas API and a couple of small WASM/JS libraries for less-common formats like TIFF. There's no server endpoint that accepts your image data — open DevTools and watch the Network tab if you want to verify it yourself.",
  },
  {
    q: "Is there a file-size limit?",
    a: "No hard limit. The practical ceiling is your device's available memory — modern laptops handle 100MB+ images comfortably. Mobile devices vary; if a conversion fails on a large image, try resizing it first.",
  },
  {
    q: "Why does my SVG-to-PNG conversion not match the original at scale?",
    a: "We rasterize SVGs at their intrinsic size (or 1024px if unspecified). To get a higher-resolution PNG, use Resize → By percent and bump it up before converting.",
  },
  {
    q: "Why is my converted PNG bigger than the JPG I started with?",
    a: "PNG is lossless and JPG is lossy — for photographs, JPG will always be smaller. If you want to keep file size down, target WebP instead, which gives you JPG-class compression with optional transparency.",
  },
  {
    q: "Do you support batch conversion?",
    a: "Yes. Drop in as many files as you like and hit Convert all. Download them individually, or grab the whole batch as a single ZIP.",
  },
  {
    q: "Can I convert TO an animated GIF?",
    a: "Right now we encode the first frame as a single-frame GIF. Multi-frame GIF and animated-WebP encoding is on the roadmap.",
  },
];

export const seoFaq = [
  {
    q: "How can I convert my picture?",
    a: "Drop it onto the converter at the top of this page, pick a target format (PNG, JPG, WebP, GIF, SVG, ICO or TIFF), and click Convert. The whole conversion runs in your browser — no upload, no signup, nothing to wait for.",
  },
  {
    q: "What is a JPG converter?",
    a: "A JPG converter changes images between JPG (JPEG) and other formats — turning a PNG into a JPG to shrink file size, or a JPG into a PNG to get a transparent background. This page does both directions, plus WebP, GIF, SVG, ICO and TIFF.",
  },
  {
    q: "How to convert 10 MB photos?",
    a: "Same way as any other photo — drop it in, pick a target format, and click Convert. There's no upload step, so a 10 MB file converts as fast as your CPU can crunch it. To get a smaller output, target JPG or WebP and lower the quality slider before exporting.",
  },
  {
    q: "What is the best JPG image converter?",
    a: "The best converter depends on what you care about: speed, privacy, batch support, or specific format coverage. This one optimizes for privacy and batch — every conversion runs locally, you can drop hundreds of files at once, and there's no quota or signup.",
  },
  {
    q: "Can AI transform a photo?",
    a: "Yes — AI tools can restyle, upscale, remove backgrounds, or generate variations from a photo. That's a different category of tool from format conversion. This page handles format and resize only; for AI editing, look at Photoshop's Generative Fill, Adobe Firefly, or Stable Diffusion.",
  },
  {
    q: "Is image converter free?",
    a: "This one is — fully free, no signup, no quota, no ads inside the workspace. Because every conversion runs in your browser, there are no server costs to pass on.",
  },
  {
    q: "How to convert a JPG photo?",
    a: "Drop the JPG onto the converter above, pick a target format (PNG keeps transparency, WebP gives you a smaller file, ICO turns it into a favicon), and click Convert. Tune quality and dimensions in Advanced Settings before exporting if you need to.",
  },
  {
    q: "What is an image converter?",
    a: "An image converter is a tool that changes a file from one image format to another — for example, JPG to PNG, PNG to WebP, or SVG to PNG. The picture itself stays the same; only the container, compression, and metadata change.",
  },
  {
    q: "What is the full form of JPG?",
    a: "JPG (and JPEG) stand for Joint Photographic Experts Group — the standards body that defined the format in 1992. JPG and JPEG are the same format; the three-letter version exists because older Windows file systems capped extensions at three characters.",
  },
  {
    q: "What is 1 MB size photo?",
    a: "A 1 MB photo is a file that takes 1 megabyte (about 1,000 kilobytes) of storage. The same image at the same resolution can be 5 MB as a PNG or 500 KB as a JPG — file size depends on format, compression level, and dimensions, not just what's in the picture.",
  },
  {
    q: "How do I resize an image to 2MB?",
    a: "File size is a function of dimensions, format, and quality — not a slider you can drag directly. To land near a 2 MB target: convert to JPG or WebP, lower the quality slider (start around 85), and reduce dimensions if you're still over. Re-export and check the size; repeat until you're under the cap.",
  },
  {
    q: "How many MB is a 1080p photo?",
    a: "A 1080p (1920×1080) photo typically lands at 200–500 KB as a JPG, 1–3 MB as a PNG, and 150–400 KB as a WebP. The range depends on detail — a flat blue sky compresses far smaller than a tree line.",
  },
  {
    q: "What is a JPG format photo converter?",
    a: "A JPG format photo converter changes other image formats (PNG, WebP, TIFF, etc.) into the JPG format, or vice versa. JPG is the right target when you want small file sizes for photos and don't need transparency.",
  },
  {
    q: "Which is better RAW or JPG?",
    a: "RAW for editing, JPG for sharing. RAW files keep all the sensor data so you can recover highlights, shift white balance, and push exposure in post — at the cost of huge file sizes and zero native browser or social-media support. JPG is the universal share format. Pros shoot RAW, edit, then export to JPG.",
  },
  {
    q: "Is it better to convert to JPG or PNG?",
    a: "JPG for photos and anything where small file size matters. PNG for screenshots, logos, illustrations, or anything that needs a transparent background or pixel-perfect sharpness. WebP often beats both — give it a try if your destination supports it.",
  },
  {
    q: "Can ChatGPT edit an image?",
    a: "ChatGPT can generate and edit images using its built-in image tools — adding objects, restyling, removing backgrounds. It doesn't do plain format conversion well, and it can't run locally. For straight conversion or resize, a dedicated tool like this page is faster and private.",
  },
  {
    q: "Which photo editor is 100% free?",
    a: "GIMP and Krita are fully free, open-source desktop editors. Photopea is a free browser-based editor that mimics Photoshop. For format conversion and resizing specifically, this page is free with no quota. Most AI-assisted editors have a paid tier somewhere.",
  },
  {
    q: "Is Reface AI free?",
    a: "Reface has a free tier with daily limits and a watermark on outputs; the unrestricted version is a paid subscription. It's a face-swap and AI-video tool — a different category from format conversion. For straight format and resize work without any quota, you can use this page.",
  },
];

export function toFaqPageSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
