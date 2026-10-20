import { dirname, join } from 'pathe'
import { NF_NAMES } from './constants'
import { _root } from '@/utils'
import type { Metadata, IRoute, RouteParams, Params, } from './types'

export const router = new Bun.FileSystemRouter({
  style: 'nextjs',
  dir: join(_root, 'pages'),
  // origin: 'https://example.com',
  // assetPrefix: 'assets/',
})
export const reload = () => router.reload()
export const match = (input: string | Request | Response) => router.match(input)

export const match404 = (meta: Metadata, path: string) => {
  const segments = dirname(path).split(/[\\/]/).filter(Boolean)

  for (let i = segments.length; i >= 0; i--) {
    const dir = segments.slice(0, i).join('/')

    for (const item of NF_NAMES) {
      const page = meta.nf.get((dir ? dir+'/' : '') + item)
      if (page) return '/'+ page.name
    }
  }

  return ''
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

// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/routing/utils.ts

type RouteMeta = {
  staticPath: number,
  dynamic: number,
  optional: number,
  catchAll: boolean,
  globalCatchAll: boolean,
  count: number,
}

export async function sortRoutes(meta: Metadata, routes: IRoute[]) {
  const metas = new Map<IRoute, RouteMeta>()

  for (const route of routes) {
    route.layouts = await getLayouts(meta, route.name)
    metas.set(route, getRouteMeta(route.pattern))
  }

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
    if (ma.staticPath !== mb.staticPath)
      return mb.staticPath - ma.staticPath

    // fewer parameters first
    if (ma.dynamic !== mb.dynamic)
      return ma.dynamic - mb.dynamic

    // mandatory before optional ones
    if (ma.optional !== mb.optional)
      return ma.optional - mb.optional

    // deepest first
    if (ma.count !== mb.count)
      return mb.count - ma.count

    return a.pattern.localeCompare(b.pattern)
  })
}

function getRouteMeta(pattern: string): RouteMeta {
  const segments = pattern.split('/').filter(Boolean)

  let staticPath = 0
  let dynamic = 0
  let optional = 0
  let catchAll = false

  for (const segment of segments) {
    if (segment === '*' || segment === '*?') {
      catchAll = true
      continue
    }

    if (segment.startsWith(':')) {
      if (segment.endsWith('?'))
        optional++
      else
        dynamic++

      continue
    }

    staticPath++
  }

  return {
    staticPath,
    dynamic,
    optional,
    catchAll,
    globalCatchAll: pattern === '/*',
    count: segments.length,
  }
}

const CATCHALL_NAMES = new Set(['404', 'not-found'])
const OPTIONAL_CATCH_ALL_RE = /^\[\[\.\.\.(\w+)\]\]$/
const CATCH_ALL_RE = /^\[\.\.\.(\w+)\]$/
const OPTIONAL_RE = /^\[\[(\w+)\]\]$/
const PARAM_RE = /^\[(\w+)\]$/

// bit flags
const OPTIONAL = 1
const CATCH_ALL = 2

export function filePathToWouterPattern(
  path: string,
): {
  pattern: string,
  params: Params,
} {
  const normalized =
    path === 'index'
      ? ''
      : path.endsWith('/index')
        ? path.slice(0, -6)
        : path

  const segments = normalized ? normalized.split('/') : []
  const params: [string, number][] = []
  const patternParts: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLast = i === segments.length - 1

    if (isLast && CATCHALL_NAMES.has(segment)) {
      params.push(['*', CATCH_ALL])
      patternParts.push('*')
      continue
    }

    let match = OPTIONAL_CATCH_ALL_RE.exec(segment)

    if (match) {
      params.push([match[1], OPTIONAL | CATCH_ALL])
      patternParts.push('*?')
      continue
    }

    match = CATCH_ALL_RE.exec(segment)

    if (match) {
      params.push([match[1], CATCH_ALL])
      patternParts.push('*')
      continue
    }

    match = OPTIONAL_RE.exec(segment)

    if (match) {
      params.push([match[1], OPTIONAL])
      patternParts.push(`:${match[1]}?`)
      continue
    }

    match = PARAM_RE.exec(segment)

    if (match) {
      params.push([match[1], 0])
      patternParts.push(`:${match[1]}`)
      continue
    }

    patternParts.push(segment)
  }

  return {
    pattern: patternParts.length
      ? `/${patternParts.join('/')}`
      : '/',
    params,
  }
}

/**
 * Given a static props entry (returned by getStaticProps)
 * compute the output HTML path for that route + params
 *
 * e.g. filePath=`blog/[slug].tsx`, params={slug:'hello'} → `blog/hello.html`
 * e.g. filePath=`shop/[...slug].tsx`, params={slug:['a','b']} → `shop/a/b.html`
 * e.g. filePath=`index.tsx`, params={} → `index.html`
 */
export function resolveStaticOutputPath(
  page: IRoute,
  params: RouteParams
) {
  let path = page.name

  if (page.isDynamic) {
    const resolved: string[] = []
    const segments = path.split('/')
    for (const segment of segments) {
      const optionalCatchAll = segment.match(OPTIONAL_CATCH_ALL_RE)
      if (optionalCatchAll) {
        const val = params[optionalCatchAll[1]]
        if (val === undefined) continue
        const parts = Array.isArray(val) ? val : [val]
        resolved.push(...parts)
        continue
      }

      const catchAll = segment.match(CATCH_ALL_RE)
      if (catchAll) {
        const val = params[catchAll[1]]
        const parts = Array.isArray(val) ? val : val ? [val] : []
        resolved.push(...parts)
        continue
      }

      const optionalParam = segment.match(OPTIONAL_RE)
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
