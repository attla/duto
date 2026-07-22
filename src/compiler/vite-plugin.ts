// REF: https://github.com/tailwindlabs/tailwindcss/blob/main/packages/%40tailwindcss-vite/src/index.ts

import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

import preact from '@preact/preset-vite'
import tailwind from '@tailwindcss/vite'

import { EXT_RE } from './constants'
import { setAsset, setChunk, setEntry } from './assets'
import { renderPage } from './'
import { removeExports, resolveImport } from './ast'
import { getMetadata } from './meta'

import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  // Plugin,
  UserConfig, ConfigEnv, ResolvedConfig,
  PreviewServer,
  // ViteDevServer,
  EnvironmentOptions,
  PluginOption,
} from 'vite'
import type { Metadata, PluginOptions } from './types'
import { _duto, _root } from './utils'

const VIRTUAL_ID = ':duto'
const RESOLVED_ID = '\0'+ VIRTUAL_ID

export const config = (opts: UserConfig) => {
  opts.logLevel = 'silent'
  opts.plugins = [
    ...(opts.plugins || []),
    preact(),
    tailwind(),
    plugin(),
  ]

  return defineConfig(opts)
}

export default config

let metadata: Metadata
export function meta() {
  return metadata
}

export function plugin(options: PluginOptions = {}): PluginOption[] {
  // let server: ViteDevServer
  let config: ResolvedConfig
  const {
    rootDir = _root, // process.env.npm_config_local_prefix || process.env.PWD || process.cwd() || __dirname,
    pagesDir = 'pages',
  } = options

  // let metadata: Metadata

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

      configurePreviewServer(server: PreviewServer) {
        const distDir = join(server.config.root, 'dist')

        server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => {
          if (req.url && !existsSync(join(distDir, req.url.split('?')[0]))) {
            const notFound = join(distDir, '404.html')

            if (existsSync(notFound)) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'text/html')
                .end(readFileSync(notFound, 'utf-8'))
              return
            }
          }

          next()
        })
      },

    },

    {
      name: 'duto:scan',
      enforce: 'pre',

      // configureServer(_server) {
      //   server = _server
      //   // servers.push(server)
      // },

      async config(conf: UserConfig, env: ConfigEnv) {
        metadata = await getMetadata(rootDir, pagesDir)

        // console.log(metadata.map)
        // console.log(metadata.violations)
        // console.log(Array.from(metadata.violations).filter(file => EXT_RE.test(file)))

        if (conf.build) {
          // conf.build.emptyOutDir = false
          conf.build.copyPublicDir = false
          conf.build.manifest = false
          conf.build.modulePreload = { polyfill: false }

          conf.build.minify = true
          conf.build.cssMinify = true //////

          conf.build.rolldownOptions = conf.build.rolldownOptions || {}
          conf.build.rolldownOptions.preserveEntrySignatures = 'exports-only' ///
          conf.build.rolldownOptions.input = [
            ':duto/client/app.tsx',
            // ':duto/not-found.tsx',
            ...Object.keys(metadata.pages),
            ...metadata.assets,
          ]
          // conf.build.rolldownOptions.input = ':duto/client/app.tsx'
          conf.build.rolldownOptions.output = {
            hoistTransitiveImports: false,
            format: 'esm',
            minifyInternalExports: true,

            // manualChunks: {
            //   vendor: ['preact', '@preact/signals', 'wouter-preact'],
            // },
            // preserveModules: true,
            preserveModulesRoot: '/',
            assetFileNames: '[hash][extname]',
            entryFileNames: '[hash].js',
            chunkFileNames: '[hash].js',

            // chunkFileNames: '[name].[hash].js',
            // entryFileNames: 'assets/[name].js',
            // chunkFileNames: 'assets/chunks/[name]-[hash].js',
            // assetFileNames: 'assets/[name][extname]',
          }
        }

        return conf
      },

      async configResolved(conf) {
        config = conf
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
            'style/tailwindcss.css',
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
          const path = join(_duto, id.replace(VIRTUAL_ID, ''))
          setEntry(id, path)
          return path
        }

        // console.log(id, VIRTUAL_ID, RESOLVED_ID)
        return id.replace(VIRTUAL_ID, RESOLVED_ID)
      },

      async load(id) {
        // if (id !== RESOLVED_ID) return
        if (!id.startsWith(RESOLVED_ID)) return

        if (id.endsWith('/i18n'))
          return metadata.i18n.string

        return metadata.string
      },

      generateBundle(_, bundle) {
        // const moduleIds = this.getModuleIds()
        // for (const id of moduleIds)
        // console.error(id)

        for (const key in bundle) {
          const file = bundle[key]
          if (file.type === 'chunk' && file.isEntry) {
            setChunk(file.facadeModuleId, '/'+ file.fileName)
            continue
          }

          if (file.type === 'asset' && file?.originalFileName?.endsWith('duto/client/app.tsx'))
            file.source += 'd-b,d-p,i-d,i-s,i-i{display:contents}'

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
        for (const [_filePath, page] of metadata.pages) {
          await renderPage(metadata, config, page)
          // const mod = await server.ssrLoadModule(_filePath)
        }

        rmSync(join(metadata.root, 'tmp'), {recursive: true, force: true})
        // await server.close()
      },

      // TODO: precisa ser aqui mesmo pois se a pagina for importada no entry, pode incluir codigo nao usado no chunck/bundle
      async transform(code, id) {
        if (!PAGES_RE.test(id) || id.includes('node_modules')) return null
        // console.log(this.getModuleInfo(id))

        const stripped = removeExports(id, code, stripTarget)
        if (!stripped || stripped === code) return null

        return {
          code: stripped,
          map: null, // source maps omitted for brevity, add if needed
        }
      },

    },
  ]
}
