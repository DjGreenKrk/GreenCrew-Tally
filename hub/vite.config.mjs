import path from 'node:path'

export default {
  root: path.resolve('.'),
  publicDir: path.resolve('public'),
  build: { outDir: path.resolve('build'), emptyOutDir: true },
  server: { port: 3001, strictPort: true },
}
