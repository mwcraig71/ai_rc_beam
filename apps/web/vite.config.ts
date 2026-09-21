import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@rc-beam/core': path.resolve(__dirname, '../../packages/core/src/index.ts')
    }
  }
});
