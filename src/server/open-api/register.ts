import { basicAuth } from 'hono/basic-auth'
import response from '$/response'
import Config from '$/config'
import type { Hono } from '$/types'

export function registerOpenAPI(app: Hono, opts: any) {
  if (!opts.path) return

  if (opts?.auth?.username && opts?.auth?.password) {
    app.use(opts.path +'/*', async (c, next) => {
      const realm = opts.auth?.realm || 'Docs'
      const unauthorized = response.unauthorized(
        null,
        {'WWW-Authenticate': `Basic realm="${realm.replace(/"/g, '\\"')}", charset="UTF-8"`}
      )
      if (!c.req.raw.headers.get('Authorization')) return unauthorized
      const auth = basicAuth({ username: opts.auth.username, password: opts.auth.password, realm })

      try {
        await auth(c, next)
      } catch {
        return unauthorized
      }
    })
  }

  app.get(opts.path, async () => response.html(Config.get('DUTO_OAC')))
  app.get(opts.path +'/openapi', async () => response.raw(200, Config.get('DUTO_OAS'), 'application/json'))
}
