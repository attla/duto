import { IMPORT, isAsync } from 't0n'
import { dirname, join } from 'pathe'
import { error, rn } from 't0n/log'

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

// TODO: maybe transfer to t0n
const _join = (a: string[]) => a.length === 1 ? a[0] : `{${a.join(',')}}`
export async function* scan(
  dir: string | string[],
  ext: string | string[],
  ignore?: string[],
  cwd?: string,
): AsyncGenerator<{
  path: string,
  fullPath: string,
  mod: <R = any>() => Promise<R>,
  file: () => Bun.BunFile,
  text: () => Promise<string>,
  json: () => Promise<any>,
  // slice: (start?: number, end?: number, contentType?: string) => Blob,
  // image: (options?: Bun.Image.ConstructorOptions) => Bun.Image,
  // formData: () => Promise<FormData>,
  // arrayBuffer: () => Promise<ArrayBuffer>,
  // bytes: () => Promise<Uint8Array<ArrayBuffer>>,
  // stream: () => ReadableStream<Uint8Array<ArrayBuffer>>,
}> {
  if (typeof dir !== 'string') dir = _join(dir)
  if (typeof ext !== 'string') ext = _join(ext)

  cwd ??= _root
  for await (const fullPath of new Bun.Glob(dir +'/**/*.'+ ext).scan({
    cwd,
    absolute: true,
    onlyFiles: true, // @ts-ignore
    ignore: ignore ?? ['*.d.*'],
  })) {
    yield {
      fullPath,
      path: fullPath.split(cwd as string)[1],
      mod: async <R = any>() => IMPORT<R>(fullPath),
      file: () => Bun.file(fullPath),
      text: async () => Bun.file(fullPath).text(),
      json: async () => Bun.file(fullPath).json(),
    }
  }
}

export function shell(cb: Function) {
  return async (...args: unknown[]) => {
    try {
      const result = cb(...args)
      if (isAsync(result)) await result
    } catch (e: any) {
      error(e)
      process.exit(0)
    } finally {
      rn()
    }
  }
}
