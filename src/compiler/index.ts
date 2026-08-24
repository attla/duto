import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { getLayouts, parsePage, resolveStaticOutputPath } from './meta'

import { h } from 'preact'
import { render } from 'preact-render-to-string'
import minify from '@minify-html/node'

import type { ResolvedConfig } from 'vite'
import { DOCTYPE_RE } from './constants'
import { getAsset, getChunk, normalizeId } from './assets'

import type { IRoute, Metadata, RouteParams, StaticProps, SummaryMetadata } from './types'


// import i18n from '../client/i18n'
import { setLocale } from '../i18n/client'
import { log, substep } from 't0n/log'



import { promisify } from 'node:util'
import { brotliCompress } from 'node:zlib'

const brCompress = promisify(brotliCompress);


export const selfCloseEmptyTags = (html: string, tagName: string) => html.replace(new RegExp(`<${tagName}\\b([^>]*?)>\\s*</${tagName}>`, 'g'), (_, attrs) => `<${tagName}${attrs} />`)

export async function renderPage(
  meta: Metadata,
  config: ResolvedConfig,
  page: IRoute
 ) {
  const {
    mod, islands,
    hasGetProps, hasGetStaticProps,
    isClientOnly,
  } = await parsePage(page, meta)
  // const {
  //   mod, islands,
  //   hasGetProps, hasGetStaticProps,
  //   isClientOnly,
  // } = page

  if (!mod?.default) {
    console.warn(`No default export in ${page.filePath} — skipping`)
    return
  }

  // console.log(page.filePath)
  // console.error('hasGetProps:', hasGetProps)
  // console.error('hasGetStaticProps:', hasGetStaticProps)
  // console.error('isClientOnly:', isClientOnly)

  if (page.isInternal || page.is404 || (page.isDynamic && !hasGetStaticProps)) {
    meta.summary.set('/'+ page.fileName, {
      type: 2,
      path: '/'+ page.fileName,
      size: 0,
      sizeBr: 0,
      sizeJS: 0,
    })
    // meta.routes.set(page.fullFilePath, page)
    return
  }

  // console.log(meta.routes.size)
  // meta.routes.set(page.filePath, page)

  const { filePath, pattern, params } = page

  let props = []
  if (hasGetStaticProps) {
    let sProps = []
    try {
      const _sProps = await Promise.resolve(mod.getStaticProps!())
      sProps = Array.isArray(_sProps) ? _sProps : [_sProps]
    } catch (e) {
      return console.error(`getStaticProps failed in ${filePath}: ${e}`)
    }

    for (const entry of sProps) {
      const _props = {
        routeParams: {},
        pageProps: {},
      } as {
        routeParams: RouteParams,
        pageProps: StaticProps,
      }

      for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
        if (k in params) {
          _props.routeParams[k] = v as string | string[]
        } else {
          _props.pageProps[k] = v
        }
      }

      props.push(_props)
    }
  } else {
    props.push({ routeParams: {}, pageProps: {} })
  }

  const layouts = await getLayouts(meta, page.filePath)

  for (const prop of props) {
    const allProps = { ...prop.pageProps, ...prop.routeParams }

    // @ts-ignore
    // i18n(allProps?.locale || meta.i18n.fallbackLocale, meta.i18n.locales, meta.i18n.messages, meta.i18n.routes, meta.i18n.routeMap)
    allProps?.locale && setLocale(allProps?.locale || meta.i18n.fallbackLocale)

    const pathname = resolveStaticOutputPath(page, prop.routeParams)
    // TODO: melhorar isso para impedir erros do wouter e afins
    // @ts-ignore
    global.location = { pathname: '/'+ (pathname === 'index' ? '' : pathname) }
    // @ts-ignore
    global.window = { $duto: {
      sroutes: meta.spages,
      navigate: {},
      route: { pattern: page.pattern, params: prop.routeParams, path: global.location.pathname },
    } }

    let html = ''

    // if (!isClientOnly) { // TODO: fazer funcionar com `use client`
      try {
        let el = h(mod.default, allProps as any)
        for (const layout of layouts)
          el = h(layout.mod.default, null, el)

        html = render(el)
      } catch (e) {
        console.error(`  SSR render failed for ${filePath}: ${e}`)
        console.warn(e)
        html = ''
      }
    // }

    // TODO: refatorar isso... aqui dentro já é o SSG
    const needsClient = hasGetProps || !!isClientOnly || islands.length > 0

    // console.error(page.fileName)
    // console.error('needsClient: ', needsClient)

    const assets = []
    for (const [depPath, dep] of meta.map.get(page.fullFilePath)!.deps)
      assets.push(normalizeId(dep.path))


    html = buildHtml(assets, html) //, needsClient, allProps, pattern, islands)
    // html = selfCloseEmptyTags(String(minify.minify(
    //   Buffer.from(buildHtml(assets, html, needsClient, allProps, pattern, islands)),
    //   {}
    //   // options != null ? options : {},
    // )), 'i-i')

    const outFile = join(
      config.root,
      config.build.outDir,
      pathname +'.html'
    )
    const outHTML = minify.minify(
      Buffer.from(html),
      {}
      // options != null ? options : {},
    )
    await mkdir(dirname(outFile), {recursive: true})
    // await writeFile(outFile, outHTML, 'utf-8')
    await Bun.write(outFile, outHTML)

    const key = '/'+ pathname
    if (page.isDynamic) {
      const _key = '/'+ page.fileName
      if (!meta.summary.has(_key)) {
        const ddata = {
          path: _key,
          size: page.content.length,
          sizeBr: (await brCompress(page.content)).length,
          sizeJS: 0, // TODO
        }
        meta.summary.set(_key, { type: 1, children: new Map<string, SummaryMetadata>(), ...ddata})
        meta.summary.set(_key + 2, { type: 2, ...ddata})
      }

      const summary = meta.summary.get(_key)!
      summary.children?.set(key, {
        type: 0,
        path: key,
        size: outHTML.length,
        sizeBr: (await brCompress(outHTML)).length,
        sizeJS: 0,
      })

    } else {
      meta.summary.set(key, {
        type: 0,
        path: key,
        size: outHTML.length,
        sizeBr: (await brCompress(outHTML)).length,
        sizeJS: 0,
      })
    }

  }
}

function buildHtml(
  _assets: string[],
  html: string,
  // needsClient: boolean,
  // props?: StaticProps,
  // routePattern?: string,
  // islands?: Island[],
): string {
  if (!(html.includes('<body') || html.includes('<html') || html.includes('<head')))
    html = wrapHtml(html)

  if (!DOCTYPE_RE.test(html))
    html = '<!DOCTYPE html>'+ html

//   const pageProps = needsClient
//     ? `<script>
// window.__PROPS__ = ${JSON.stringify(props ?? {})};
// </script>`
//     : ''

  const assets = [
    ':duto/client/app.tsx',
    // ..._assets,
  ]

  const prepend = assets.map(asset => {
    const href = getAsset(asset)
    return href ? `<link href="${href}" rel=stylesheet>` : null
  }).filter(Boolean).join('')
    // + `<style>d-b,d-p,i-d,i-s{display:contents}</style>`
    // + `<style>d,d-slot,d-s-slot{display:contents}</style>`

//     d>*,d-slot>*,d-s-slot>*{display:revert}

// d {
//   display: block;
//   box-sizing: border-box;
// }

// /* Herda todos os estilos padrão de div */
// d:not([hidden]) {
//   display: block;
// }

// /* Remove qualquer comportamento de display:contents */
// d, d-slot, d-s-slot {
//   display: block !important;
// }

//   d *,
//   d-slot *,
//   d-s-slot * {
//     visibility: visible !important;
//     opacity: 1 !important;
//   }
//     </style>

//     <script>class DDiv extends HTMLElement {
//     constructor() {
//       super();
//     }
//   }

//   if (typeof customElements !== 'undefined' && !customElements.get('d')) {
//     customElements.define('d', DDiv);
//   }</script>

  if (html.includes('</head>')) {
    html = html.replace('</head>', prepend +'</head>')
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>'+ prepend)
  } else {
    html = prepend + html
  }

  // const append = pageProps + assets.map(file => {
  const append = assets.map(file => {
    const src = getChunk(file)
    return src ? `<script src="${src}" type=module></script>` : null
  }).filter(Boolean).join('')

  if (html.includes('</body>'))
    return html.replace('</body>', `${append}</body>`)

  return html + append
}

export function wrapHtml(content: string) {
  return `<html>
  <head>
    <meta charset=utf-8>
    <meta content="width=device-width,initial-scale=1" name=viewport>
  </head>
  <body hidden>
    ${content}
  </body>
</html>`
}
