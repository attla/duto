import { IMPORT, Datte } from 't0n'
import { join } from 'pathe'
import { gray, green, yellow, red, cyan } from 't0n/color'
import type { UserConfig } from 'vite'

import { resolveExtension } from '@/file'
import config from '@/vite-plugin'
import { _root } from '@/utils'
import { match, match404 } from '@/routes'
import type { Metadata, PluginOptions } from '@/types'
import { getMetadata } from '@/meta'

export async function getConfig(name = 'config'): Promise<UserConfig & PluginOptions> {
  let opts = {} as UserConfig
  const file = resolveExtension(name)
  if (file) opts = await IMPORT(join(_root, file), 'default')
  return config(opts)
}

// export const formatTime = (ms: number) => {
//   if (ms < 1000) return `${ms}ms`
//   return `${(ms / 1000).toFixed(2)}s`
// }
export const formatTime = (ms: number) => {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(2)}ns`
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(1)}s`
}

const statusColorMap = new Map([
  [5, red],
  [4, yellow],
  [3, cyan],
])

const getStatusColor = (status: number) => (statusColorMap.get(Math.floor(status / 100)) ?? green)(String(status))

const clients = new Set<Bun.ServerWebSocket<void>>()
export function reload() {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN)
      ws.send('reload')
  }
}

export function preview(
  meta: Metadata,
  host: string = '0.0.0.0',
  port: number = 4173
) {
  return Bun.serve({
    hostname: host,
    port,

    websocket: {
      open(ws) {
        clients.add(ws)
      },
      close(ws) {
        clients.delete(ws)
      },
      message() {},
    },
    async fetch(req, server) {
      const start = performance.now()

      const url = new URL(req.url)
      const path = decodeURIComponent(url.pathname)
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': '*',
      }

      if (req.method === 'OPTIONS')
        return new Response(null, { status: 204, headers })

      if (req.headers.get('upgrade') === 'websocket'
          && req.headers.get('sec-websocket-protocol') === 'duto') {
        server.upgrade(req)
        return
      }

      let status = 500
      let route: string | undefined
      let matched: Bun.MatchedRoute | null | undefined

      try {
        let res: Response
        const dist = 'dist' // TODO: get from configs

        let file = Bun.file(join(_root, dist, path))

        if (await file.exists()) {
          // route = path
          res = new Response(file)
        } else {
          matched = match(path)

          // console.log(matched)
          route = matched?.name || match404(meta, path)

          res = new Response(null, { status: 404 })

          // for (const asset of path !== '/' && matched && matched.kind === 'exact' ? [
          //   path,
          //   join(path, 'index'),
          // ] : ['index']) {
          for (const asset of [
            path,
            join(path, 'index'),
            'index',
          ]) {
            file = Bun.file(join(_root, dist, asset +'.html'))

            if (await file.exists()) {
              // if (route === '/' || !route) route = asset
              res = new Response(file)
              break
            }
          }
        }

        status = res.status
        return res
      } catch (err) {
        status = 500
        throw err
      } finally {
        if (route || matched) {
          const elapsed = `${Math.max(1, Math.ceil(performance.now() - start))}ms`

          console.log([
            gray(Datte.dateTime()),
            getStatusColor(status),
            path,
            route && route !== path ? gray(route) : '',
            gray(elapsed),
          ].filter(Boolean).join(' '))
        }
      }
    },
  })
}
