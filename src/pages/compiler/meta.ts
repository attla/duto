// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/routing/utils.ts

// https://github.com/cloudflare/vinext/blob/adfc2236cba5f7cde63f32f6fb35c0d892428376/packages/vinext/src/build/prerender.ts#L203
// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/entries/pages-client-entry.ts
// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/shims/ALS-ARCHITECTURE.md

import { dirname, extname } from 'node:path'

import { getEnv, JSJSON, newID } from 't0n'

import { getAliases } from './aliases'
import { DYNAMIC_RE, INTERNAL_RE, LAYOUT_RE, NF_NAMES, FILE_EXTENSIONS } from './constants'
import { scan } from '@/utils'

import { USE_CLIENT_RE } from './constants'

import getI18n from '../i18n/server'
import i18n from '../i18n/client'

import type {
  IRoute, RouteParam, RouteParams,
  Metadata,
  SummaryMetadata,
} from './types'


// TODO: https://github.com/cloudflare/vinext/blob/adfc2236cba5f7cde63f32f6fb35c0d892428376/packages/vinext/src/routing/file-matcher.ts#L90
export async function getPages(meta: Metadata) {
  const nf = new Map<string, IRoute>()
  const layouts = new Map<string, IRoute>()
  const pages = new Map<string, IRoute>()
  const spages = new Set<string>()
  const routes: IRoute[] = []

  for await (const [file, path, mod] of scan(meta.dir, FILE_EXTENSIONS)) {
    const ext = extname(file)
    const filePath = path.split(meta.dir+'/').pop() as string
    const fileName = filePath.replace(ext, '')
    const { pattern, params } = filePathToWouterPattern(fileName)

    const name = file.replace(ext, '').split('/').pop() as string
    const content = await Bun.file(file).text()

    const page = {
      fileExt: ext.substring(1),
      fileName,
      filePath,
      fullFilePath: file,
      pattern,
      params,
      is404: name ? NF_NAMES.includes(name) : false,
      isDynamic: DYNAMIC_RE.test(path),
      isInternal: INTERNAL_RE.test(path),

      importName: newID(),

      mod,
      content: content,
      layouts: [],
      hasGetStaticProps: typeof mod.getStaticProps === 'function',
      hasGetProps: typeof mod.getProps === 'function',
      isClientOnly: USE_CLIENT_RE.test(content),
    }

    if (LAYOUT_RE.test(path)) {
      layouts.set(page.fileName, page)
      continue
    }

    if (page.is404) {
      nf.set(page.fileName, page)
      routes.push(page)
      pages.set(file, page)
      continue
    }

    if (!page.isInternal)
      pages.set(file, page)

    if (!page.isInternal)
      routes.push(page)

    if (!page.isInternal) {
      if (page.isDynamic && page.hasGetStaticProps) {
        try {
          const _props = await page.mod.getStaticProps?.()
          const props = Array.isArray(_props) ? _props : [_props]
          for (const prop of props)
            spages.add('/'+resolveStaticOutputPath(page, prop as any))

        } catch(e) {
          console.log('errro', e)
        }
      } else if (!page.isDynamic) {
        spages.add(page.pattern)
      }
    }

  }

  meta.nf = nf
  meta.layouts = layouts
  meta.pages = pages
  meta.spages = spages
  meta.routes = await sortRoutes(meta, routes)
}

export async function getLayouts(meta: Metadata, path: string) {
  const layouts: IRoute[] = []
  const segments = dirname(path).split(/[\\/]/).filter(Boolean)

  for (let i = segments.length; i >= 0; i--) {
    const dir = segments.slice(0, i).join('/')

    const layout = meta.layouts.get(dir ? dir +'/_layout' : '_layout') || meta.layouts.get(dir ? dir +'/layout' : 'layout')
    if (!layout) continue

    // @ts-ignore
    if (layout.mod?.default)
      layouts.push(layout)
  }

  return layouts
}

export async function getMetadata(root: string, dir: string) {
  const meta = { root, dir, ...getEnv('duto', {}) } as Metadata
  meta.summary = new Map<string, SummaryMetadata>()

  meta.i18n = await getI18n(meta)
  i18n(meta.i18n.fallbackLocale, meta.i18n.locales, meta.i18n.messages, meta.i18n.routes, meta.i18n.routeMap)

  meta.aliases = await getAliases(root)

  await getPages(meta)

  meta.string = `// AUTO-GENERATED FILE - DO NOT EDIT
${meta.routes.filter(r => r.is404).map(r => `\nimport Page${r.importName + (r.hasGetProps ? `, { getProps as getProps${r.importName} }` : '')} from '${r.fullFilePath}'`).join('\n')}
${Array.from(meta.layouts.values()).map(l => `\nimport Layout${l.importName} from '${l.fullFilePath}'`).join('\n')}

export const views = [${meta.routes.map(r => `['${r.pattern}',${r.is404 ? 'Page'+ r.importName : `'${r.fullFilePath}'`},${Object.keys(r.params).length ? JSJSON(Object.entries(r.params).map(([_,v]) => v)) : '0'}${r.hasGetProps ? (r.is404 ? `,getProps${r.importName}` : `,1`) : (r.layouts.length ? ',0': '')}${r.layouts.length ? ',[' + Object.entries(r.layouts).map(([_,l]) => 'Layout'+l.importName) +']' : ''}]`).join(',')}]

export const SRoutes = new Set(${JSJSON([...meta.spages])})
`

  return meta
}







// //////////////////////////////////////////////////////////////////////////////////////////
type RouteMeta = {
  staticSegments: number,
  dynamicSegments: number,
  optionalSegments: number,
  catchAll: boolean,
  globalCatchAll: boolean,
  segmentsCount: number,
}
export async function sortRoutes(meta: Metadata, routes: IRoute[]) {
  const metas = new Map<IRoute, RouteMeta>()

  for (const route of routes) {
    route.layouts = await getLayouts(meta, route.fileName)
    metas.set(route, getRouteMeta(route.pattern))
  }

  // for (const route of routes) // TODO: talvez inserir o layout nesse loop
  //   metas.set(route, getRouteMeta(route.pattern))

  return routes.sort((a, b) => {
    const ma = metas.get(a)!
    const mb = metas.get(b)!

    // 404 global always last
    if (ma.globalCatchAll !== mb.globalCatchAll)
      return ma.globalCatchAll ? 1 : -1

    // catch-all at the end
    if (ma.catchAll !== mb.catchAll)
      return ma.catchAll ? 1 : -1

    // more static segments first
    if (ma.staticSegments !== mb.staticSegments)
      return mb.staticSegments - ma.staticSegments

    // fewer parameters first
    if (ma.dynamicSegments !== mb.dynamicSegments)
      return ma.dynamicSegments - mb.dynamicSegments

    // mandatory before optional ones
    if (ma.optionalSegments !== mb.optionalSegments)
      return ma.optionalSegments - mb.optionalSegments

    // deepest first
    if (ma.segmentsCount !== mb.segmentsCount)
      return mb.segmentsCount - ma.segmentsCount

    return a.pattern.localeCompare(b.pattern)
  })
}

function getRouteMeta(pattern: string): RouteMeta {
  const segments = pattern.split('/').filter(Boolean)

  let staticSegments = 0
  let dynamicSegments = 0
  let optionalSegments = 0
  let catchAll = false

  for (const segment of segments) {
    if (segment === '*' || segment === '*?') {
      catchAll = true
      continue
    }

    if (segment.startsWith(':')) {
      if (segment.endsWith('?'))
        optionalSegments++
      else
        dynamicSegments++

      continue
    }

    staticSegments++
  }

  return {
    staticSegments,
    dynamicSegments,
    optionalSegments,
    catchAll,
    globalCatchAll: pattern === '/*',
    segmentsCount: segments.length,
  }
}

const CATCHALL_NAMES = new Set(['404', 'not-found'])

export function filePathToWouterPattern(path: string): {
  pattern: string
  params: Record<string, RouteParam>
} {
  const normalized =
    path === 'index'
      ? ''
      : path.endsWith('/index')
        ? path.slice(0, -6)
        : path

  const segments = normalized ? normalized.split('/') : []

  const params: Record<string, RouteParam> = {}
  const patternParts: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLast = i === segments.length - 1

    // 404.tsx / not-found.tsx
    if (isLast && CATCHALL_NAMES.has(segment)) {
      params['*'] = {
        name: '*',
        optional: false,
        catchAll: true,
      }

      patternParts.push('*')
      continue
    }

    // [[...slug]]
    const optionalCatchAll = segment.match(/^\[\[\.\.\.(\w+)\]\]$/)

    if (optionalCatchAll) {
      const name = optionalCatchAll[1]

      params[name] = {
        name,
        optional: true,
        catchAll: true,
      }

      patternParts.push('*?')
      continue
    }

    // [...slug]
    const catchAll = segment.match(/^\[\.\.\.(\w+)\]$/)

    if (catchAll) {
      const name = catchAll[1]

      params[name] = {
        name,
        optional: false,
        catchAll: true,
      }

      patternParts.push('*')
      continue
    }

    // [[slug]]
    const optionalParam = segment.match(/^\[\[(\w+)\]\]$/)

    if (optionalParam) {
      const name = optionalParam[1]

      params[name] = {
        name,
        optional: true,
        catchAll: false,
      }

      patternParts.push(`:${name}?`)
      continue
    }

    // [slug]
    const param = segment.match(/^\[(\w+)\]$/)

    if (param) {
      const name = param[1]

      params[name] = {
        name,
        optional: false,
        catchAll: false,
      }

      patternParts.push(`:${name}`)
      continue
    }

    patternParts.push(segment)
  }

  const pattern =
    patternParts.length === 0
      ? '/'
      : `/${patternParts.join('/')}`

  return { pattern, params }
}

/**
 * Given a static props entry (returned by getStaticProps),
 * compute the output HTML path for that route + params.
 *
 * e.g. filePath=`blog/[slug].tsx`, params={slug:'hello'} → `blog/hello.html`
 * e.g. filePath=`shop/[...slug].tsx`, params={slug:['a','b']} → `shop/a/b.html`
 * e.g. filePath=`index.tsx`, params={} → `index.html`
 */
export function resolveStaticOutputPath(
  page: IRoute,
  params: RouteParams
) {
  let path = page.fileName

  if (page.isDynamic) {
    const resolved: string[] = []
    const segments = path.split('/')
    for (const segment of segments) {
      const optionalCatchAll = segment.match(/^\[\[\.\.\.(\w+)\]\]$/)
      if (optionalCatchAll) {
        const val = params[optionalCatchAll[1]]
        if (val === undefined) continue
        const parts = Array.isArray(val) ? val : [val]
        resolved.push(...parts)
        continue
      }

      const catchAll = segment.match(/^\[\.\.\.(\w+)\]$/)
      if (catchAll) {
        const val = params[catchAll[1]]
        const parts = Array.isArray(val) ? val : val ? [val] : []
        resolved.push(...parts)
        continue
      }

      const optionalParam = segment.match(/^\[\[(\w+)\]\]$/)
      if (optionalParam) {
        const val = params[optionalParam[1]]
        if (val !== undefined) resolved.push(String(val))
        continue
      }

      const param = segment.match(/^\[(\w+)\]$/)
      if (param) {
        const val = params[param[1]]
        if (val !== undefined) resolved.push(String(val))
        continue
      }

      resolved.push(segment)
    }

    path = resolved.join('/')
  }

  if (path === 'index' || path === '') return 'index'
  if (path === '404') return '404'

  if (path.endsWith('/index')) path = path.replace('/index', '')
  return path
}
