import { Ability } from '$/auth'
import type { Req, Res, Next } from '@/.'

import { RegExpRouter } from 'hono/router/reg-exp-router'
import { SmartRouter } from 'hono/router/smart-router'
import { TrieRouter } from 'hono/router/trie-router'

let used = false
export const useAuth = () => used

const whiteList = new SmartRouter({
  routers: [new RegExpRouter(), new TrieRouter()],
})

export function autorizedPath(path: string, method = 'ALL'){
  return used ? whiteList.match(method, path)[0][0]?.[0] !== undefined : true
}

export function auth(publicPaths: (string | [string, string])[]) {
  if (!used) {
    used = true
    for (const route of publicPaths) {
      const str = typeof route === 'string'
      const path = str ? route : route[1]

      whiteList.add(str ? 'ALL' : route[0], path, path)
    }
  }

  return async (req: Req, res: Res, next: Next) => {
    if (!autorizedPath(req.path, req.method)) {
      const ability = Ability.fromRequest(req)

      if (!req?.user || !ability || req.cant(ability))
        return res.unauthorized()
    }

    await next()
  }
}
