// REF: https://github.com/tailwindlabs/tailwindcss/blob/main/packages/%40tailwindcss-vite/src/index.ts

import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

import preact from '@preact/preset-vite'
import tailwind from '@tailwindcss/vite'
import { JSJSON } from 't0n'

import { EXT_RE } from './constants'
import { getChunk, setAsset, setChunk, setEntry } from './assets'
import { renderPage } from '.'
import { removeExports, resolveImport } from './ast'
import { getMetadata } from './meta'

import type {
  UserConfig, ConfigEnv, ResolvedConfig,
  // PreviewServer,
  // ViteDevServer,
  EnvironmentOptions,
  PluginOption,
} from 'vite'
import type { Metadata, PluginOptions } from './types'
import { _pages, _root } from '@/utils'

const VIRTUAL_ID = ':duto'
const RESOLVED_ID = '\0'+ VIRTUAL_ID

export const config = (opts: UserConfig & PluginOptions) => { // @ts-ignore
  if (!opts.root) opts.root = _root
  if (!opts.pagesDir) opts.pagesDir = 'pages',

  opts.logLevel = 'silent'
  opts.plugins = [
    ...(opts.plugins || []),
    preact(),
    tailwind(),
    plugin(opts),
  ]

  return defineConfig(opts)
}

// TODO: remover..
export default config

let metadata: Metadata
export function meta() {
  return metadata
}

export function plugin(options: PluginOptions = {}): PluginOption[] {
  let config: ResolvedConfig
  const {
    root = _root,
    pagesDir = 'pages',
  } = options

  const PAGES_RE = new RegExp(`\/${pagesDir}\/.*\.(tsx?|jsx?)$`, 'i')
  const stripTarget = new Set(['getStaticProps'])

  return [
    {
      name: 'duto:preact-environment',

      configEnvironment(name, options) {
        const opts: EnvironmentOptions = {optimizeDeps: {}, resolve: {}}

        if (name === 'client') {
          opts.optimizeDeps!.include = [
            'preact',
            'preact/jsx-runtime',
          ]
        }

        opts.resolve = {dedupe: ['preact/compat', 'preact']}

        if (name === 'client')
          opts.optimizeDeps!.include!.push(
            'preact/compat',
            // 'preact/test-utils',
            'preact/compat/jsx-runtime',
          )

        if (
          !options.resolve?.noExternal &&
          (name === 'ssr' || name === 'prerender')
        ) {
          // noExternal React entrypoints to be bundled, resolved, and aliased by Vite
          opts.resolve!.noExternal = [
            'react',
            'react-dom',
            'react-dom/test-utils',
            'react/jsx-runtime',
          ]
        }

        return opts
      },
    },

    {
      name: 'duto:scan',
      enforce: 'pre',

      async config(conf: UserConfig, env: ConfigEnv) {
        metadata = await getMetadata(root as string, pagesDir)

        if (conf.build) {
          // conf.build.emptyOutDir = false
          conf.build.copyPublicDir = false
          conf.build.manifest = false
          conf.build.modulePreload = { polyfill: false }

          conf.build.minify = metadata.minify
          conf.build.cssMinify = metadata.minify

          conf.build.rolldownOptions = conf.build.rolldownOptions || {}
          conf.build.rolldownOptions.preserveEntrySignatures = 'exports-only' ///
          conf.build.rolldownOptions.input = [
            ...metadata.routes.map(r => r.is404 ? '' : r.fullFilePath).filter(Boolean),
            ':duto/client/app.tsx',
            // ':duto/not-found.tsx',
            // ...Object.keys(metadata.pages),
            // ...metadata.assets,
          ]

          const filePrefix = metadata.minify ? '' : '[name].'
          // conf.build.rolldownOptions.input = ':duto/client/app.tsx'
          conf.build.rolldownOptions.output = {
            hoistTransitiveImports: false,
            format: 'esm',
            minifyInternalExports: metadata.minify,
            preserveModulesRoot: '/',
            assetFileNames: filePrefix +'[hash][extname]',
            entryFileNames: filePrefix +'[hash].js',
            chunkFileNames: filePrefix +'[hash].js',

            // chunkFileNames: '[name].[hash].js',
            // entryFileNames: 'assets/[name].js',
            // chunkFileNames: 'assets/chunks/[name]-[hash].js',
            // assetFileNames: 'assets/[name][extname]',

            // manualChunks: {
            //   vendor: ['preact', '@preact/signals', 'wouter-preact'],
            // },
            // preserveModules: true,
          }
        }

        return conf
      },

      async configResolved(c) {
        config = c
      },

      resolveId(id) {
        if (id === VIRTUAL_ID) return RESOLVED_ID

        if (id.startsWith(':root')) {
          for (const f of [
            'style.css',
            'styles.css',
            'styles/index.css',
            'style/index.css',
            'tailwind.css',
            'tailwindcss.css',
            'styles/tailwind.css',
            'styles/tailwindcss.css',
          ]) {
            const path = join(config.root, f)
            if (existsSync(path)) {
              setEntry(id, path)
              return path
            }
          }

          return null
        }

        if (!id.startsWith(VIRTUAL_ID)) return null

        if (EXT_RE.test(id) && id.includes('/')) {
          const path = join(_pages, id.replace(VIRTUAL_ID, ''))
          setEntry(id, path)
          return path
        }

        if (id.endsWith('/hmr') && metadata.hmr)
          return join(_pages, 'client', id.replace(VIRTUAL_ID, '') + '.ts')

        return id.replace(VIRTUAL_ID, RESOLVED_ID)
      },

      async load(id) {
        if (!id.startsWith(RESOLVED_ID)) return

        if (id.endsWith('/i18n'))
          return metadata.i18n.string

        return metadata.string
      },

      generateBundle(_, bundle) {
        // const moduleIds = this.getModuleIds()
        // for (const id of moduleIds)
        // console.error(id)

        // TODO: rever isso...
        for (const key in bundle) {
          const file = bundle[key]

          if (file.type === 'chunk' && file.isEntry) {
            setChunk(file.facadeModuleId, '/'+ file.fileName)
            continue
          }

          if (file.type === 'asset' && file?.originalFileName?.endsWith('duto/pages/client/app.tsx'))
            file.source += 'i-i{display:contents}'
            // file.source += 'd-b,d-p,i-d,i-s,i-i{display:contents}'

          if (file.type === 'asset' && file.fileName.endsWith('.css')) {
            setAsset(resolveImport(file.originalFileName as string, metadata.root, metadata.aliases), '/'+ file.fileName)
            continue
          }

          // console.error(file.fileName)
          // console.error(file.type)
          // console.error(file.viteMetadata)
          // if (file.type !== 'chunk' || !file.isEntry) continue
        }
      },

    },

    // {
    //   name: 'duto:routes-inject',
    //   enforce: 'post',
    //   generateBundle(_, bundle) {
    //     // monta o mapa a partir dos inputs de metadata.routes
    //     const routeMap: Record<string, string> = {}
    //     for (const r of metadata.routes) {
    //       if (r.is404) continue
    //       // encontra o chunk cujo facadeModuleId bate com r.fullFilePath
    //       for (const [fileName, chunk] of Object.entries(bundle)) {
    //         if (chunk.type === 'chunk' && chunk.facadeModuleId === r.fullFilePath) {
    //           routeMap[r.path] = fileName
    //           break
    //         }
    //       }
    //     }

    //     // injeta no chunk do app
    //     for (const chunk of Object.values(bundle)) {
    //       if (chunk.type !== 'chunk') continue
    //       if (chunk.facadeModuleId?.includes('app.tsx') || chunk.code.includes('__DUTO_ROUTES__')) {
    //         chunk.code = chunk.code.replace(
    //           '__DUTO_ROUTES__',
    //           JSON.stringify(routeMap)
    //         )
    //       }
    //     }
    //   }
    // },
    {
      name: 'duto:build',
      enforce: 'pre',
      apply: 'build',

      async buildStart() {
        // if (!server) {
        //   const { createServer } = await import('vite')
        //   server = await createServer({ server: {middlewareMode: true} })
        // }


        // teste de import de assets
      //   for (const file of metadata.assets) {
      //   const id = await this.resolve(file)
      //   if (!id) continue

      //   console.error(id)
      //   console.error(relative(metadata.root, file).replace(/\.(ts|tsx)$/, '.js'),)

      //   this.emitFile({
      //     type: 'chunk',
      //     id: id.id,
      //     implicitlyLoadedAfterOneOf: [
      //       ':duto/app.tsx',
      //     ]
      //     // fileName: 'assets/[name]-[hash][extname]',
      //     // fileName: relative(metadata.root, file).replace(/\.(ts|tsx)$/, '.js'),
      //   })
      // }

      },

      async closeBundle() {
        for (const [_filePath, page] of metadata.pages)
          await renderPage(metadata, config, page)
          // const mod = await server.ssrLoadModule(_filePath)

        rmSync(join(metadata.root, 'tmp'), {recursive: true, force: true})
        // await server.close()

        const outPath = join(config.root, config.build.outDir)
        const entry = Bun.file(join(outPath, getChunk(':duto/client/app.tsx')))
        let entryContent = await entry.text()

        for (const r of metadata.routes.filter(r => !r.is404))
          entryContent = entryContent.replace(r.fullFilePath, getChunk(r.fullFilePath.replace(config.root, '')))

        await entry.write(entryContent)

        // i18n
        for (const locale of metadata.i18n.locales) {
          const intlPath = join(metadata.root, 'i18n', locale + '.ts')
          if (existsSync(intlPath)) {
            const intlMod = await import(intlPath)
            await Bun.write(
              join(outPath, locale +'.js'),
              `var a=${JSJSON({
                routes: intlMod.routes ?? intlMod.default?.routes,
                messages: intlMod.messages ?? intlMod.default?.messages,
              })};export { a as default }`
            )
          }
        }
      },

      // TODO: precisa ser aqui mesmo pois se a pagina for importada no entry, pode incluir codigo nao usado no chunck/bundle
      async transform(code, id) {
        if (!PAGES_RE.test(id) || id.includes('node_modules')) return null
        // console.log(this.getModuleInfo(id))

        const stripped = removeExports(id, code, stripTarget)

        return (!stripped || stripped === code) ? null : { code: stripped, map: null }
      },

    },
  ]
}
