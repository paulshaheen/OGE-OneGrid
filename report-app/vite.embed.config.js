import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

// Library build that produces a single self-contained IIFE bundle
// (JS + injected CSS) for hosting the OneGrid UI inside a Power BI custom visual.
export default defineConfig({
  plugins: [react(), cssInjectedByJs()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'embed-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: true,
    lib: {
      entry: 'embed/onegrid-embed.jsx',
      name: 'OneGridEmbed',
      formats: ['iife'],
      fileName: () => 'onegrid-embed.js',
    },
  },
});
