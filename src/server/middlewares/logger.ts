import { logger } from 'hono/logger'
import { matchedRoutes } from 'hono/route'
import { Datte } from 't0n'
import { gray } from 't0n/color'
import type { Req, Res, Context, Next } from '@/.'

export const path = '*'
export async function handle(req: Req, res: Res, next: Next, c: Context) {
  const method = c.req.method
  const route = matchedRoutes(c).find(route => route.method === method)?.path
  const logWithRoute = (args: string[]) => {
    if (!route || !args.length) return args
    return args.map(arg => {
      if (!arg) return arg
      const split = arg?.split(' ')
      if (split.length < 3 || split[2] === route)
        return arg

      split.splice(Math.min(3, split.length), 0, gray(route))
      return split.join(' ')
    })
  }

  const devLogger = logger((...args: any[]) => {
    const timestamp = gray(Datte.dateTime())
    console.log(timestamp, ...logWithRoute(args))
  })

  await devLogger(c, next)
}
