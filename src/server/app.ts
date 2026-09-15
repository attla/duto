import { Hono } from 'hono'
import type {
  Env, Context, Next,
  HTTPResponseError,
  ServerOptions, Route
} from './types'
import request from './request'
import response from './response'
import { isDev } from './utils/environment'
import { getVerb } from './utils'
import { registerMiddleware, resolveHandle, resolveMw } from './handle'

async function EHandler(e: Error | HTTPResponseError) {
  console.error(e)

  switch (true) {
    // case 'status' in e && e.status === 401:
    case e?.status === 401:
      return response.unauthorized()

    // case 'status' in e && e.status === 400: // @ts-ignore
    case e?.status === 400:
      return response.badRequest(null, e?.message)

    default:
      return response.internalError(
        // @ts-ignore
        isDev() // TODO: remover ou migrar para um middleware / melhorar
          ? e.stack?.split('\n').map(line =>
              line.replace(
                /at (.+ )?\(?([^)]+)\)?/g,
                (match, method, path) => {
                  if (!path) return match

                  const nodeModulesIndex = path.indexOf('node_modules')
                  if (nodeModulesIndex > -1)
                    return `${method || ''}(node_modules${path.slice(nodeModulesIndex + 'node_modules'.length)})`

                  const projectRoot = process.cwd()
                  const relativePath = path.startsWith(projectRoot) ? path.slice(projectRoot.length + 1) : path
                  return `${method || ''}(${relativePath})`
                }
              ).trim()
            )
          : undefined,
        e.message || 'Internal Error'
      )
  }

  // return json.internalError(
  //   // @ts-ignore
  //   isDev() ? e.stack?.split('\n    at ').map() : undefined,
  //   e.message || 'Internal Error'
  // )
  // error: e.message,
  // cause: e.cause || '???',
  // stack: isDev (? e.stack : undefined
}

export default function createApp<E extends Env>(options?: ServerOptions<E>) {
  // const root = options?.root ?? '/'
  const app = options?.app ?? new Hono<E>()

  app.use(async (c: Context, next: Next) => {
    await request.toContext(c)
    await next()
  })

  const middlewares = options?.middlewares || []
  for (const mw of middlewares) { // @ts-ignore
    registerMiddleware(mw[2], mw[1]) // @ts-ignore
    mw[0] ? app.use(String(mw[0]), resolveMw(mw[1])) : app.use(resolveMw(mw[1]))
  }

  // @ts-ignore
  app.onError(options?.onError || EHandler)
  app.notFound(options?.notFound || response.notFound)

  if (options?.init) options.init(app)

  const routes = options?.routes || [] // @ts-ignore
  const routeRegister = options?.routeRegister ? options.routeRegister : (_: Hono, route: Route) => {
    // @ts-ignore
    _[getVerb[route[0]]](route[1], ...resolveHandle(route[2], route[3], route[4]))
  }

  for (const route of routes)
    routeRegister(app, route)

  return app
}
