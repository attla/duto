import { dirname, join } from 'pathe'

export const _duto = dirname(new URL(import.meta.url).pathname)
export const _pages = join(_duto, 'pages')
export const _server = join(_duto, 'server') //@ts-ignore
export const _root = process.env?.npm_config_local_prefix || process.env?.PWD || process.stdin?.path || process.cwd() // || join(_duto, '../../')s

const UNITS = ['B', 'kB', 'MB', 'GB']
export function filesize(bytes: number, decimals = 2) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  return `${parseFloat((bytes / 1024 ** i).toFixed(decimals))} ${UNITS[i]}`
}

export const formatTime = (ms: number) => {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(2)}ns`
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(1)}s`
}
