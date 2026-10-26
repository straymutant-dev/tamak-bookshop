// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tamak Bookshop',
    short_name: 'Tamak',
    description: 'Books for every class level. Order online and pick up in Kasoa, Ghana.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF7F0',
    theme_color: '#164A41',
    // Real icons from the Tamak logo (public/icons/). They have padding, so Android can mask them safely.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}