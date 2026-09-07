import ts from 'typescript'
import { Miniflare } from 'miniflare'
import { mkdirSync, existsSync, statSync, readdirSync, rmSync, unlinkSync, copyFileSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, dirname, join } from 'pathe'
import { createHash, createHmac } from 'node:crypto'
import { filesize } from 'filesize'

import { findWranglerConfig, parseWranglerConfig, WRANGLER_CONFIG_FILES } from 'localflare-core'
import type { WranglerConfig, LocalflareManifest } from 'localflare-core'

import { gray, bold, italic, purple, yellow, red } from 't0n/color'
import { substep, event, error, warn } from 't0n/log'

import { cacheRoutes } from '$/routes'
import { _duto, _root } from '@/utils'

import type { Platform } from './types'

export const platforms = [
  'aws', 'lambda',
  'cf', 'cloudflare', 'worker', 'workers', 'workerd',
  'node', 'bun',
  'vercel',
] as const

export function normalizePlatform(platform: Platform) {
  platform = platform?.toLowerCase() as Platform
  if (!platforms?.includes(platform)) return null

  switch (platform) {
    case 'lambda':
      return 'aws'

    case 'cf':
    case 'cloudflare':
    case 'worker':
    case 'workers':
      return 'workerd'

    case 'bun':
      return 'node'

    default:
      return platform
  }
}

const formatArgs = (...args: any[]) => args.flat().map(a => gray(italic(bold(a)))).join(', ')
export const platformError = () => error(`Provide a valid platform: ${formatArgs(platforms)}.\n`)

const nodeModules = [
  'crypto', 'buffer', 'http', 'fs', 'path', 'events', 'stream', 'util',
  'url', 'querystring', 'os', 'child_process', 'cluster', 'dns', 'net',
  'tls', 'https', 'zlib', 'readline', 'repl', 'vm', 'module', 'assert',
  'timers', 'string_decoder', 'punycode', 'perf_hooks', 'dgram', 'tty',
  'worker_threads', 'wasi', 'process', 'diagnostics_channel', 'sqlite',
  'async_hooks', 'console', 'fsevents',
].flatMap(lib => ['node:'+ lib, lib])

const printer = ts.createPrinter()
function stripDecorators(source: string) {
  const sourceFile = ts.createSourceFile(
    'tmp.ts', source, ts.ScriptTarget.ESNext, false
  )

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isClassDeclaration(node) && node.modifiers?.length) {
        let hasDecorator = false
        const modifiers = []

        for (const m of node.modifiers) {
          if (m.kind === ts.SyntaxKind.Decorator) {
            hasDecorator = true
            continue
          }
          modifiers.push(m)
        }

        if (hasDecorator) {
          return ts.factory.updateClassDeclaration(
            node,
            modifiers.length ? modifiers : undefined,
            node.name,
            node.typeParameters,
            node.heritageClauses,
            node.members
          )
        }
      }

      return ts.visitEachChild(node, visit, context)
    }

    return (node) => ts.visitNode(node, visit) as ts.SourceFile
  }

  const result = ts.transform(sourceFile, [transformer])
  const code = printer.printFile(result.transformed[0])

  result.dispose()
  return code
}

const dist = '.duto'
export const build = async ({
  env = 'prd',
  platform,
  silent = false,
  minify = true,
}: {
  env: string,
  platform: Platform,
  silent: boolean,
  minify: boolean,
}) => {
  const startTime = performance.now()
  const isWorkerd = platform === 'workerd'
  cleanDir(join(_root, dist))

  if (isWorkerd) {
    for (let file of WRANGLER_CONFIG_FILES) {
      file = join(_root, file)
      if (existsSync(file))
        copyFileSync(file, join(_root, dist, basename(file)))
    }
  }

  if (['bun', 'vercel'].includes(platform)) platform = 'workerd'

  const outdir = join(_root, dist)

  const USE_STRICT_RE = /(["'`])\s*use strict\s*\1;?/g

  await cacheRoutes()
  if (!silent) event('Routes cached')

  const result = await Bun.build({
    entrypoints: [join(_duto, 'server', 'adapter', `${platform}.ts`)],
    outdir,
    format: 'esm',
    target: 'bun',
    conditions: isWorkerd ? ['worker', 'browser'] : [],
    minify: !!minify,
    // minify: {
    //   whitespace: true,
    //   syntax: true,
    //   identifiers: true,
    // },

    treeShaking: true,
    legalComments: 'none',
    metafile: false,
    external: [
      '@aws-sdk', '@smithy',
      ...(isWorkerd ? [
        'cloudflare:workers',
        ...nodeModules,
      ] : []),
    ],

    define: {
      'process.env.DUTO_ENV': JSON.stringify(env),
    },

    plugins: [
      {
        name: 'duto',
        setup(build) {
          build.onResolve({ filter: /\.duto[\/\\]/ }, args => ({ path: join(_root, args.path) }))
          build.onLoad({ filter: /\.ts$/ }, async (args) => {
            return { contents: stripDecorators(await Bun.file(args.path).text()), loader: 'ts' }
          })
        },
      },
    ],
  })

  if (!result.success || !result?.outputs?.length)
    throw new Error('build fail')

  const output = result.outputs.find(file => file.kind === 'entry-point' && file.path.endsWith('.js'))
  if (!output)
    throw new Error('Build output not found')

  let code = (await output.text()).replace(/\/\/\s*@bun\s*\n/g, '')

  if (USE_STRICT_RE.test(code)) {
    code = code.replace(USE_STRICT_RE, '')
    await Bun.write(output.path, code)
  }

  const outfile = join(outdir, 'index.js')
  if (output.path !== outfile) {
    await Bun.write(outfile, code)

    if (existsSync(output.path))
      await Bun.file(output.path).delete()
  }

  if (!silent) {
    event(`Build done in ${Math.ceil(performance.now() - startTime)}ms`)
    substep(
      // `${relative(join(_root, 'node_modules/duto/src'), opts.entryPoints[0])} → ${relative(_root, opts.outfile)}`,
      `Size: ${filesize((await stat(outfile)).size)}`,
      `Files: ${Object.keys(result.outputs).length}`
    )
  }
}

export function cleanDir(path: string) {
  try {
    if (!existsSync(path))
      return mkdirSync(path, {recursive: true})

    const files = readdirSync(path)

    for (const file of files) {
      const filePath = join(path, file)
      const stat = statSync(filePath)

      stat.isDirectory()
        ? rmSync(filePath, {recursive: true, force: true})
        : unlinkSync(filePath)
    }
  } catch {}
}

function durableObjectNamespace(name: string, uniqueKey: string) {
  const key = createHash('sha256').update(uniqueKey).digest()
  const nameHmac = createHmac('sha256', key).update(name).digest().subarray(0, 16)
  return Buffer.concat([
    nameHmac,
    createHmac('sha256', key).update(nameHmac).digest().subarray(0, 16)
  ]).toString('hex')
}

export function cleanDB(key: string, config?: WranglerConfig) {
  config ??= wranglerConfig()
  if (!config?.d1_databases) return
  for (const db of config.d1_databases) {
    if (key === db.database_name || key === db.binding) {
      const ns = 'miniflare-D1DatabaseObject'
      const fileName = join(ns, durableObjectNamespace(db.preview_database_id || db.database_id || db.binding, ns) +'.sqlite')

      for (const file of [
        fileName,
        fileName +'-shm',
        fileName +'-wal',
      ]) {
        const filePath = join(d1Path, file)
        if (existsSync(filePath))
          unlinkSync(filePath)
      }
    }
  }
}

export function wranglerConfig(file: string | null = null) {
  file ??= findWranglerConfig(_root)
  if (!file) {
    error('Could not find wrangler config file')
    error('Looking for: '+ formatArgs(WRANGLER_CONFIG_FILES))
    process.exit(1)
  }

  try {
    return parseWranglerConfig(file)
  } catch (e) {
    warn(`Could not parse '${file}', using defaults`)
    return {}
  }
}

export function localflareManifest(opts: WranglerConfig): LocalflareManifest {
  return {
    name: opts.name || 'worker',
    d1: (opts.d1_databases || []).map((db) => ({
      binding: db.binding,
      database_name: db.database_name,
    })),
    kv: (opts.kv_namespaces || []).map((kv) => ({
      binding: kv.binding,
    })),
    r2: (opts.r2_buckets || []).map((r2) => ({
      binding: r2.binding,
      bucket_name: r2.bucket_name,
    })),
    queues: {
      producers: (opts.queues?.producers || []).map((p) => ({
        binding: p.binding,
        queue: p.queue,
      })),
      consumers: (opts.queues?.consumers || []).map((c) => ({
        queue: c.queue,
        max_batch_size: c.max_batch_size,
        max_batch_timeout: c.max_batch_timeout,
        max_retries: c.max_retries,
        dead_letter_queue: c.dead_letter_queue,
      })),
    },
    do: (opts.durable_objects?.bindings || []).map((d) => ({
      binding: d.name,
      className: d.class_name,
    })),
    vars: Object.entries(opts.vars || {}).map(([key, value]) => ({
      key,
      value,
      isSecret: false,
      // isSecret: looksLikeSecret(key, value),
    })),
  }
}

const wranglerPath = '.wrangler/state/v3'
export const kvPath = join(_root, wranglerPath, 'kv')
export const d1Path = join(_root, wranglerPath, 'd1')
export const r2Path = join(_root, wranglerPath, 'r2')
export const doPath = join(_root, wranglerPath, 'durable_objects')

export function createMiniflare(opts = {}) {
  const entry = join(_root, opts?.main || opts?.script)
  return new Miniflare({
    host: opts.host || 'localhost',
    port: opts.port || 8787,
    https: opts.https || false,
    httpsKey: opts.httpsKey,
    httpsCert: opts.httpsCert,
    liveReload: opts.liveReload !== false,
    updateCheck: false,
    scriptPath: entry,
    modules: [
      {type: 'ESModule', path: entry},
    ],
    compatibilityDate: opts.compatibility_date || '2024-11-01',
    compatibilityFlags: opts.compatibility_flags || [
      'nodejs_compat',
    ],
    bindings: {
      ...opts.vars,
    },

    d1Databases: Array.isArray(opts.d1_databases) ? Object.fromEntries(opts.d1_databases.map(db => [db.binding, db.database_id])) : {},
    kvNamespaces: Object.fromEntries((opts.kv_namespaces || []).map(ns => [ns.binding, ns.id])),
    // r2Buckets: Object.fromEntries((opts.r2_buckets || []).map(r2 => [r2.binding, r2.bucket_name])),
    // durableObjects: Object.fromEntries((opts.durable_objects?.bindings || []).map(do => [do.name, do.class_name])),

    kvPersist: kvPath,
    cachePersist: join(_root, wranglerPath, 'cache'),
    d1Persist: d1Path,
    r2Persist: r2Path,
    durablesPersist: doPath,

    verbose: false,

    // Logging
    // log: new console.Console({
    //   stdout: process.stdout,
    //   stderr: process.stderr,
    //   inspectOptions: { depth: 3 }
    // }),

    cfFetch: false, // disable cf requests
    upstream: opts.upstream || 'https://example.com',

    sitePath: opts.site?.bucket ?
      join(_root, opts.site.bucket) : undefined,
    siteInclude: opts.site?.include || ['**/*'],
    siteExclude: opts.site?.exclude || [],

    globalAsyncIO: true,
    globalTimers: true,
    globalRandom: true,

    inspectorPort: opts.inspectorPort || 9229,

    cache: true,
    cacheWarnUsage: true,
  })
}

export async function wait(ms: number) {
	return new Promise(r => setTimeout(r, ms))
}

export function getDockerHost() {
	const platform = process.platform

	if (platform === 'darwin') {
		for (const socket of [
			'/Users/'+ process.env.USER +'/.docker/run/docker.sock',
			'/var/run/docker.sock',
			process.env.DOCKER_HOST
		]) {
			if (socket && existsSync(socket.replace(/^unix:\/\//, '')))
				return socket.includes('://') ? socket : `unix://${socket}`
		}

		return 'tcp://localhost:2375'
	}

	return process.env.DOCKER_HOST || (platform === 'win32' ? 'tcp://localhost:2375' : 'unix:///var/run/docker.sock')
}

export function makeFile(path: string, content: string) {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  writeFileSync(path, content)
}

export function hasExt(path: string) {
  const index = path.lastIndexOf('.')
  return index > 0 && index < path.length - 1
}

export const highlightedMethod = (method: string, str?: string | null, siblings: boolean = false): string => {
  const val = str || method

  switch (method) {
    case 'HEAD':
    case 'OPTIONS':
    case 'CONNECT':
    case 'TRACE':
      return gray(val)
    case 'GET':
      return purple(val) + (siblings ? gray('|') + highlightedMethod('HEAD') : '')
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return yellow(val)
    case 'DELETE':
      return red(val)
  }

  return val
}

export const highlightedURI = (uri: string, method: string) => uri.replace(
  /(?::([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]+\})?|\*)/g,
  _ => highlightedMethod(method, _)
)
