import { h } from 'preact'
import { renderToString } from 'preact-render-to-string'
import { IMPORT, newID } from 't0n'

import { getEntry } from './assets'
import { makeByteToCharMap, extractPropsFromJSX } from './ast'

import type { ImportUsage, IslandMeta } from './types'

function serializeProps(props: Record<string, unknown>) {
  return JSON.stringify(props)
}

function htmlEncodeProps(serialized: string) {
  return serialized
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function renderIslandSSR(
  component: unknown,
  props: Record<string, unknown>,
  children?: unknown,
): Promise<string> {
  try {
    return renderToString(h(component as never, props as never, children as never))
  } catch {
    return ''
  }
}

function buildIslandTag(meta: IslandMeta) {
  return `<i-s id="${meta.id}" url="${getEntry(meta.url)}"${meta.export === 'default' ? '' : ` export="${meta.export}"`}${meta.props === '{}' ? '' : ` props="${meta.props}"`}>${meta.ssrHtml}</i-s>`
}

/**
 * Replaces in "sourceCode" each occurrence of imported components
 * from "importSource" by hydrator-compatible <island> tags.
 *
 * @param sourceCode TSX source code
 * @param importSource The target module (e.g. '@/components/counter2')
 * @param opts Resolution callbacks
 * @returns Code with replacements applied
 */
export async function replaceIslands(
  code: string,
  usages: ImportUsage[],
) {
  if (!usages.length) return code

  const b2c = makeByteToCharMap(code)
  const toChar = (byteOffset: number) => b2c[byteOffset - 1]

  const replacements: Array<{ start: number; end: number; replacement: string }> = []

  for (const importUsage of usages) {
    const component = await IMPORT(importUsage.source, importUsage.imported)

    // schedule removal of the import declaration (replacement with an empty string)
    replacements.push({
      start: toChar(importUsage.importStart),
      end: toChar(importUsage.importEnd),
      replacement: '',
    })

    // schedule the replacement of each JSX usage with `<island>`
    for (const usage of importUsage.usages) {
      if (usage.type !== 'jsx') continue

      const props = extractPropsFromJSX(usage.node)
      const ssrHtml = await renderIslandSSR(component, props)

      const island = buildIslandTag({
        id: newID(),
        url: importUsage.source,
        export: importUsage.imported,
        props: htmlEncodeProps(serializeProps(props)),
        ssrHtml,
      })

      replacements.push({
        start: toChar(usage.start),
        end: toChar(usage.end),
        replacement: island,
      })
    }
  }

  if (!replacements.length) return code

  replacements.sort((a, b) => a.start - b.start)

  const parts: string[] = []
  let cursor = 0

  for (const { start, end, replacement } of replacements) {
    if (start < cursor) continue // overlapped, discards
    if (start > cursor) parts.push(code.slice(cursor, start))
    parts.push(replacement)
    cursor = end
  }

  if (cursor < code.length) parts.push(code.slice(cursor))

  return parts.join('').replace(/\n{3,}/g, '\n\n')
}
