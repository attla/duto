import { extname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { EXTENSIONS, FILE_EXTENSIONS } from './constants'
import type { Metadata } from '@/types'

const extensionCache = new Map<string, string | null>()
export function resolveExtension(filePath: string): string | null {
  const cacheKey = extname(filePath)
    ? filePath.slice(0, -extname(filePath).length)
    : filePath

  const cached = extensionCache.get(cacheKey)
  if (cached !== undefined) return cached

  const result = resolveExtensionUncached(filePath)
  extensionCache.set(cacheKey, result)
  return result
}

export function resolveExtensionUncached(filePath: string): string | null {
  if (extname(filePath))
    return existsSync(filePath) ? filePath : null

  for (const ext of EXTENSIONS) {
    const direct = `${filePath}.${ext}`
    if (existsSync(direct)) return direct

    const index = join(filePath, `index.${ext}`)
    if (existsSync(index)) return index
  }

  return null
}

export function findFileByName(meta: Metadata, dir: string, baseName: string): string | null {
  for (const extension of FILE_EXTENSIONS) {
    const candidate = join(meta.root, 'pages', dir, `_${baseName}.${extension}`)
    if (existsSync(candidate))
      return candidate
  }

  return null
}

// export function fileWhitoutExt(filePath: string): string {
//   const parsed = parse(filePath)
//   let name = parsed.name
//   while (name.includes('.'))
//     name = name.replace(/\.[^/.]+`$/, '')

//   return join(parsed.dir, name)
// }

// export async function ensureDir(dir: string): Promise<void> {
//   try {
//     await access(dir)
//   } catch (error) {
//     await mkdir(dir, { recursive: true })
//   }
// }
