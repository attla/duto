// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/routing/utils.ts

// https://github.com/cloudflare/vinext/blob/adfc2236cba5f7cde63f32f6fb35c0d892428376/packages/vinext/src/build/prerender.ts#L203
// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/entries/pages-client-entry.ts
// https://github.com/cloudflare/vinext/blob/main/packages/vinext/src/shims/ALS-ARCHITECTURE.md

import { dirname, extname, join } from 'node:path'
import { readdirSync } from 'node:fs'

import { IMPORT, JSJSON, newID } from 't0n'

import { getAliases } from './aliases'
import { EXT_RE, DYNAMIC_RE, INTERNAL_RE, LAYOUT_RE, NF_NAMES } from './constants'

import { USE_CLIENT_RE } from './constants'
import { parseSync } from '@swc/core'
import { findUsage, getFileMap } from './ast'
import { replaceIslands } from './island'
import { mkdir } from 'node:fs/promises'


import getI18n from '../i18n/server'
import i18n from '../i18n/client'

import type {
  PageModule,
  IRoute, RouteParam, RouteParams,
  Metadata,
  ImportUsage,
  SummaryMetadata,
} from './types'

export function getAssets(meta: Metadata): Set<string> {
  const deps = new Set<string>()
  const queue: string[] = []
  const dir = join(meta.root, meta.dir)

  for (const [path] of meta.map) {
    if (path.startsWith(dir))
      queue.push(path)
  }

  while (queue.length > 0) {
    const path = queue.pop()!
    const imports = meta.map.get(path)!.deps
    if (!imports?.size) continue

    for (const [dep] of imports) {
      if (!dep.startsWith(meta.root) || dep.startsWith(dir) || deps.has(dep)) continue
      deps.add(dep)
      if (dep in meta.map) queue.push(dep)
    }
  }

  return deps
}


export async function parsePage(page: IRoute, meta: Metadata) {
  const fileMeta = meta.map.get(page.fullFilePath)!
  if (!meta.violations.has(page.fullFilePath)) {
    return page
  }

  const islands: ImportUsage[] = []
  const ast = parseSync(fileMeta.content, { syntax: 'typescript', tsx: true })
  for (const [depPath, dep] of fileMeta.deps) {
    // console.error(depPath, page.fullFilePath)
    if (!meta.violations.has(depPath)) continue

    const usages = findUsage(fileMeta.content, dep.ref, ast)
    // console.log(usages, dep.ref)
    islands.push(...usages)
    // for (const usage of usages)
    //   islands.push(...usage.usages)


    // console.log(id)
    // console.log(usage)
    // console.log(usage[0].usages)
  }

  //   // Limpar linhas vazias extras
  //   result = result.replace(/^\s*\n/gm, '')

  const content = await replaceIslands(fileMeta.content, islands)
  // @ts-ignore
  let mod: PageModule = {}
  const tmpPath = join(meta.root, 'tmp', page.filePath)
  try {
    await mkdir(dirname(tmpPath), {recursive: true})
    await Bun.write(tmpPath, content)
    mod = await IMPORT(tmpPath)
  } catch {}

  return {
    safeFilePath: tmpPath,
    mod, content, islands,
    hasGetStaticProps: typeof mod.getStaticProps === 'function',
    hasGetProps: typeof mod.getProps === 'function',
    isClientOnly: USE_CLIENT_RE.test(content),
  }
}


// TODO: https://github.com/cloudflare/vinext/blob/adfc2236cba5f7cde63f32f6fb35c0d892428376/packages/vinext/src/routing/file-matcher.ts#L90
export async function getPages(meta: Metadata) {
  const files = readdirSync(join(meta.root, meta.dir), {recursive: true})
  const nf = new Map<string, IRoute>()
  const layouts = new Map<string, IRoute>()
  const pages = new Map<string, IRoute>()
  const spages = new Set<string>()
  const routes: IRoute[] = []

  for (const file of files) {
    if (typeof file !== 'string' || !EXT_RE.test(file)) continue

    const ext = extname(file)
    const fullFilePath = join(meta.root, meta.dir, file)
    const { pattern, params } = filePathToWouterPattern(file)

    const name = file.replace(EXT_RE, '').split('/').pop() as string

    const fileMeta = meta.map.get(fullFilePath)!
    const mod = (await IMPORT(fullFilePath)) as PageModule

    // console.error(file, INTERNAL_RE.test(file))
    const page = {
      fileExt: ext.substring(1),
      fileName: file.replace(ext, ''),
      filePath: file,
      fullFilePath,
      pattern,
      params,
      is404: name ? NF_NAMES.includes(name) : false,
      isDynamic: DYNAMIC_RE.test(file),
      isInternal: INTERNAL_RE.test(file),

      importName: newID(),

      mod,
      content: fileMeta.content,
      islands: [],
      layouts: [],
      hasGetStaticProps: typeof mod.getStaticProps === 'function',
      hasGetProps: typeof mod.getProps === 'function',
      isClientOnly: USE_CLIENT_RE.test(fileMeta.content),
    }

    if (LAYOUT_RE.test(file)) {
      layouts.set(page.fileName, page)
      continue
    }

    if (page.is404) {
      nf.set(page.fileName, page)
      routes.push(page)
      pages.set(fullFilePath, page)
      continue
    }

    if (!page.isInternal)
      pages.set(fullFilePath, page)

    if (!page.isInternal && page.isDynamic && page.hasGetProps)
      routes.push(page)

    if (!page.isInternal) {
      if (page.isDynamic && page.hasGetStaticProps) {
        try {
          const _props = await page.mod.getStaticProps?.()
          const props = Array.isArray(_props) ? _props : [_props]
          for (const prop of props) {
            // console.log(prop, file)
            spages.add('/'+resolveStaticOutputPath(page, prop as any))
          }
            // spages.add('/'+resolveStaticOutputPath(page, prop as any))
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

/**
 * A partir do path de um arquivo relativo à raiz de rotas do Next.js
 * (app/ ou pages/), retorna:
 *
 * - layouts: arquivos "layout.{tsx,ts,jsx,js}" aplicáveis à rota, ordenados
 *   do mais próximo do arquivo (segmento irmão) ao mais distante (raiz).
 *   Ex.: ["users/layout.tsx", "layout.tsx"]
 * - document: o "_document.{tsx,ts,jsx,js}" do Pages Router, se existir na
 *   raiz das rotas. Só é checado uma vez no topo, nunca por segmento — é
 *   um arquivo único, diferente do layout, que pode ser aninhado.
 *
 * Compatibilidade com a especificação oficial do Next.js:
 * - App Router: nenhum arquivo especial usa prefixo "_" — é "layout", não
 *   "_layout". layout.js é o componente mais externo de um route segment e
 *   envolve template.js, error.js, loading.js, not-found.js e page.js.
 * - Pages Router: pages/_document.js (com "_") customiza as tags <html> e
 *   <body> e existe só uma vez, na raiz de pages/. No App Router esse papel
 *   foi assumido pelo root layout.js — não há "_document" equivalente lá.
 */
// export async function getLayouts(meta: Metadata, path: string) {
//   const isDir = existsSync(path) && statSync(path).isDirectory()
//   const fileDir = isDir ? path : dirname(path)

//   const layouts: Page[] = []
//   let currentDir = fileDir

//   while (true) {
//     const layout = findFileByName(meta, currentDir, 'layout')
//     if (layout && meta.pages.has(layout)) {
//       // const mod = meta.pages.get(layout)?.mod
//       const { mod, content } = await parsePage(meta.pages.get(layout)!, meta)
//       if (mod?.default) layouts.push(mod.default)
//     }

//     const parentDir = dirname(currentDir)
//     if (parentDir === currentDir) break

//     currentDir = parentDir
//   }

//   return layouts
// }

export async function getLayouts(meta: Metadata, path: string) {
  const layouts: IRoute[] = []
  const segments = dirname(path).split(/[\\/]/).filter(Boolean)

  for (let i = segments.length; i >= 0; i--) {
    const dir = segments.slice(0, i).join('/')

    const page = meta.layouts.get(dir ? dir +'/_layout' : '_layout') || meta.layouts.get(dir ? dir +'/layout' : 'layout')
    if (!page) continue

    const { mod } = await parsePage(page, meta) // @ts-ignore
    if (mod?.default) {
      page.mod = mod
      layouts.push(page)
    }

  }

  return layouts
}

export async function getMetadata(root: string, dir: string) {
  const meta = { root, dir } as Metadata
  meta.summary = new Map<string, SummaryMetadata>()

  meta.i18n = await getI18n(meta)
  i18n(meta.i18n.fallbackLocale, meta.i18n.locales, meta.i18n.messages, meta.i18n.routes, meta.i18n.routeMap)

  meta.aliases = getAliases(root)
  const fileMap = await getFileMap(meta)
  meta.map = fileMap.map
  meta.violations = fileMap.violations
  meta.assets = Array.from(getAssets(meta))

  await getPages(meta)

  meta.string = `// AUTO-GENERATED FILE - DO NOT EDIT
${meta.routes.map((page, index) => `\nimport Page${index + (page.hasGetProps ? `, { getProps as getProps${index} }` : '')} from '${page.fullFilePath}'`).join('\n')}
${Array.from(meta.layouts.values()).map(layout => `\nimport Layout${layout.importName} from '${layout.fullFilePath}'`).join('\n')}

export const views = [${meta.routes.map((page, index) => `['${page.pattern}',Page${index},${JSJSON(Object.entries(page.params).map(([_,v]) => v))}${page.hasGetProps ? `,getProps${index}` : (page.layouts.length ? ',0': '')}${page.layouts.length ? ',[' + Object.entries(page.layouts).map(([_,v]) => 'Layout'+v.importName) +']' : ''}]`).join(',')}]

export const SRoutes = new Set(${JSJSON([...meta.spages])})


` /// + meta.i18n.string

  // console.error(meta.string)
  // console.log(meta.map.get(`/Users/nicolau/Projects/preact-skeleton/pages/index.tsx`))

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
// //////////////////////////////////////////////////////////////////////////////////////////

// export function sortRoutes(pages: Map<string, IRoute>) {
//   const metas = new Map<string, { score: number, segmentsCount: number }>()

//   for (const [route, page] of pages)
//     metas.set(route, computeRouteMeta(page.pattern))

//   const list = Array.from(pages.values()).sort((a, b) => {
//     const metaA = metas.get(a.fullFilePath)!
//     const metaB = metas.get(b.fullFilePath)!

//     if (metaA.score === metaB.score)
//       return metaB.segmentsCount - metaA.segmentsCount

//     return metaB.score - metaA.score
//   })

//   while (list.length && list.at(-1)?.pattern === '/') {
//     const last = list.pop()
//     last && list.unshift(last)
//   }

//   return list
// }

// function computeRouteMeta(path: string) {
//   const segments = path.split('/').filter(Boolean)

//   let score = 0
//   for (const segment of segments) {
//     if (segment === '*') {
//       continue
//     } else if (segment.startsWith(':')) {
//       score += 1
//     } else {
//       score += 10
//     }
//   }

//   return { score, segmentsCount: segments.length }
// }

// //////////////////////////////////////////////////////////////////////////////////////////
const CATCHALL_NAMES = new Set(['404', 'not-found'])

export function filePathToWouterPattern(filePath: string): {
  pattern: string
  params: Record<string, RouteParam>
} {
  const withoutExt = filePath.replace(EXT_RE, '')

  const normalized =
    withoutExt === 'index'
      ? ''
      : withoutExt.endsWith('/index')
        ? withoutExt.slice(0, -6)
        : withoutExt

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
// //////////////////////////////////////////////////////////////////////////////////////////


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
