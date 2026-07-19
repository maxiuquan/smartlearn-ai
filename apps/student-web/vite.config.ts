import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// 本地开发时 data 在 ../../data；Docker 构建时 data 被 COPY 到 ./data
const dataPath = fs.existsSync(path.resolve(__dirname, '../../data'))
  ? path.resolve(__dirname, '../../data')
  : path.resolve(__dirname, 'data');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@data': dataPath,
    },
  },
  server: {
    port: 3002,
    proxy: {
      // api 后端 (FastAPI, port 8000)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // ai-engine 游戏接口 (FastAPI, port 8001)
      '/word-games': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // ai-engine 对话接口 (FastAPI, port 8001)
      '/chat': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
