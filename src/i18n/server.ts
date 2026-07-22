import { join } from 'node:path'
import { IMPORT, JSJSON } from 't0n'

import type { Metadata, I18nMetadata } from '@/types'
import { existsSync } from 'node:fs'

export default async function getI18n(meta: Metadata) {
  let file = ''

   for (const variant of [
    'i18n.ts',
    'i18n/index.ts',
  ]) {
     const path = join(meta.root, variant)
    if (existsSync(path)) {
      file = path
      break
    }
  }

  if (!file) return {} as I18nMetadata
  const mod = await IMPORT<I18nMetadata>(file)

  // @ts-ignore
  if (['locales', 'fallbackLocale', 'messages', 'routes', 'options'].some(i => !mod[i]))
    return {} as I18nMetadata

  const i18n: I18nMetadata = {
    ...mod,
    routeMap: Object.fromEntries(
      Object.values(mod.routes)
        .map(paths => Object.entries(paths).map(([key, path]) => path == key ? 0 : [path, key]).filter(Boolean))
        .flat() as Array<[string, string]>
    ),
    pageRoutes: [],
    string: '',
  }

  Object.entries(mod.routes)
    .forEach(([locale, paths]) => {
       Object.entries(paths)
        .forEach(([route, path]) => i18n.pageRoutes.push({ locale, path }))
    })

  i18n.string = `export const fallbackLocale = ${JSJSON(mod.fallbackLocale)}
export const locales = ${JSJSON(mod.locales)}
export const messages = ${JSJSON(mod.messages)}
export const routes = ${JSJSON(mod.routes)}
export const routeMap = ${JSJSON(mod.routeMap)}
export const pageRoutes = ${JSJSON(mod.pageRoutes)}
export const options = ${JSJSON(mod.options)}
`
  return i18n
}
