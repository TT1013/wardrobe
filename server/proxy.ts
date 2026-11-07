import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleApi } from './core'

// Local-only helper so the browser can read retailer pages/images without CORS getting in the way.
// It exists under `npm run dev` / `npm run preview`. Hosted builds use the Cloudflare Worker (worker/) instead.

async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/api/')) return next()
  const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, { method: req.method })
  const out = await handleApi(request, { allowOrigins: null })
  if (!out) return next()
  res.statusCode = out.status
  out.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await out.arrayBuffer()))
}

export function wardrobeProxy(): Plugin {
  return {
    name: 'wardrobe-proxy',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
