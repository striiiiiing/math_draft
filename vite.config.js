import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_WEBDAV_PROXY_TARGET || 'https://dav.jianguoyun.com';

  return {
    base: '/math_draft/', // GitHub Pages repository base path.
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'math-field',
          },
        },
      }),
    ],
    server: {
      proxy: {
        '/math_draft/nutstore-dav': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/math_draft\/nutstore-dav/, ''),
        },
        '/nutstore-dav': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/nutstore-dav/, ''),
        },
        '/math_draft/dav': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/math_draft/, ''),
        },
        '/dav': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
