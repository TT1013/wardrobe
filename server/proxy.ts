import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import type { Plugin } from 'vite'

// Local-only helper so the browser can read retailer pages/images without CORS getting in the way.
// It only exists in `npm run dev` / `npm run preview`; a static deploy has no /api and the app degrades gracefully.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_HTML = 3 * 1024 * 1024

function isPrivateHost(h: string): boolean {
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true
  const host = h.replace(/^\[|\]$/g, '')
  const kind = isIP(host)
  if (kind === 4) {
    const [a, b] = host.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (kind === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
  return false
}

function parseTarget(raw: string | null): URL | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return null
    return u
  } catch {
    return null
  }
}

function send(res: ServerResponse, status: number, body: string | Buffer, type = 'application/json') {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}
const err = (res: ServerResponse, status: number, message: string) => send(res, status, JSON.stringify({ error: message }))

async function readLimited(r: Response, limit: number): Promise<Buffer | null> {
  const buf = Buffer.from(await r.arrayBuffer())
  return buf.length > limit ? null : buf
}

/* ---------- HTML extraction ---------- */

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

function metaMap(html: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3]
    const key = attrs.property || attrs.name || attrs.itemprop
    if (key && attrs.content && !(key.toLowerCase() in map)) map[key.toLowerCase()] = decode(attrs.content)
  }
  return map
}

interface Extracted { title: string; brand: string; price: string; url: string; images: string[] }

function extract(html: string, pageUrl: string): Extracted {
  const meta = metaMap(html)
  const images: string[] = []
  const add = (u?: unknown) => {
    if (typeof u !== 'string' || !u.trim() || u.startsWith('data:')) return
    try {
      const u2 = new URL(decode(u.trim()), pageUrl)
      if (u2.protocol === 'http:') u2.protocol = 'https:' // http/https twins are the same image
      const abs = u2.href
      if (/^https?:/.test(abs) && !images.includes(abs)) images.push(abs)
    } catch { /* ignore */ }
  }
  let title = meta['og:title'] || ''
  let brand = ''
  let price = meta['product:price:amount'] || meta['og:price:amount'] || ''

  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const queue: unknown[] = [JSON.parse(m[1])]
      while (queue.length) {
        const o = queue.pop() as Record<string, any> | null
        if (!o || typeof o !== 'object') continue
        if (Array.isArray(o)) { queue.push(...o); continue }
        if (o['@graph']) queue.push(o['@graph'])
        const types = ([] as string[]).concat(o['@type'] ?? [])
        if (types.includes('Product')) {
          for (const i of ([] as any[]).concat(o.image ?? [])) add(typeof i === 'string' ? i : i?.url)
          if (o.name) title = String(o.name)
          if (o.brand) brand = typeof o.brand === 'string' ? o.brand : String(o.brand?.name ?? brand)
          const offer = ([] as any[]).concat(o.offers ?? [])[0]
          if (offer && (offer.price || offer.lowPrice)) price = String(offer.price ?? offer.lowPrice)
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  add(meta['og:image'])
  add(meta['og:image:secure_url'])
  add(meta['twitter:image'])
  add(meta['twitter:image:src'])
  if (!title) title = meta['twitter:title'] || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')
  if (!brand) brand = meta['og:site_name'] || ''
  return { title: decode(title).trim(), brand: decode(brand).trim(), price, url: pageUrl, images: images.slice(0, 8) }
}

/* ---------- Handlers ---------- */

async function handleImage(u: URL, ref: string | null, res: ServerResponse) {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5', Referer: ref && parseTarget(ref) ? ref : `${u.origin}/` },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  if (isPrivateHost(new URL(r.url).hostname)) return err(res, 400, 'Blocked redirect')
  if (!r.ok) return err(res, 502, `The site answered ${r.status}`)
  const type = r.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) return err(res, 415, 'Not an image')
  const buf = await readLimited(r, MAX_IMAGE)
  if (!buf) return err(res, 413, 'Image too large')
  send(res, 200, buf, type)
}

async function handlePage(u: URL, res: ServerResponse) {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  if (isPrivateHost(new URL(r.url).hostname)) return err(res, 400, 'Blocked redirect')
  if (!r.ok) return err(res, 502, `The site answered ${r.status} (it may block automated reads: use the bookmarklet instead)`)
  const buf = await readLimited(r, MAX_HTML)
  if (!buf) return err(res, 413, 'Page too large')
  const out = extract(buf.toString('utf8'), r.url)
  if (!out.images.length) return err(res, 422, 'No product image found on that page: use the bookmarklet on the page itself')
  send(res, 200, JSON.stringify(out))
}

async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/api/')) return next()
  // Only answer requests addressed to the local machine (guards against DNS-rebinding abuse).
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '')) return err(res, 403, 'Local use only')
  const url = new URL(req.url, 'http://localhost')
  const target = parseTarget(url.searchParams.get('url'))
  if (!target) return err(res, 400, 'Bad or blocked URL')
  try {
    if (url.pathname === '/api/image') return await handleImage(target, url.searchParams.get('ref'), res)
    if (url.pathname === '/api/page') return await handlePage(target, res)
    return err(res, 404, 'Unknown endpoint')
  } catch (e) {
    return err(res, 502, `Could not reach that site (${(e as Error).name === 'TimeoutError' ? 'timed out' : 'network error'})`)
  }
}

export function wardrobeProxy(): Plugin {
  return {
    name: 'wardrobe-proxy',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
