// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Same-format URLs (e.g. /png-to-png) aren't real conversions — redirect them
// to the homepage so we don't 404 users who guess the URL pattern.
const FORMATS = ['png', 'jpg', 'webp', 'gif', 'svg', 'ico', 'tiff'];
const sameFormatRedirects = Object.fromEntries(
  FORMATS.map((f) => [`/${f}-to-${f}`, '/']),
);
// Common alias: /jpeg-to-* and /*-to-jpeg → /jpg variants
const jpegAliases = {};
for (const f of FORMATS) {
  if (f !== 'jpg') {
    jpegAliases[`/jpeg-to-${f}`] = `/jpg-to-${f}`;
    jpegAliases[`/${f}-to-jpeg`] = `/${f}-to-jpg`;
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://realonlineruler.com',
  integrations: [
    sitemap({
      // Don't index the same-format redirect stubs.
      filter: (page) => !FORMATS.some((f) => page.endsWith(`/${f}-to-${f}/`)),
    }),
  ],
  redirects: {
    ...sameFormatRedirects,
    ...jpegAliases,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
