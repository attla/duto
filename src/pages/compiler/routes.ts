import { join } from 'pathe'
import { _root } from './utils'
import type { IRoute, Metadata } from './types'
import { dirname } from 'node:path'
import { NF_NAMES } from './constants'

export const router = new Bun.FileSystemRouter({
  style: 'nextjs',
  dir: join(_root, 'pages'),
  // origin: 'https://mydomain.com',
  // assetPrefix: 'assets/',
})
export const reload = () => router.reload()
export const match = (input: string | Request | Response) => router.match(input)

export const match404 = (meta: Metadata, path: string) => {
  const segments = dirname(path).split(/[\\/]/).filter(Boolean)

  for (let i = segments.length; i >= 0; i--) {
    const dir = segments.slice(0, i).join('/')

    for (const item of NF_NAMES) {
      const page = meta.nf.get((dir ? dir+'/' : '') + item)
      if (page) return '/'+ page.fileName
    }
  }

  return ''
}
