// Shared by the local dev helper (server/proxy.ts) and the Cloudflare Worker (worker/index.ts).
// Web-standard APIs only (Request, Response, fetch, URL, TextDecoder): no Node imports.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const MAX_IMAGE = 15 * 1024 * 1024
const MAX_HTML = 3 * 1024 * 1024

export interface ApiOptions {
  /** Origins allowed to call the API from a browser (exact match). null = local helper, checked via Host instead. */
  allowOrigins: string[] | null
}

function isPrivateHost(h: string): boolean {
  const host = h.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const a = +v4[1], b = +v4[2]
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (host.includes(':')) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host.startsWith('::ffff:')
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

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })
}

async function readLimited(r: Response, limit: number): Promise<ArrayBuffer | null> {
  const buf = await r.arrayBuffer()
  return buf.byteLength > limit ? null : buf
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

async function handleImage(u: URL, ref: string | null, cors: Record<string, string>): Promise<Response> {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5', Referer: ref && parseTarget(ref) ? ref : `${u.origin}/` },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  if (isPrivateHost(new URL(r.url).hostname)) return json(400, { error: 'Blocked redirect' }, cors)
  if (!r.ok) return json(502, { error: `The site answered ${r.status}` }, cors)
  const type = r.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) return json(415, { error: 'Not an image' }, cors)
  const buf = await readLimited(r, MAX_IMAGE)
  if (!buf) return json(413, { error: 'Image too large' }, cors)
  return new Response(buf, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', ...cors } })
}

async function handlePage(u: URL, cors: Record<string, string>): Promise<Response> {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  if (isPrivateHost(new URL(r.url).hostname)) return json(400, { error: 'Blocked redirect' }, cors)
  if (!r.ok) return json(502, { error: `The site answered ${r.status} (it may block automated reads: use the bookmarklet instead)` }, cors)
  const buf = await readLimited(r, MAX_HTML)
  if (!buf) return json(413, { error: 'Page too large' }, cors)
  const out = extract(new TextDecoder().decode(buf), r.url)
  if (!out.images.length) return json(422, { error: 'No product image found on that page: use the bookmarklet on the page itself' }, cors)
  return json(200, out, cors)
}

/** Returns null when the request is not for /api/*, so a host can fall through to its own routing. */
export async function handleApi(req: Request, opts: ApiOptions): Promise<Response | null> {
  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/')) return null

  let cors: Record<string, string> = {}
  if (opts.allowOrigins) {
    const origin = req.headers.get('Origin') ?? ''
    if (!opts.allowOrigins.includes(origin)) return json(403, { error: 'Origin not allowed' })
    cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' } })
  } else if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(url.host)) {
    // Local helper: only answer requests addressed to this machine (guards against DNS-rebinding abuse).
    return json(403, { error: 'Local use only' })
  }
  if (req.method !== 'GET') return json(405, { error: 'GET only' }, cors)

  const target = parseTarget(url.searchParams.get('url'))
  if (!target) return json(400, { error: 'Bad or blocked URL' }, cors)
  try {
    if (url.pathname === '/api/image') return await handleImage(target, url.searchParams.get('ref'), cors)
    if (url.pathname === '/api/page') return await handlePage(target, cors)
    return json(404, { error: 'Unknown endpoint' }, cors)
  } catch (e) {
    return json(502, { error: `Could not reach that site (${(e as Error).name === 'TimeoutError' ? 'timed out' : 'network error'})` }, cors)
  }
}
