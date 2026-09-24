import { IMPORT, Datte } from 't0n'
import { join } from 'pathe'
import { gray, green, yellow, red, cyan } from 't0n/color'
import type { UserConfig } from 'vite'

import { resolveExtension } from '#/compiler/file'
import config from '#/compiler/vite-plugin'
import { _root } from '@/utils'
import { match, match404 } from '#/compiler/routes'
import type { Metadata, PluginOptions } from '#/compiler/types'

export async function getConfig(name = 'config'): Promise<UserConfig & PluginOptions> {
  let opts = {} as UserConfig
  const file = resolveExtension(name)
  if (file) opts = await IMPORT(join(_root, file), 'default')
  return config(opts)
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
          res = new Response(file)
        } else {
          matched = match(path)
          route = matched?.name || match404(meta, path)
          res = new Response(null, { status: 404 })

          for (const asset of [
            path,
            join(path, 'index'),
            'index',
          ]) {
            file = Bun.file(join(_root, dist, asset +'.html'))

            if (await file.exists()) {
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
