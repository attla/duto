import { dirname, resolve } from 'node:path'
import { parseSync, printSync } from '@swc/core'

import { IMPORT_RE, BROWSER_ONLY, BROWSER_ONLY_SET, USE_CLIENT_RE, FILE_EXTENSIONS } from './constants'
import { resolveAlias } from './aliases'

import type {
  Metadata,
  FileMetadata,
  DepMetadata,
  ImportUsage, Usage,
} from './types'


function isBrowserLib(lib: string) {
  if (!lib) return false
  if (BROWSER_ONLY_SET.has(lib)) return true

  // avoids create template string every time
  for (let i = 0; i < BROWSER_ONLY.length; i++) {
    const base = BROWSER_ONLY[i]
    if (lib.startsWith(base) && lib.charCodeAt(base.length) === 47 /* '/' */) {
      return true
    }
  }

  return false
}

const resolveImportCache = new Map<string, string>()
export const resolveImport = (lib: string, importer: string, aliases: Record<string, string>) => {
  if (resolveImportCache.has(lib))
    return resolveImportCache.get(lib)!

  const id = resolveAlias(lib.startsWith('../') || lib.startsWith('./') ? resolve(importer, lib) : lib, aliases)

  resolveImportCache.set(lib, id)
  return id
}

export async function getFileMap(meta: Metadata) {
  const map = new Map<string, FileMetadata>()
  const violations = new Map<string, DepMetadata[]>()

  for await (const path of new Bun.Glob(`**/*.{${FILE_EXTENSIONS.join(',')}}`).scan({
    cwd: meta.root,
    absolute: true,
    onlyFiles: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/public/**',
    ],
  })) {
    const file: FileMetadata = { path, content: '', deps: new Map<string, DepMetadata>() }
    file.content = await Bun.file(path).text()
    if (!file.content.includes('import')) {
      map.set(path, file)
      continue
    }

    const dir = dirname(path)
    let match: RegExpExecArray | null
    const found: DepMetadata[] = []

    let importsEndIndex = 0
    while ((match = IMPORT_RE.exec(file.content))) {
      const statement = match[0]
      const ref = match[1]
      if (match[0].includes('import type') || !ref) continue

      const importEnd = match.index + statement.length
      if (importEnd > importsEndIndex) importsEndIndex = importEnd

      const identifiers = extractIdentifiers(statement)
      if (identifiers.length > 0 && !isAnyIdentifierUsed(identifiers, file.content, importEnd))
        continue

      const dep = {path: resolveImport(match[1], dir, meta.aliases), ref}
      file.deps.set(dep.path, dep)
      if (isBrowserLib(dep.path)) found.push(dep)
    }

    map.set(path, file)

    if (found.length || USE_CLIENT_RE.test(file.content))
      violations.set(path, found)
  }

  const visited = new Set<string>()
  const isViolator = (path: string, stack = new Set<string>()) => {
    if (violations.has(path)) return true
    if (visited.has(path) || stack.has(path)) return false

    stack.add(path)

    const file = map.get(path)
    if (!file) {
      visited.add(path)
      return false
    }

    for (const [depPath, dep] of file.deps) {
      if (isViolator(depPath, stack)) {
        const _violations = violations.get(path) || []
        violations.set(path, [..._violations, dep])
        visited.add(path)
        return true
      }
    }

    visited.add(path)
    return false
  }

  for (const [subpath, _] of map)
    isViolator(subpath)

  return { map, violations }
}

/**
 * Extracts identifiers from an import line without AST.
 *
 * Supports:
 * import Foo from '...'
 * import { Foo, Bar as Baz } from '...'
 * import * as Foo from '...'
 * import Foo, { Bar } from '...'
 */
function extractIdentifiers(importStatement: string): string[] {
  // Removes the module path and the word 'import'
  const withoutPath = importStatement.replace(/from\s+['"][^'"]+['"]\s*;?/, '').replace(/^import\s+/, '')

  const identifiers: string[] = []

  // import * as Name
  const namespaceMatch = withoutPath.match(/\*\s+as\s+(\w+)/)
  if (namespaceMatch) return [namespaceMatch[1]];

  // Named imports { Foo, Bar as Baz }
  const namedMatch = withoutPath.match(/\{([^}]+)\}/)
  if (namedMatch) {
    for (const part of namedMatch[1].split(',')) {
      // "Bar as Baz" → usa "Baz" (o alias local)
      const alias = part.trim().match(/(?:.*\bas\s+)?(\w+)$/)
      if (alias) identifiers.push(alias[1]);
    }
  }

  // Default import (before a comma or the end): import Foo, { ... }
  const defaultMatch = withoutPath.match(/^(\w+)/)
  if (defaultMatch) identifiers.push(defaultMatch[1])

  return identifiers
}

/**
 * Checks if at least one of the identifiers appears in the code
 * after the end of the import line (avoids false positives with the import itself).
 *
 * Uses indexOf for maximum performance — no regex, no AST.
 */
function isAnyIdentifierUsed(identifiers: string[], code: string, afterIndex: number): boolean {
  const body = code.slice(afterIndex)

  for (const id of identifiers) {
    let pos = body.indexOf(id)
    while (pos !== -1) {
      // Checks if it is a whole word (not part of another identifier)
      const before = pos === 0 ? '' : body[pos - 1]
      const after = body[pos + id.length] ?? ''

      const isWordBoundaryBefore = !/\w/.test(before)
      const isWordBoundaryAfter = !/\w/.test(after)

      if (isWordBoundaryBefore && isWordBoundaryAfter) return true

      pos = body.indexOf(id, pos + 1)
    }
  }

  return false
}

const SKIP_KEYS = new Set([
  'span',
  'ctxt',
  'raw',
  'hasConstructor',
  'isGenerator',
  'isAsync',
  'typeAnnotation',
  'typeParams',
])

function printImport(node: unknown): string {
  const n = node as { span: unknown }
  return printSync({
    type: 'Module',
    span: n.span as never,
    body: [node as never], // @ts-ignore
    interpreter: null,
  }).code
}

function printExpression(node: unknown): string {
  const n = node as { span: unknown }
  return printSync({
    type: 'Module',
    span: n.span as never,
    body: [
      {
        type: 'ExpressionStatement',
        span: n.span,
        expression: node,
      } as never,
    ], // @ts-ignore
    interpreter: null,
  }).code
    .replace(/;$/, '')
    .trim()
}

/**
 * Builds a byteOffset → charIndex map to convert SWC spans
 * (which are UTF-8 byte offsets, base 1) in JS character indices (base 0).
 *
 * Required because characters like →, ─, 🧪 take up more than 1 byte,
 * causing drift between byte offset and charIndex
 */
export function makeByteToCharMap(code: string): Int32Array {
  const buf = Buffer.from(code, 'utf8')
  const map = new Int32Array(buf.length + 1)
  let charIdx = 0
  let byteIdx = 0

  while (byteIdx < buf.length) {
    map[byteIdx] = charIdx
    const byte = buf[byteIdx]
    let byteLen = 1
    if ((byte & 0x80) === 0) byteLen = 1
    else if ((byte & 0xe0) === 0xc0) byteLen = 2
    else if ((byte & 0xf0) === 0xe0) byteLen = 3
    else if ((byte & 0xf8) === 0xf0) byteLen = 4
    // surrogate pair: 4-byte UTF-8 = 2 JS chars
    charIdx += byteLen === 4 ? 2 : 1
    byteIdx += byteLen
  }

  map[buf.length] = charIdx
  return map
}

/**
 * Checks if the usage is inside a JSXExpressionContainer, that is,
 * if it is wrapped in `{` and `}` in JSX. Returns the span of the container if yes.
 */
function getJSXContainerSpan(
  parent: unknown,
): { start: number, end: number } | null {
  const p = parent as Record<string, unknown> | undefined
  if (p?.['type'] === 'JSXExpressionContainer') {
    const span = p['span'] as { start: number, end: number } | undefined
    if (span) return span
  }
  return null
}

export function findUsage(
  code: string,
  target: string,
  _ast?: any,
): ImportUsage[] {
  const ast = _ast ?? parseSync(code, { syntax: 'typescript', tsx: true })
  const imports: ImportUsage[] = [] // @ts-ignore
  const source = resolveImport(target)

  // collect imports
  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration') continue

    const decl = node as {
      type: string,
      source: { value: string },
      specifiers: Array<{
        type: string,
        imported?: { value: string },
        local: { value: string },
      }>,
      span: { start: number, end: number },
    }

    if (decl.source.value !== target) continue

    for (const specifier of decl.specifiers) {
      if (specifier.type !== 'ImportSpecifier' && specifier.type !== 'ImportDefaultSpecifier') continue

      imports.push({
        source,
        // source: decl.source.value,
        imported: specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported?.value ?? specifier.local.value,
        local: specifier.local.value,
        importStart: decl.span.start,
        importEnd: decl.span.end,
        importText: printImport(node),
        usages: [],
      })
    }
  }

  if (imports.length === 0) return imports

  // fast lookup
  const map = new Map<string, ImportUsage>()

  for (const item of imports)
    map.set(item.local, item)

  // walk — skip the keys that never contain us children
  function walk(node: unknown, parent?: unknown) {
    if (!node || typeof node !== 'object') return

    const n = node as Record<string, unknown>

    if (n['type'] === 'JSXElement') { // <Counter /> / <Counter></Counter>
      const opening = n['opening'] as Record<string, unknown> | undefined

      if (opening?.['name'] && (opening['name'] as Record<string, unknown>)['type'] === 'Identifier') {
        const local = (opening['name'] as Record<string, unknown>)['value'] as string
        const found = map.get(local)

        if (found) {
          found.usages.push({
            type: 'jsx',
            source: found.source,
            imported: found.imported,
            local,
            start: (n['span'] as { start: number }).start,
            end: (n['span'] as { end: number }).end,
            text: printExpression(node),
            node,
            parent,
          })
        }
      }
    }

    if (n['type'] === 'CallExpression') { // Counter() or {Counter()}
      const callee = n['callee'] as Record<string, unknown> | undefined

      if (callee?.['type'] === 'Identifier') {
        const local = callee['value'] as string
        const found = map.get(local)

        if (found) {
          // If the parent is JSXExpressionContainer ({Counter()}), expand the span
          // to include the braces { }
          const containerSpan = getJSXContainerSpan(parent)
          const nodeSpan = n['span'] as { start: number, end: number }

          found.usages.push({
            type: 'call',
            source: found.source,
            imported: found.imported,
            local,
            start: containerSpan ? containerSpan.start : nodeSpan.start,
            end: containerSpan ? containerSpan.end : nodeSpan.end,
            text: printExpression(node),
            node,
            parent,
          })
        }
      }
    }

    if (n['type'] === 'Identifier') { // {Counter} in JSX or Counter as a reference
      const local = n['value'] as string
      const found = map.get(local)
      const p = parent as Record<string, unknown> | undefined

      if (
        found &&
        p?.['type'] !== 'ImportSpecifier' &&
        p?.['type'] !== 'JSXOpeningElement' &&
        p?.['type'] !== 'JSXClosingElement' && // avoids duplicating usage of <X></X>
        p?.['type'] !== 'CallExpression'
      ) {
        // If the parent is JSXExpressionContainer ({Counter}), expand the span to include the braces { }
        const containerSpan = getJSXContainerSpan(parent)
        const nodeSpan = n['span'] as { start: number, end: number }

        found.usages.push({
          type: 'reference',
          source: found.source,
          imported: found.imported,
          local,
          start: containerSpan ? containerSpan.start : nodeSpan.start,
          end: containerSpan ? containerSpan.end : nodeSpan.end,
          text: local,
          node,
          parent,
        })
      }
    }

    for (const key in n) { // recurse
      if (SKIP_KEYS.has(key)) continue

      const value = n[key]

      if (Array.isArray(value)) {
        for (const item of value)
          walk(item, node)
      } else if (value && typeof value === 'object') {
        walk(value, node)
      }
    }
  }

  walk(ast)
  return imports
}

/**
 * Removes snippets corresponding to the reported usages from the source code.
 *
 * SWC spans are UTF-8 (base 1) byte offsets, not JS character indices.
 * The conversion is done internally via makeByteToCharMap — the caller
 * does not need to worry about it.
 */
export function removeUsage(
  code: string,
  targets: Usage | Usage[],
): string {
  const list = Array.isArray(targets) ? targets : [targets]
  if (!list.length) return code

  // converte byte offset (base 1) → char index JS (base 0)
  const b2c = makeByteToCharMap(code)
  const toChar = (byteOffset: number) => b2c[byteOffset - 1]

  const raw: Array<[number, number]> = []

  for (const usage of list) {
    if (usage.start < usage.end)
      raw.push([toChar(usage.start), toChar(usage.end)])
  }

  if (!raw.length) return code

  raw.sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []

  for (const [start, end] of raw) {
    const last = merged[merged.length - 1]
    if (last && start >= last[0] && end <= last[1]) continue
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
      continue
    }
    merged.push([start, end])
  }

  const parts: string[] = []
  let cursor = 0

  for (const [start, end] of merged) {
    if (start > cursor) parts.push(code.slice(cursor, start))
    cursor = end
  }

  if (cursor < code.length) parts.push(code.slice(cursor))

  return parts.join('').replace(/\n{3,}/g, '\n\n')
}


/**
 * Extracts props from a JSXElement node from the SWC AST.
 * Supports: string literals, numeric literals, boolean (true/false), simple expressions.
 */
export function extractPropsFromJSX(node: unknown): Record<string, unknown> {
  const n = node as Record<string, unknown>
  const opening = n['opening'] as Record<string, unknown> | undefined
  if (!opening) return {}

  const attrs = opening['attributes'] as Array<Record<string, unknown>> | undefined
  if (!attrs) return {}

  const props: Record<string, unknown> = {}

  for (const attr of attrs) {
    if (attr['type'] !== 'JSXAttribute') continue

    const nameNode = attr['name'] as Record<string, unknown>
    const propName = nameNode['value'] as string

    const valueNode = attr['value'] as Record<string, unknown> | null | undefined

    if (valueNode === null || valueNode === undefined) {
      // <Comp disabled /> → disabled: true
      props[propName] = true
      continue
    }

    switch (valueNode['type']) {
      case 'StringLiteral':
        props[propName] = valueNode['value']
        break

      case 'JSXExpressionContainer': {
        const expr = valueNode['expression'] as Record<string, unknown>
        switch (expr['type']) {
          case 'NumericLiteral':
          case 'StringLiteral':
            props[propName] = expr['value']
            break
          case 'BooleanLiteral':
            props[propName] = expr['value']
            break
          case 'NullLiteral':
            props[propName] = null
            break
          case 'ArrayExpression': {
            // Serialize an array of simple literals
            const elems = expr['elements'] as Array<{ expression: Record<string, unknown> }> | undefined
            props[propName] = elems?.map(e => e?.expression?.['value']) ?? []
            break
          }
          default:
            // Complex expressions: keep as undefined (not safely serializable)
            break
        }
        break
      }

      default:
        break
    }
  }

  return props
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
