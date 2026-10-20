import { promisify } from 'node:util'
import { brotliCompress } from 'node:zlib'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

import { h } from 'preact'
import { render } from 'preact-render-to-string'
import minify from '@minify-html/node'

import { DOCTYPE_RE } from './constants'
import { getAsset, getChunk } from './assets'
import { resolveStaticOutputPath } from './routes'
import { setLocale } from '../i18n/client'

import type { Metadata, IRoute, RouteParams, StaticProps, SummaryMetadata } from './types'
import { logLevel } from 't0n/log'


const brCompress = promisify(brotliCompress)

export async function renderPage(
  meta: Metadata,
  page: IRoute
 ) {
  const {
    mod,
    layouts,
    hasGetStaticProps,
    useClient,
  } = page

  if (page.isInternal || (!page.useRaw && !page.useHtml && page.is404) || (page.isDynamic && !hasGetStaticProps))
    return meta.summary.set('/'+ page.name, { type: 2, path: '/'+ page.name, size: 0, sizeBr: 0, sizeJS: 0 })

  const { path, params } = page

  let props = []
  if (hasGetStaticProps) {
    let sProps = []
    try {
      const _sProps = await Promise.resolve(mod.getStaticProps!())
      sProps = Array.isArray(_sProps) ? _sProps : [_sProps]
    } catch (e) {
      return console.error(`getStaticProps failed in ${path}: ${e}`)
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

  const sProps = []
  for (const prop of props) {
    const allProps = { ...prop.pageProps, ...prop.routeParams }
    Object.keys(allProps).length && sProps.push(allProps)

    // @ts-ignore
    allProps?.locale && await setLocale(allProps?.locale || meta.i18n.fallbackLocale)

    const pathname = resolveStaticOutputPath(page, prop.routeParams)

    // Shims
    // TODO: melhorar isso para impedir erros do wouter e afins
    // @ts-ignore
    global.location = { pathname: '/'+ (pathname === 'index' ? '' : pathname) }
    global.location.href = global.location.pathname
    // @ts-ignore
    global.window = {
      location: global.location, // @ts-ignore
      $duto: {
        navigate: {},
        route: { pattern: page.pattern, params: prop.routeParams, path: global.location.pathname },
      }
    }

    let html = ''

    if (!useClient) {
      try {
        logLevel('none')
        let el = h(mod.default, allProps as any)
        for (const layout of layouts)
          el = h(layout.mod.default, null, el)

        // @ts-ignore
        const shell = mod?.Html || mod?.html || mod?.HTML
        // @ts-ignore
        if (shell) el = h(shell, allProps, el)

        html = render(el)
      } catch (e) {
        console.error(`  SSR render failed for ${path}: ${e}`)
        console.warn(e)
        html = ''
      } finally {
        logLevel()
      }
    }

    html = buildHtml(page, html, Object.keys(allProps).length ? allProps : undefined)

    const outFile = join(meta.root, meta.outDir, pathname +'.html')
    const outHTML = meta.minify ? minify.minify(Buffer.from(html), {}) : html
    await mkdir(dirname(outFile), {recursive: true})
    await Bun.write(outFile, outHTML)

    const key = '/'+ pathname
    if (page.isDynamic) {
      const _key = '/'+ page.name
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

  if (sProps.length)
    page.props = sProps.length < 2 ? sProps[0] : sProps
}

function buildHtml(
  page: IRoute,
  html: string,
  props: StaticProps = {},
): string {
  if (page.useRaw) return html
  if (!(html.includes('<body') || html.includes('<html') || html.includes('<head')))
    html = wrapHtml(html)
  else
    html = html.replace('<body', '<body hidden')

  if (!DOCTYPE_RE.test(html))
    html = '<!DOCTYPE html>'+ html

  const assets = [
    ':duto/client/app.tsx',
  ]

  const prepend = assets.map(asset => {
    const href = getAsset(asset)
    return href ? `<link rel="preload" href="${href}" as="style" onload="this.rel='stylesheet'">` : null
  }).filter(Boolean).join('')

  if (html.includes('</head>')) {
    html = html.replace('</head>', prepend +'</head>')
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>'+ prepend)
  } else {
    html = prepend + html
  }

  if (page.useHtml) props.__raw = true

  const append = assets.map(file => {
    const src = getChunk(file)
    return src ? `<script type=module src="${src}"></script>` : null
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
