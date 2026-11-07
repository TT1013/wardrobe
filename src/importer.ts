export interface Incoming {
  title: string
  brand: string
  price: string
  url: string
  images: string[]
}

const NO_HELPER = 'The importer helper is only available when the app runs with `npm run dev` on this computer.'

/** Fetch an image through the local helper (retailer CDNs block direct browser reads). */
export async function proxyImage(imageUrl: string, ref?: string): Promise<Blob> {
  const q = new URLSearchParams({ url: imageUrl })
  if (ref) q.set('ref', ref)
  let r: Response
  try {
    r = await fetch(`/api/image?${q}`)
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
    r = await fetch(`/api/page?${new URLSearchParams({ url: pageUrl })}`)
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
  return `/api/image?${q}`
}

/** Bookmarklet source: runs on the retailer's page, collects product data, opens this app with it. */
export function makeBookmarklet(appOrigin: string): string {
  const src = `(function(){
var APP=${JSON.stringify(appOrigin)};
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
window.open(APP+'/#import='+encodeURIComponent(JSON.stringify(d)),'tt13-wardrobe');
})();`
  return 'javascript:' + encodeURIComponent(src.replace(/\n/g, ''))
}
