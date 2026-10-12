import { existsSync, rmSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'

import tailwind from 'bun-plugin-tailwind'
import { JSJSON } from 't0n'

import { EXT_RE } from './constants'
import { getChunk, setAsset, setChunk, setEntry } from './assets'
import { renderPage } from '.'
import { getImports, removeExports } from './ast'
import { getMetadata } from './meta'
import { _pages, _root } from '@/utils'

import type { BunPlugin, BuildArtifact } from 'bun'
import type { Metadata } from './types'

const VIRTUAL_ID = ':duto'
const NAMESPACE = 'duto'
const APP_ID = ':duto/client/app.tsx'

export type DutoOptions = {
  root: string
  pagesDir: string
  outDir: string
  plugins: BunPlugin[]
}

export const config = (opts: DutoOptions): DutoOptions => {
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

const stripExt = (p: string) => p.slice(0, p.length - extname(p).length)

export async function build(opts: DutoOptions) {
  const conf = config(opts)
  const outPath = join(conf.root, conf.outDir)

  const PAGES_RE = new RegExp(`/${conf.pagesDir}/.*\\.(tsx?|jsx?)$`, 'i')
  const stripTarget = new Set(['getStaticProps'])

  metadata = await getMetadata(conf.root, conf.pagesDir)

  const appEntry = join(_pages, 'client', 'app.tsx')
  setEntry(APP_ID, relative(conf.root, appEntry))

  const routes = metadata.routes.filter(r => !r.is404)
  const entrypoints = [...routes.map(r => r.fullFilePath), appEntry]

  const sources = new Map(entrypoints.map(e => [relative(conf.root, stripExt(e)), e]))

  const prefix = metadata.minify ? '' : '[name].'

  rmSync(outPath, { recursive: true, force: true })
  await mkdir(outPath, { recursive: true })

  const result = await Bun.build({
    entrypoints,
    root: conf.root,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: metadata.minify,
    sourcemap: 'none',
    naming: {
      entry: '[dir]/[name]-[hash6].[ext]', // used to map output to source
      chunk: prefix + '[hash6].[ext]',
      asset: prefix + '[hash6].[ext]',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [
      ...(conf.plugins || []),
      tailwind,
      {
        name: 'duto',
        setup(build) {
          build.onResolve({ filter: /^react(-dom)?(\/|$)/ }, args => {
            const target = REACT_ALIAS[args.path]
            if (!target) return
            return { path: Bun.resolveSync(target, conf.root) }
          })

          build.onResolve({ filter: /^:root/ }, args => {
            for (const f of CSS_CANDIDATES) {
              const path = join(conf.root, f)
              if (existsSync(path)) return { path }
            }
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
            if (args.path.includes('node_modules')) return

            const code = await Bun.file(args.path).text()
            const stripped = removeExports(args.path, code, stripTarget)
            if (!stripped || stripped === code) return

            const ext = extname(args.path).slice(1) as 'ts' | 'tsx' | 'js' | 'jsx'
            return { contents: stripped, loader: ext }
          })
        },
      },
    ],
  })

  if (!result.success)
    throw new AggregateError(result.logs, 'duto: build failed')

  const keyOf = (a: BuildArtifact, fileName: string) => {
    let noExt = stripExt(fileName).replaceAll('_.._', '..')
    if (a.hash) noExt = noExt.replace(new RegExp(`-${a.hash}$`), '')
    return noExt
  }

  const dirs = new Set<string>()
  for (const out of result.outputs) {
    const fileName = out.path.replace(/^\.\//, '').replaceAll('_.._', '..')
    const dest = metadata.minify ? fileName.split('/').at(-1)!.split('-').at(-1)! : fileName.replace('../../packages/duto/src/pages', '')
    const filePath = join(outPath, dest)
    const key = keyOf(out, fileName)
    const owner = sources.get(key)

    const fileDir = dirname(filePath)
    if (fileDir !== outPath && !dirs.has(fileDir)) {
      dirs.add(fileDir)
      await mkdir(fileDir, { recursive: true })
    }

    let content = await out.text()
    if (fileName.endsWith('.css')) {
      if (owner === appEntry) content += 'i-i{display:contents}'
      content = content.replace(/\/\*!\s*tailwindcss[^*]*\*\/\s*/g, '')

      setAsset(relative(conf.root, owner ?? fileName), '/'+ dest)
    } else if (out.kind === 'entry-point' && owner) {
      setChunk(relative(conf.root, owner),'/'+  dest)
      // o lookup original usa o caminho relativo ao root
      // if (owner !== appEntry) setChunk(owner.replace(conf.root, ''), name)
    }

    const imports = getImports(content)
    for (const path of imports) {
      content = content.replaceAll(path, '/'+ path.split('/').at(-1))
    }

    await Bun.write(filePath, content)
  }

  for (const [_filePath, page] of metadata.pages)
    await renderPage(metadata, conf, page)

  rmSync(join(conf.root, 'tmp'), { recursive: true, force: true })

  if (existsSync(join(conf.root, 'public')))
    await cp(join(conf.root, 'public'), outPath, { recursive: true, force: true })

  const entryPath = join(outPath, getChunk(APP_ID))
  const entry = Bun.file(entryPath)

  if (await entry.exists()) {
    let entryContent = await entry.text()

    for (const r of routes) {
      const rPath = getChunk(r.fullFilePath.replace(conf.root, ''))

      if (r.props) {
        const rFilePath = join(outPath, rPath)
        const rText = await Bun.file(rFilePath).text()
        await Bun.write(rFilePath, `export const props=${JSJSON(r.props)};${rText}`)
      }

      entryContent = entryContent.replace(r.fullFilePath, rPath)
    }

    await Bun.write(entryPath, entryContent)
  }

  // i18n
  for (const locale of metadata.i18n.locales) {
    const intlPath = join(conf.root, 'i18n', locale + '.ts')
    if (!existsSync(intlPath)) continue

    const intlMod = await import(intlPath)
    await Bun.write(
      join(outPath, locale + '.js'),
      `var a=${JSJSON({
        routes: intlMod.routes ?? intlMod.default?.routes,
        messages: intlMod.messages ?? intlMod.default?.messages,
      })};export{a as default}`,
    )
  }

  return result
}

export default config
