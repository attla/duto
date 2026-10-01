import { dirname, join } from 'pathe'
import { NF_NAMES } from './constants'
import { _root } from '@/utils'
import type { Metadata } from './types'

export const router = new Bun.FileSystemRouter({
  style: 'nextjs',
  dir: join(_root, 'pages'),
  // origin: 'https://example.com',
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
