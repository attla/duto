import { join } from 'pathe'
import { _root } from './utils'

export const router = new Bun.FileSystemRouter({
  style: 'nextjs',
  dir: join(_root, 'pages'),
  // origin: 'https://mydomain.com',
  // assetPrefix: 'assets/',
})

export const reload = () => router.reload()

export const match = (input: string | Request | Response) => router.match(input)
