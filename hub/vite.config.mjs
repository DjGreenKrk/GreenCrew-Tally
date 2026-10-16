import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  root: path.resolve('vite-app'),
  publicDir: path.resolve('public'),
  build: { outDir: path.resolve('build'), emptyOutDir: true },
  server: { port: 3001, strictPort: true },
})
