import { Glob, file, write } from 'bun'

import { copyFileSync } from 'node:fs'
import { join, relative } from 'pathe'

import { camelCase, IMPORT, JSJSON, snakeCase } from 't0n'
import { rn, substep, warn } from 't0n/log'
import { config } from 'dotenv'
import { describeRoute, resolver, validator } from 'hono-openapi'
import { mimes } from 'hono/utils/mime'
import { STATUS_CODES } from 'node:http'
import $ from './app'
import _response from './response'
import _validator from './validator'
import { _root, _duto } from '@/utils'
import { getLastCommitHash, ensureDir, nextId } from './utils'
import { generateOpenAPI, generateOpenAPIClient, openAPIConfig } from './open-api/spec'
import { verbAlias } from './http'
import { highlightedMethod, highlightedURI } from './cli/utils'

import type { Routes, Rule, StandardSchemaV1 } from './types'
import { autorizedPath } from './middlewares/auth'
import { isDev } from './utils/environment'

export async function* scan(
  dir: string | string[],
  ext: string | string[],
  ignore: string[] = ['*.d.*'],
  cwd?: string,
): AsyncGenerator<[string, string, any]> {
  if (typeof dir !== 'string')
    dir = ext.length === 1 ? dir[0] : `{${dir.join(',')}}`

  if (typeof ext !== 'string')
    ext = ext.length === 1 ? ext[0] : `{${ext.join(',')}}`

  cwd ??= _root
  for await (const file of new Glob(dir +'/**/*.'+ ext).scan({
    cwd,
    absolute: true,
    onlyFiles: true, // @ts-ignore
    ignore,
  })) {
    yield [file, file.split(cwd as string)[1], await IMPORT(file)]
  }
}

const importName = (name: string | undefined, dirs: string[]) => (name || nextId()).replace(/\.ts$/, '')

function isSchema(obj: unknown): obj is StandardSchemaV1 {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    '~standard' in obj &&
    typeof (obj as StandardSchemaV1)['~standard'] === 'object'
  )
}

function withoutChecks(obj: any) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj

  for (const attr of [
    'format', 'pattern',
    'minLength', 'maxLength',
    'exclusiveMinimum', 'minimum',
    'exclusiveMaximum', 'maximum',
    'multipleOf',
    'minItems', 'maxItems', 'uniqueItems', 'contains',
    'minProperties', 'maxProperties', 'patternProperties', 'dependentRequired',
    'required',
  ]) {
    if (attr in obj)
      delete obj[attr]
  }

  for (const key of ['items', 'properties']) {
    if (key in obj) {
      for (const prop in obj[key])
        obj[key][prop] = withoutChecks(obj[key][prop])
    }
  }

  return obj
}

async function ResolveDescribeSchema(obj: any, deep = false) {
  if (!obj || typeof obj !== 'object') return obj

  if (isSchema(obj)) {
    const oas = await resolver(obj).toOpenAPISchema()
    const cType = oas.schema.properties ? 'application/json' : 'text/plain'
    return { content: { [cType]: {
      schema: withoutChecks(oas.schema),
        // TODO: obter o schema aqui..
        // example:{
        //   id: '123',
        //   name: 'John Doe',
        //   image: 'image.jpg',
        //   token: 'dksjdksjdksjdksjd',
        //   exp: 987654321,
        // }
    }}}
  }

  if (obj.content && typeof obj.content === 'object') {
    for (const mediaType in obj.content) {
      const contentItem = obj.content[mediaType]

      if (contentItem?.schema && isSchema(contentItem.schema)) {
        const oas = await resolver(contentItem.schema).toOpenAPISchema()
        contentItem.schema = withoutChecks(oas.schema)
        // TODO: ler o schema dinamicamente
        // contentItem.example = {
        //   id: '123',
        //   name: 'John Doe',
        //   image: 'image.jpg',
        //   token: 'dksjdksjdksjdksjd',
        //   exp: 987654321,
        // }

      }

      if (mediaType in mimes) {
        obj.content[mimes[mediaType]] = contentItem
        delete obj.content[mediaType]
      }
    }

    return obj
  }

  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object') {
      obj[key] = await ResolveDescribeSchema(obj[key], true)

      if (!deep && !obj[key]?.description) {
        const desc = new Response(null, { status: Number(key) }).statusText || STATUS_CODES[key]
        if (desc) obj[key].description = desc
      }
    }
  }

  return obj
}

let hasDuplicatedRoutes = false
export async function getRoutes(
  dirs: string[] = ['actions', 'features', 'routes']
): Promise<Routes> {
  hasDuplicatedRoutes = false
  const routes: Routes = []

  let length = 0
  const keys: Set<string> = new Set()
  const bag: Record<string, string[]> = {}
  const _route = (key: string, _: string) => {
    if (!keys.has(key)) {
      keys.add(key)
    } else {
      ; (bag[key] ||= []).push(_)
      length++
    }
  }

  for await (const [file, path, mod] of scan(dirs, ['ts', 'js'])) {
    if (!mod?.handle && !mod?.handler) continue

    const method = extractHttpVerb(path)
    const uri = extractHttpPath(path)

    const noAuth = autorizedPath(uri, method.toUpperCase())

    const desc = mod?.desc || {}
    const name = desc.summary || desc.name || uri.replace(/^\//, '') || 'index'

    function parseRules(ruleFn: Function | undefined, fn: Function) {
      const rules = typeof ruleFn === 'function' ? ruleFn(_validator) : null
      return rules ? (Array.isArray(rules) ? rules : [rules]).flatMap(fn as any) : []
    }

    async function parseBody(ruleFn?: Function) {
      const body = (await Promise.all(parseRules(ruleFn, async (rule: Rule) => {
        if (!['json', 'form'].includes(rule.target))
          return null

        return { content: { [
          rule.target === 'json'
            ? 'application/json'
            : 'multipart/form-data'
          ]: { ...(await resolver(rule.schema).toOpenAPISchema()) } } }
      }))).filter(Boolean)

      return body.length === 1 ? body[0] : undefined
    }

    async function parseParams(ruleFn?: Function) {
      const params = (await Promise.all(parseRules(ruleFn, async (rule: Rule) => {
        if (['json', 'form'].includes(rule.target))
          return null

        const items = []
        const oas = await resolver(rule.schema).toOpenAPISchema()

        if (oas?.schema?.properties) {
          const type = rule.target === 'param' ? 'path' : rule.target
          items.push(Object.entries(oas.schema.properties).map(([name, props]) => ({
            schema: props,
            in: type,
            name,
            required: oas.schema.required?.includes(name) || false
          })))
        }

        return items
      }))).filter(Boolean).flat(Infinity)

      return params.length ? params : undefined
    }


    routes.push({
      method, path: uri,
      name: snakeCase(name),
      file,
      rules: mod.rules,
      handle: mod.handle || mod.handler,
      middlewares: mod?.middlewares?.length ? mod.middlewares.flatMap((obj: any) => {
        return typeof obj === 'string' ? obj : obj?.name || null
      }).filter(Boolean) as Function[] : [],
      desc: {
        ...desc,
        summary: desc.summary || desc.name || camelCase(path.replace(new RegExp(`^/(${dirs.join('|')})/`), '').replace(/\.[^/.]+(?:[.][^/.]+)*$/, '')),
        parameters: await parseParams(mod.rules),
        requestBody: await parseBody(mod.rules),
        ...(noAuth ? {security: []} : {} ),
        responses: {
          ...(noAuth ? {} : {401: {description: 'Unauthorized'}} ),
          500: { $ref: '#/components/responses/500' },
          ...(await ResolveDescribeSchema(desc?.responses)),
        }
      },
    })

    const routeKey = method +'|'+ uri
    _route(name, file)
    _route(routeKey, file)
  }

  if (length) {
    hasDuplicatedRoutes = true
    Object.entries(bag).forEach(([name, paths]) => {
      if (name.includes('|')) {
        let [method, uri] = name.split('|')
        method = method.toUpperCase()
        name =  `${highlightedMethod(method, null, true)}  "${highlightedURI(uri, method)}"`
      }

      warn(`Route ${name} has `+ (paths.length > 1 ? `registered ${paths.length} times:` : 'already been registered:'))
      substep(...paths)
    })

    rn()
  }

  return sortRoutes(routes)
}

function extractHttpVerb(file: string) {
  if (!file) return 'get'
  const match = file.match(/\.(get|post|put|patch|delete|head|options)\.(?=[jt]s$)/i)
  return match && match[1] ? match[1].toLowerCase() : 'get'
}

function extractHttpPath(file: string) {
  const route = '/'+ file.replace(/\\/g, '/')
    .replace(/^\/(actions|features|routes)/, '')
    .replace(/\.[jt]s$/, '')
    .replace(/\.(get|post|put|patch|delete|head|options)$/i, '')
    .replace(/\/index$/, '')
    .split('/')
    .filter(Boolean)
    .filter(part => !(part.startsWith('(') && part.endsWith(')')))
    .map(part => part.startsWith('[') && part.endsWith(']') ? ':'+ part.slice(1, -1) : part)
    .join('/')

  return route === '/' ? '/' : route.replace(/\/$/, '')
}

export function sortRoutes(routes: Routes) {
  const metas = new Map<string, { score: number, segmentsCount: number }>()

  for (const route of routes)
    metas.set(route.path, computeRouteMeta(route.path))

  const list = routes.sort((a, b) => {
    const metaA = metas.get(a.path)!
    const metaB = metas.get(b.path)!

    if (metaA.score === metaB.score)
      return metaB.segmentsCount - metaA.segmentsCount

    return metaB.score - metaA.score
  })

  if (list.length < 2) return list

  const toMove = []
  while (list.length && list.at(-1)?.path === '/') {
    toMove.push(list.pop())
  } // @ts-ignore
  toMove.length && list.unshift(...toMove)
  // while (list.length && list.at(-1)?.path === '/') {
  //   const last = list.pop()
  //   last && list.unshift(last)
  // }

  return list
}

function computeRouteMeta(path: string) {
  const segments = path.split('/').filter(Boolean)

  let score = 0
  for (const segment of segments) {
    if (segment === '*') {
      continue
    } else if (segment.startsWith(':')) {
      score += 1
    } else {
      score += 10
    }
  }

  return { score, segmentsCount: segments.length }
}

export async function getMiddlewares(dir: string = 'middlewares'): Promise<Routes> {
  const mw: Routes = []

  for await (const [file, path, mod] of scan(dir, ['ts', 'js'])) {
    if (!mod?.handle && !mod?.handler) continue
    // @ts-ignore
    mw.push({
      path: mod?.path || '*',
      name: snakeCase(path.replace(/\\/g, '/')
        .replace(new RegExp(`^\/(${dir})/`), '')
        .replace(/\.[jt]s$/, '')
        .replace(/\/index$/, '')
      ),
      file,
      handle: mod.handle || mod.handler,
    })
  }

  return mw
}

export async function getConfigs(dir: string = 'configs'): Promise<Record<string, any>> {
  if (!join(_root, dir)) return {}
  const configs: Record<string, any> = {}

  for await (const [file, path, mod] of scan(dir, ['ts', 'js', 'cjs', 'mjs', 'json'])) {
    const keyPath = path.replace(/\.[^/.]+$/, '').replaceAll('/', '.').split('.').slice(2)

    keyPath.reduce((acc, key, index) => {
      if (index === keyPath.length - 1) {
        acc[key] = mod.default ?? mod
      } else if (!acc[key] || typeof acc[key] !== 'object') {
        acc[key] = {}
      }

      return acc[key]
    }, configs)
  }

  return configs
}

export async function dependencyEntry(lib: string, root: string) {
  const path = await import.meta.resolve(lib)
  return relative(root, path.replace('file://', ''))
}

async function dependencyPath(lib: string) {
  const entry = await dependencyEntry(lib, join(_root, '.duto'))
  return entry.substring(0, entry.lastIndexOf(lib) + lib.length)
}

export async function cacheRoutes() {
  const env = Object.entries(
    config({ path: join(_root, '.env.prod') })?.parsed || {}
  ).filter(([key, val]) => !key?.toLowerCase().startsWith('aws')) // prevent AWS credentials

  const version = getLastCommitHash()
  if (version) {
    env.push(['VERSION_SHA', process.env['VERSION_SHA'] = version])
    env.push(['VERSION_HASH', process.env['VERSION_HASH'] = version?.substring(0, 7)])
  }

  const rolePath = join(_root, 'configs/roles.ts')
  ensureDir(rolePath)
  const roleFile = file(rolePath)
  if (!(await roleFile.exists()))
    await write(rolePath, `export default {\n\n}`)

  const configs = await getConfigs()
  const middlewares = await getMiddlewares()
  if (isDev()) {
    const _file = join(_duto, 'server', 'middlewares', 'logger.ts')
    const _mod = await IMPORT(_file) // @ts-ignore
    middlewares.unshift({
      path: _mod?.path || '*',
      name: 'dev_logger',
      file: _file,
      handle: _mod.handle,
    })
  }

  const routes = await getRoutes()
  if (hasDuplicatedRoutes)
    throw new Error("The app can't build with duplicate routes")

  // _validator.setParser((rule: Rule) => validator(rule.target, rule.schema, (result, c) => {
  //   if (!result.success) // @ts-ignore
  //     return _response.badRequest(result.error)
  // }))

  const oasConfig = openAPIConfig(configs.duto)
  if (!oasConfig.disable) {
    // @ts-ignore
    const app = $({ routes, routeRegister: (app: Hono, route: Route) => {
      app[route.method](route.path, describeRoute(route.desc))
      // app[route.method](route.path, describeRoute(route.desc), ...resolveHandle(route.middlewares, route.handle, route.rules))
    } })

    configs.DUTO_OAS = JSON.stringify(await generateOpenAPI(app, oasConfig))
    configs.DUTO_OAC = await generateOpenAPIClient(app, oasConfig)
    configs.duto.docs = {path: oasConfig.path, auth: oasConfig?.auth}
  }

  const iPath = join(_root, '.duto/imports.mjs')
  ensureDir(iPath)

  const localfireEntry = await dependencyEntry('localflare-api', _root)
  copyFileSync(localfireEntry, join(_root, '.duto/localfire.js'))

  const _dutoDir = await dependencyPath('duto')

  await write(iPath, `// AUTO-GENERATED FILE - DO NOT EDIT
${env?.length ? `import { Envir } from '${await dependencyPath('t0n')}/src/envir'\nEnvir.add(${JSJSON(Object.fromEntries(env))})` : ''}
${Object.entries(configs)?.length ? `import Config from '${_dutoDir}/src/server/config'\nConfig.add(${JSJSON(configs)})` : ''}

${middlewares.map(r => `import { handle as MW${r.name} } from '../${normalizeImportPath(r.file)}'`).join('\n')}
export const middlewares = [[${middlewares.map(mw => [
  JSJSON(mw.path || false),
  'MW'+ mw.name,
  JSJSON(mw.name),
]).join('], [')}]]

${routes.map(r => `import { handle as ${r.name}${r.rules ? ', rules as R'+r.name : ''} } from '../${normalizeImportPath(r.file)}'`).join('\n')}

export const routes = [[${routes.filter(r => r.method && r.path).map(route => [
  verbAlias[route.method],
  JSJSON(route.path),
  JSJSON(route.middlewares),
  ...(route.rules ? [route.name, 'R' + route.name] : [route.name]),
  JSJSON(route.name)
]).join('], [')}]]
`)
}

function normalizeImportPath(file: string) {
  return relative(_root, file.replace(/\.tsx?$/i, '').replace(/(\/index)+$/i, '').replace(/\/+$/g, ''))
}
