import { resolve } from 'node:path'
import { resolveAlias } from './aliases'

const resolveImportCache = new Map<string, string>()
export const resolveImport = (lib: string, importer: string, aliases: Record<string, string>) => {
  if (resolveImportCache.has(lib))
    return resolveImportCache.get(lib)!

  const id = resolveAlias(lib.startsWith('../') || lib.startsWith('./') ? resolve(importer, lib) : lib, aliases)

  resolveImportCache.set(lib, id)
  return id
}

const reCache = new Map<string, string>()
export function removeExports(id: string, code: string, targets: Set<string>) {
  let should = false
  for (const t of targets) {
    if (code.includes(t)) {
      should = true
      break
    }
  }
  if (!should) return null

  const cacheKey = id + code.length
  if (reCache.has(cacheKey))
    return reCache.get(cacheKey)!

  let i = 0
  let result = ''
  let mutated = false

  while (i < code.length) {
    const exportIdx = code.indexOf('export', i)

    if (exportIdx === -1) {
      result += code.slice(i)
      break
    }

    result += code.slice(i, exportIdx)
    i = exportIdx

    const rest = code.slice(i)

    // export { ... } (multiline support)
    if (/^export\s*{/.test(rest)) {
      let j = i
      let brace = 0
      let contentStart = -1
      let contentEnd = -1

      while (j < code.length) {
        const ch = code[j]

        if (ch === '{') {
          brace++
          if (brace === 1) contentStart = j + 1
        } else if (ch === '}') {
          brace--
          if (brace === 0) {
            contentEnd = j
            j++
            break
          }
        }

        j++
      }

      if (contentStart !== -1 && contentEnd !== -1) {
        const raw = code.slice(contentStart, contentEnd)

        const names = raw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => s.split(/\s+as\s+/)[0].trim())

        const shouldRemoveAll =
          names.length > 0 && names.every((n) => targets.has(n))

        if (shouldRemoveAll) {
          mutated = true
          i = j
          continue
        }

        // partial remove
        let newEntries = raw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(entry => {
            const name = entry.split(/\s+as\s+/)[0].trim()
            return !targets.has(name)
          })

        if (newEntries.length !== names.length) {
          mutated = true

          if (newEntries.length === 0) {
            i = j
            continue
          }

          result += 'export { ' + newEntries.join(', ') + ' }'
          i = j
          continue
        }
      }
    }

    // export function / async function
    const fnMatch =
      /^export\s+async\s+function\s+([a-zA-Z0-9_$]+)/.exec(rest)
       || /^export\s+function\s+([a-zA-Z0-9_$]+)/.exec(rest)

    if (fnMatch) {
      const name = fnMatch[1]

      if (targets.has(name)) {
        mutated = true

        let brace = 0
        let j = i

        while (j < code.length) {
          if (code[j] === "{") brace++
          else if (code[j] === "}") {
            brace--
            if (brace === 0) {
              j++
              break
            }
          }
          j++
        }

        i = j
        continue
      }
    }

    // export const { ... } destructuring
    const destructMatch = /^export\s+const\s*{/.test(rest)

    if (destructMatch) {
      let j = i
      let brace = 0
      let contentStart = -1
      let contentEnd = -1

      while (j < code.length) {
        const ch = code[j]

        if (ch === '{') {
          brace++
          if (brace === 1) contentStart = j + 1
        } else if (ch === '}') {
          brace--
          if (brace === 0) {
            contentEnd = j
            break
          }
        }

        j++
      }

      if (contentStart !== -1 && contentEnd !== -1) {
        const raw = code.slice(contentStart, contentEnd)

        const names = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.split(':')[0].trim())

        const shouldRemoveAll =
          names.length > 0 && names.every((n) => targets.has(n))

        if (shouldRemoveAll) {
          mutated = true

          // remove up to ;
          while (j < code.length && code[j] !== ';' && code[j] !== '\n') {
            j++
          }
          j++

          i = j
          continue
        }
      }
    }

    // export const foo =
    const varMatch = /^export\s+const\s+([a-zA-Z0-9_$]+)/.exec(rest)

    if (varMatch) {
      const name = varMatch[1]

      if (targets.has(name)) {
        mutated = true

        let j = i
        while (j < code.length && code[j] !== ';' && code[j] !== '\n') {
          j++
        }
        j++

        i = j
        continue
      }
    }

    // fallback
    result += 'export'
    i += 'export'.length
  }

  const retrn = mutated ? result : code
  reCache.set(cacheKey, retrn)
  return retrn
}
