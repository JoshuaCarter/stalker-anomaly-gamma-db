import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(__dirname, 'site', 'public');

// CSS browser floor — single source of truth.
//
// The build pipeline must not drop progressive-enhancement fallbacks. The
// regression that prompted this: source has `height:100vh; height:100dvh`, but
// the minifier treated the `100vh` line as a redundant duplicate and removed it,
// leaving only `100dvh` — which engines without dynamic viewport units (Chrome
// <108, Safari <15.4, Firefox <101) can't parse, so `body` fell back to
// height:auto and the whole fixed-shell layout lost its scroll region.
//
// Two knobs, both fed from this one floor so they can't drift:
//   - css.transformer 'lightningcss' uses the encoded-int `lightningTargets`.
//   - build.cssTarget uses the esbuild-style `cssTarget` strings, and is the
//     knob that actually matters here: Vite 8 runs on Rolldown, whose Oxc
//     minifier (cssMinify:'lightningcss' is ignored) only keeps the fallbacks
//     when told these old browsers are in scope.
const CSS_FLOOR = { chrome: 100, edge: 100, firefox: 100, safari: 15, ios: 15 };
const cssTarget = Object.entries(CSS_FLOOR).map(([b, v]) => `${b}${v}`);
const lightningTargets = Object.fromEntries(
  Object.entries(CSS_FLOOR).map(([b, v]) => [b === 'ios' ? 'ios_saf' : b, v << 16]),
);

// Serve index.html from public/ subdirectories (acknowledgements/, contact/, etc.)
// before Vite's SPA fallback rewrites them to the root index.html.
function publicDirIndex() {
  return {
    name: 'public-dir-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url.endsWith('/')) {
          const indexPath = join(publicDir, url, 'index.html');
          if (existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readFileSync(indexPath, 'utf-8'));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: 'site',
  plugins: [vue(), publicDirIndex()],
  css: {
    transformer: 'lightningcss',
    lightningcss: { targets: lightningTargets },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    cssTarget,
  },
});
