import { IMPORT, Datte } from 't0n'
import { join } from 'pathe'
import { gray, green, yellow, red, cyan, dim } from 't0n/color'

import { resolveExtension } from '#/compiler/file'
import config from '#/compiler/bun-plugin'
import { _root } from '@/utils'
import { match, match404 } from '#/compiler/routes'
import type { DutoOptions, Metadata } from '#/compiler/types'
import { EXTENSIONS_LIST, NF_NAMES } from '#/compiler/constants'
import { log } from 't0n/log'

export async function getConfig(name = 'config'): Promise<DutoOptions> {
  let opts = {} as DutoOptions
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
  const server = Bun.serve({
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
          const r404 = match404(meta, path) || '404'
          route = matched?.name || r404
          res = new Response(null, { status: 404 })

          for (const asset of [
            path,
            join(path, 'index'),
            r404,
            'index',
          ]) {
            file = Bun.file(join(_root, dist, asset +'.html'))

            if (await file.exists()) {
              NF_NAMES.includes(asset.split('/').pop()!) && (route = r404)
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
        if (EXTENSIONS_LIST.has(path.split('.').pop()!.toLowerCase())) {
        } else if (route || matched) {
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

  // @ts-ignore
  log(`Running on http://${host}:${port}${global?.__st ? dim(` in ${Math.ceil(performance.now() - global.__st)} ms`) : ''}`)

  return server
}
