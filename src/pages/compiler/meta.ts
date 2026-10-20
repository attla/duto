import { extname, join } from 'node:path'

import { getEnv, JSJSON, newID } from 't0n'
import { warn } from 't0n/log'

import { getAliases } from './aliases'
import { DYNAMIC_RE, INTERNAL_RE, LAYOUT_RE, NF_NAMES, FILE_EXTENSIONS, USE_RAW_RE, USE_HTML_RE } from './constants'
import { _pages, scan } from '@/utils'

import { USE_CLIENT_RE } from './constants'
import { filePathToWouterPattern, sortRoutes } from './routes'

import getI18n from '../i18n/server'

import type {
  IRoute,
  Metadata,
  PageModule,
  DutoOptions,
} from './types'

export async function getPages(meta: Metadata) {
  const nf = new Map<string, IRoute>()
  const layouts = new Map<string, IRoute>()
  const loads = new Map<string, IRoute>()
  const pages = new Map<string, IRoute>()
  const routes: IRoute[] = []

  for await (const { path, fullPath, mod, text } of scan(meta.dir, FILE_EXTENSIONS)) {
    const _mod = await mod<PageModule>()
    if (!_mod?.default) {
      warn(`No default export in ${path} — skipped`)
      continue
    }

    const ext = extname(fullPath)
    const filePath = path.split(meta.dir+'/').pop() as string
    const name = filePath.replace(ext, '')
    const { pattern, params } = filePathToWouterPattern(name)

    const fileName = fullPath.replace(ext, '').split('/').pop() as string
    const content = await text()

    const page: IRoute = {
      id: newID(),
      name,
      path: fullPath,
      pattern, // @ts-ignore
      params,
      is404: fileName ? NF_NAMES.includes(fileName) : false,
      isDynamic: DYNAMIC_RE.test(path),
      isInternal: INTERNAL_RE.test(path),

      mod: _mod,
      content: content,
      layouts: [],
      hasLoading: typeof _mod.Loading === 'function',
      hasGetStaticProps: typeof _mod.getStaticProps === 'function',
      hasGetProps: typeof _mod.getProps === 'function',
      useClient: USE_CLIENT_RE.test(content),
      useRaw: USE_RAW_RE.test(content),
      useHtml: USE_HTML_RE.test(content),
    }

    if (LAYOUT_RE.test(path)) {
      layouts.set(name, page)
      continue
    }

    if (page.hasLoading)
      loads.set(name, page)

    if (page.is404) {
      nf.set(name, page)
      routes.push(page)
      pages.set(fullPath, page)
      continue
    }

    if (!page.isInternal)
      pages.set(fullPath, page)

    if (!page.isInternal && !page.useRaw && !page.useHtml)
      routes.push(page)
  }

  meta.nf = nf
  meta.loads = loads
  meta.layouts = layouts
  meta.pages = pages
  meta.routes = await sortRoutes(meta, routes)

  meta.entries = meta.routes.filter(r => !r.is404).map(r => r.path)
  meta.entries.push(meta.entry)
}

export async function getMetadata(conf: DutoOptions) {
  const meta = {
    root: conf.root,
    dir: conf.pagesDir,
    outDir: conf.outDir,
    outPath: join(conf.root, conf.outDir),
    plugins: conf.plugins,
    ...getEnv('duto', {}),

    entry: join(_pages, 'client', 'app.tsx'),
    entries: [] as string[],
    cache: new Map(),
    summary: new Map(),
    aliases: await getAliases(conf.root),
  } as Metadata
  await getPages(meta)
  await getI18n(meta)

  const layoutsArr = Array.from(meta.layouts.values())
  meta.string = `// AUTO-GENERATED FILE - DO NOT EDIT
${meta.routes.filter(r => r.is404).map(r => `\nimport Page${r.id + (r.hasGetProps ? `, { getProps as getProps${r.id} }` : '')} from '${r.path}'`).join('\n')}
${layoutsArr.map(l => `\nimport Layout${l.id} from '${l.path}'`).join('\n')}
${Array.from(meta.loads.values()).map(l => `\nimport { Loading as Loading${l.id} } from '${l.path}'`).join('\n')}

export const views = [${meta.routes.map(r => `[${JSJSON(r.pattern)},${r.is404 ? 'Page' + r.id : `'${r.path}'`},${Object.keys(r.params).length ? JSJSON(Object.entries(r.params).map(([_, v]) => v)) : (r.hasGetProps || r.hasLoading ? '0' : '')}${r.hasGetProps ? (r.is404 ? `,getProps${r.id}` : `,1`) : (r.hasLoading ? ',0' : '')}${r.hasLoading ? `,Loading${r.id}` : ''}]`).join(',')}]

export const layouts = [${layoutsArr.map(l => `{path:'${l.pattern?.replace(/_?(layout)$/i, '')}', view: Layout${l.id}}`).join(',')}]
`

  return meta
}
