import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/static/dist/',
  plugins: [preact(), tailwindcss()],
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') ?? [];
          const ext = info[info.length - 1];
          if (/\.(woff2?|ttf|otf|eot)$/.test(assetInfo.name ?? '')) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          if (/\.(png|jpe?g|gif|svg|webp)$/.test(assetInfo.name ?? '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:7319', changeOrigin: true },
      '/login': { target: 'http://localhost:7319', changeOrigin: true },
      '/logout': { target: 'http://localhost:7319', changeOrigin: true },
      '/static': { target: 'http://localhost:7319', changeOrigin: true },
      '/register': { target: 'http://localhost:7319', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
});
