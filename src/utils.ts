import { getEnv } from 't0n'
import { dirname, join } from 'pathe'

export const _duto = dirname(new URL(import.meta.url).pathname)
export const _pages = join(_duto, 'pages')
export const _server = join(_duto, 'server')
export const _root = getEnv('npm_config_local_prefix') || getEnv('PWD') || join(_duto, '../../')

const UNITS = ['B', 'kB', 'MB', 'GB']
export function filesize(bytes: number, decimals = 2) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  return `${parseFloat((bytes / 1024 ** i).toFixed(decimals))} ${UNITS[i]}`
}
