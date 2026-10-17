import { existsSync, rmSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path'

import tailwind from 'bun-plugin-tailwind'
import { IMPORT, JSJSON } from 't0n'
import { watch, type EventBatch } from 't0n/cli'

import { EXT_RE } from './constants'
import { getChunk, setAsset, setChunk, setEntry } from './assets'
import { renderPage } from '.'
import { getImports, removeExports } from './ast'
import { getMetadata, getPages } from './meta'
import { _pages, _root, scan } from '@/utils'

import type { BunPlugin } from 'bun'
import type { DutoOptions, IRoute, Metadata } from './types'
import { reload } from '#/cli/utils'
import { resolveExtension } from './file'

import getI18n from '#/i18n/server'

const VIRTUAL_ID = ':duto'
const NAMESPACE = 'duto'
const APP_ID = ':duto/client/app.tsx'

export type Change = {
  path: string // absoluto
  deleted?: boolean
}

export const config = (opts: DutoOptions) => {
  opts.root ||= _root
  opts.pagesDir ||= 'pages'
  opts.outDir ||= 'dist'
  opts.plugins = [...(opts.plugins || [])]
  return opts
}

let metadata: Metadata

export function meta() {
  return metadata
}

const CSS_CANDIDATES = [
  'style.css',
  'styles.css',
  'styles/index.css',
  'style/index.css',
  'tailwind.css',
  'tailwindcss.css',
  'styles/tailwind.css',
  'styles/tailwindcss.css',
]

const REACT_ALIAS: Record<string, string> = {
  'react': 'preact/compat',
  'react-dom': 'preact/compat',
  'react-dom/client': 'preact/compat/client',
  'react-dom/test-utils': 'preact/test-utils',
  'react/jsx-runtime': 'preact/jsx-runtime',
  'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
}

const CSS_SUFFIX = 'i-i{display:contents}'
const STRIP_TARGET = new Set(['getStaticProps'])
const CSS_BANNER_RE = /\/\*!\s*tailwindcss[^*]*\*\/\s*/g
let ROOT_CSS = ''

const baseKey = (p: string) => '/'+ p.replace(/^\/+/, '')
const isInside = (file: string, dir: string) => file === dir || file.startsWith(dir +'/')
const routesOf = () => metadata.routes.filter(r => !r.is404)
const findRootCss = () => CSS_CANDIDATES.map(f => join(metadata.root, f)).find(existsSync) as string

let plugins: BunPlugin[]
let PAGES_RE: RegExp
function createPlugins(): BunPlugin[] {
  return [
    ...(metadata.plugins || []),
    tailwind,
    {
      name: 'duto',
      setup(build) {
        build.onResolve({ filter: /^react(-dom)?(\/|$)/ }, args => {
          const target = REACT_ALIAS[args.path]
          if (!target) return
          return { path: Bun.resolveSync(target, metadata.root) }
        })

        build.onResolve({ filter: /^\/(?!\/)/ }, args => {
          const fromCss = args.kind === 'url-token' || args.importer?.endsWith('.css')
          if (!fromCss || (existsSync(args.path) && !existsSync(join(metadata.root, 'public', args.path)))) return

          return { path: args.path, external: true }
        })

        build.onResolve({ filter: /^:root/ }, args => {
          const id = args.path
          let path: string | undefined | null = ''
          if (id === ':root/css')
            path = ROOT_CSS
          else if (id.includes('/'))
            path = resolveExtension(join(metadata.root, id.replace(':root', '')))

          if (!path) return
          return { path }
        })

        build.onResolve({ filter: /^:duto/ }, args => {
          const id = args.path

          if (EXT_RE.test(id) && id.includes('/')) {
            const path = join(_pages, id.replace(VIRTUAL_ID, ''))
            return { path }
          }

          if (id.endsWith('/hmr') && metadata.hmr)
            return { path: join(_pages, 'client', id.replace(VIRTUAL_ID, '') + '.ts') }

          return { path: id, namespace: NAMESPACE }
        })

        build.onLoad({ filter: /.*/, namespace: NAMESPACE }, args => ({
          contents: args.path.endsWith('/i18n') ? metadata.i18n.string : metadata.string,
          loader: 'ts',
        }))

        build.onLoad({ filter: PAGES_RE }, async args => {
          if (args.path.includes('node_modules') || !args.path.includes(metadata.root)) return

          const page = metadata.pages.get(args.path)!
          if (!page || page?.isInternal || page?.is404) return
          const code = page?.content
          const stripped = removeExports(args.path, code, STRIP_TARGET)
          if (!stripped || stripped === code) return

          return { contents: stripped, loader: extname(args.path).slice(1) as 'ts' | 'tsx' | 'js' | 'jsx' }
        })
      },
    },
  ]
}


function inCssChain(file: string) {
  if (file === ROOT_CSS) return true

  const seen = new Set([file])
  const queue = [file]

  while (queue.length) {
    const cur = queue.pop()!
    if (cur === ROOT_CSS) return true

    for (const parent of metadata.reverseGraph.get(cur) ?? []) {
      if (!parent.endsWith('.css') || seen.has(parent)) continue
      seen.add(parent)
      queue.push(parent)
    }
  }

  return false
}

async function compile(entrypoints: string[]) {
  const outPath = join(metadata.root, metadata.outDir)
  const filePattern = '[dir]/[name]-[hash6].[ext]' // used to map output to source

  const result = await Bun.build({
    entrypoints,
    root: metadata.root,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: metadata.minify,
    sourcemap: 'none',
    metafile: true,
    naming: {
      entry: filePattern,
      chunk: filePattern,
      asset: (metadata.minify ? '' : '[name].') + '[hash6].[ext]',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    plugins,
  })

  if (!result.success)
    throw new AggregateError(result.logs, 'duto: build failed')

  const dirs = new Set<string>()
  for (const out of result.outputs) {
    const meta = result.metafile!.outputs[out.path]!
    const fileName = (meta.entryPoint || Object.keys(meta.inputs)?.at(-1) || out.path).replace(/^\.\//, '').replaceAll('_.._', '..')
    const dest = metadata.minify ? out.hash! + extname(out.path) : fileName.replace('../../packages/duto/src/pages', '')
    const filePath = join(outPath, dest)

    const fileDir = dirname(filePath)
    if (fileDir !== outPath && !dirs.has(fileDir)) {
      dirs.add(fileDir)
      await mkdir(fileDir, { recursive: true })
    }

    let content = await out.text()
    const isCss = out.path.endsWith('.css')
    if (isCss) {
      if (fileName === relative(metadata.root, metadata.entry)) {
        content += CSS_SUFFIX
        metadata.css = { dest, href: '/'+ dest }
      }
      content = content.replace(CSS_BANNER_RE, '')

      setAsset(fileName, '/'+ dest)
    } else if (out.kind === 'entry-point') {
      setChunk(fileName, '/'+ dest)
    }

    if (!isCss) {
      const imports = getImports(content)
      for (const path of imports) {
        content = content.replaceAll(path, '/'+ path.split('/').at(-1)!.split('-').at(-1)!)
      }
    }

    await Bun.write(filePath, content)
    metadata.cache.set('/'+ dest, content)
    if (isCss) continue
  }

  return result
}

async function patchHtml(from: string, to: string) {
  for await (const { file } of scan('', 'html', undefined, metadata.outPath)) {
    const _file = file()
    const text = await _file.text()
    if (text.includes(from)) await _file.write(text.replaceAll(from, to))
  }
}

async function refreshCss() {
  const prefix = metadata.minify ? '' : '[name].'

  const result = await Bun.build({
    entrypoints: [ROOT_CSS = findRootCss()],
    root: metadata.root,
    target: 'browser',
    minify: metadata.minify,
    sourcemap: 'none',
    naming: {
      entry: prefix + '[hash6].[ext]',
      asset: prefix + '[hash6].[ext]',
    },
    plugins,
  })

  if (!result.success)
    throw new AggregateError(result.logs, 'duto: css build failed')

  let dest = ''
  for (const out of result.outputs) {
    const name = basename(out.path)
    const path = join(metadata.outPath, name)
      // console.error('out.path:', out.path)
      // console.error('join(outPath, name):', path)
      // console.log('x'.repeat(40))

    if (out.path.endsWith('.css')) {
      dest = name
      const content = (await out.text()).replace(CSS_BANNER_RE, '') + CSS_SUFFIX
      await Bun.write(path, content)
    } else {
      await Bun.write(path, out) // ??????
    }
  }

  const prev = metadata.css
  if (!dest || prev?.dest === dest) return

  const href = '/'+ dest
  setAsset(relative(metadata.root, metadata.entry), href)
  metadata.css = { dest, href }

  if (!prev) return

  await patchHtml(prev.href, href)
  await rm(join(metadata.outPath, prev.dest), { force: true })
}

async function writeProps(r: IRoute, dest?: string) {
  if (!r.props) return
  dest ??= getChunk(r.fullFilePath.replace(metadata.root, ''))
  const base = metadata.cache.get(dest)
  if (!base) return

  const content = `export const props=${JSJSON(r.props)};${base}`

  await Bun.write(join(metadata.root, metadata.outDir, dest), content)
}

async function patchApp() {
  const dest = getChunk(APP_ID)
  let content = metadata.cache.get(baseKey(dest))

  if (!content) return

  const seen = new Set<string>()
  for (const r of routesOf()) {
    const rDest = getChunk(r.fullFilePath.replace(metadata.root, ''))
    seen.add(rDest)
    writeProps(r, rDest)
    content = content.replace(r.fullFilePath, rDest)
  }
  await Bun.write(join(metadata.root, metadata.outDir, dest), content)
}

async function writeI18n(locale?: string) {
  if (!locale) {
    for (const locale of metadata.i18n.locales)
      await writeI18n(locale)

    return
  }

  const path = join(metadata.root, 'i18n', locale +'.ts')
  if (!existsSync(path)) return

  const mod = await IMPORT<any>(path)
  await Bun.write(
    join(metadata.root, metadata.outDir, locale +'.js'),
    `var a=${JSJSON({
      routes: mod.routes ?? mod.default?.routes,
      messages: mod.messages ?? mod.default?.messages,
    })};export{a as default}`,
  )
}

async function syncPublic(path: string, deleted?: boolean) {
  const dest = join(metadata.root, metadata.outDir, relative(join(metadata.root, 'public'), path))
  if (deleted)
    return rm(dest, { recursive: true, force: true })

  await mkdir(dirname(dest), { recursive: true })
  await cp(path, dest, { recursive: true, force: true })
}

export async function build(opts: DutoOptions) {
  const conf = config(opts)
  const outPath = join(conf.root, conf.outDir)

  // init shared vars
  metadata = await getMetadata(conf)
  PAGES_RE = new RegExp(`/${conf.pagesDir}/.*\\.(tsx?|jsx?)$`, 'i')
  plugins = createPlugins()
  ROOT_CSS = findRootCss()

  setEntry(APP_ID, relative(conf.root, metadata.entry))

  rmSync(outPath, { recursive: true, force: true })
  await mkdir(outPath, { recursive: true })

  const result = await compile(metadata.entries)

  for (const [_filePath, page] of metadata.pages)
    await renderPage(metadata, page)

  rmSync(join(conf.root, 'tmp'), { recursive: true, force: true })

  if (existsSync(join(conf.root, 'public')))
    await cp(join(conf.root, 'public'), outPath, { recursive: true, force: true })

  await patchApp()
  await writeI18n()

  return result
}

export async function rebuild(opts: DutoOptions, changes: EventBatch) {
  if (!metadata) return build(opts)

  let i = 0
  for (const [event, path] of changes) {
    const deleted = event.startsWith('unlink')

    if (isInside(path, 'public')) {
      await syncPublic(path, deleted)
      i++
      continue
    }

    if (
      (!ROOT_CSS && CSS_CANDIDATES.some(c => path.endsWith(c)))
      || (ROOT_CSS && path.endsWith('.css') && !deleted && inCssChain(path))
    ) {
      await refreshCss()
      i++
      continue
    }
  }

  if (i === changes.length) return

  await getI18n(metadata)
  await getPages(metadata)

  await compile(metadata.entries)

  for (const [_filePath, page] of metadata.pages)
    await renderPage(metadata, page)

  await writeI18n()
  await patchApp()
}

const IGNORE_REGEX = new RegExp(
  [
    // node_modules, except selected packages
    String.raw`(?:^|[\\/])node_modules[\\/](?!(?:duto|cripta|t0n)(?:[\\/]|$))[^\\/]+`,
    // Dot-directories
    String.raw`(?:^|[\\/])\.(?:duto|git|cache|vscode|idea|next|nuxt|nyc_output)(?:[\\/]|$)`,
    // Build and temporary directories
    String.raw`(?:^|[\\/])(?:tmp|dist|build|out|coverage)(?:[\\/]|$)`,
    // Temporary files, logs and metadata
    String.raw`(?:^|[\\/])[^\\/]*\.(?:DS_Store|localized|tmp|temp|log|pid|swp|swo)$`,
    String.raw`(?:^|[\\/])(?:Thumbs\.db|desktop\.ini)$`,
    String.raw`~$`,
    // macOS metadata directories
    String.raw`(?:^|[\\/])(?:\.Spotlight-V100|\.Trashes|__MACOSX)(?:[\\/]|$)`,
  ].join('|'),
)

export async function watchBuild(conf: DutoOptions) {
  return watch(
    async (batch) => {
      await rebuild(conf, batch)
      reload()
    },
    '.',
    conf.root,
    (p: string) => IGNORE_REGEX.test(isAbsolute(p) ? relative(conf.root, p) : p),
  )
}

export default config
