export interface Incoming {
  title: string
  brand: string
  price: string
  url: string
  images: string[]
  /** Images the bookmarklet already copied inside the store page, keyed by image URL. */
  blobs?: Record<string, Blob>
}

const env = (import.meta as any).env ?? {}
/** Set at build time for the hosted site (the Cloudflare Worker); empty means same-origin, i.e. the local dev helper. */
export const API_BASE: string = (env.VITE_API_BASE ?? '').replace(/\/$/, '')
/** Link import needs a helper: the Worker on the hosted site, or the dev server locally. */
export const HELPER: boolean = !!API_BASE || !!env.DEV || env.VITE_HELPER === 'on'

const NO_HELPER = 'Link import is not available here. Run the app with `npm run dev`, or use the hosted site once its helper is set up.'

/** Fetch an image through the local helper (retailer CDNs block direct browser reads). */
export async function proxyImage(imageUrl: string, ref?: string): Promise<Blob> {
  const q = new URLSearchParams({ url: imageUrl })
  if (ref) q.set('ref', ref)
  let r: Response
  try {
    r = await fetch(`${API_BASE}/api/image?${q}`)
  } catch {
    throw new Error(NO_HELPER)
  }
  const type = r.headers.get('content-type') ?? ''
  if (!r.ok) {
    const j = await r.json().catch(() => null)
    throw new Error(j?.error ?? NO_HELPER)
  }
  if (!type.startsWith('image/')) throw new Error(NO_HELPER)
  return r.blob()
}

/** Ask the helper to read a product page and list its images, title, brand and price. */
export async function proxyPage(pageUrl: string): Promise<Incoming> {
  let r: Response
  try {
    r = await fetch(`${API_BASE}/api/page?${new URLSearchParams({ url: pageUrl })}`)
  } catch {
    throw new Error(NO_HELPER)
  }
  if (!(r.headers.get('content-type') ?? '').includes('json')) throw new Error(NO_HELPER)
  const j = await r.json()
  if (!r.ok) throw new Error(j.error ?? 'Could not read that page')
  return j as Incoming
}

export function proxyImageSrc(imageUrl: string, ref?: string): string {
  const q = new URLSearchParams({ url: imageUrl })
  if (ref) q.set('ref', ref)
  return `${API_BASE}/api/image?${q}`
}

/** Bookmarklet source: runs on the retailer's page, collects product data, opens this app with it. */
export function makeBookmarklet(appUrl: string): string {
  const src = `(function(){
var APP=${JSON.stringify(appUrl)};
var abs=function(u){try{return new URL(u,location.href).href}catch(e){return null}};
var c=[];var add=function(u){u=u&&abs(u);if(u&&/^https?:/.test(u)&&c.indexOf(u)<0)c.push(u)};
var m=function(s){var e=document.querySelector(s);return e?e.getAttribute('content')||'':''};
var title=m('meta[property="og:title"]')||document.title,brand=m('meta[property="og:site_name"]'),price=m('meta[property="product:price:amount"]')||m('meta[property="og:price:amount"]');
var ld=document.querySelectorAll('script[type="application/ld+json"]');
for(var k=0;k<ld.length;k++){try{var q=[JSON.parse(ld[k].textContent)];while(q.length){var o=q.pop();if(!o||typeof o!=='object')continue;if(Array.isArray(o)){for(var z=0;z<o.length;z++)q.push(o[z]);continue}
if(o['@graph'])q.push(o['@graph']);var t=[].concat(o['@type']||[]);
if(t.indexOf('Product')>-1){[].concat(o.image||[]).forEach(function(i){add(typeof i==='string'?i:i&&i.url)});if(o.name)title=o.name;if(o.brand)brand=typeof o.brand==='string'?o.brand:(o.brand.name||brand);var of=[].concat(o.offers||[])[0];if(of&&(of.price||of.lowPrice))price=of.price||of.lowPrice}}}catch(e){}}
add(m('meta[property="og:image"]'));add(m('meta[name="twitter:image"]'));
[].slice.call(document.images).filter(function(i){return i.naturalWidth>300&&i.naturalHeight>300}).sort(function(a,b){return b.naturalWidth*b.naturalHeight-a.naturalWidth*a.naturalHeight}).slice(0,6).forEach(function(i){add(i.currentSrc||i.src)});
var d={title:title,brand:brand,price:String(price||''),url:location.href,images:c.slice(0,8)};
if(!d.images.length){alert('TT13: no product image found on this page.');return}
var origin=new URL(APP).origin;
var w=window.open(APP+'/#bm','tt13-wardrobe');
if(!w){alert('TT13: allow pop-ups for this site, then click again.');return}
var id=String(Date.now());
Promise.all(d.images.slice(0,4).map(function(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){return b.type.indexOf('image/')===0&&b.size<12e6?b:null}).catch(function(){return null}).then(function(b){return {url:u,blob:b}})})).then(function(list){
var msg={tt13:'import',id:id,meta:d,images:list},ack=false,tries=0;
window.addEventListener('message',function(e){if(e.origin===origin&&e.data&&e.data.tt13==='ack'&&e.data.id===id)ack=true});
var iv=setInterval(function(){if(ack||++tries>50){clearInterval(iv);if(!ack)alert('TT13: could not reach the wardrobe app. Open it once, then click again.');return}try{w.postMessage(msg,origin)}catch(e){}},400);
});
})();`
  return 'javascript:' + encodeURIComponent(src.replace(/\n/g, ''))
}
