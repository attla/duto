import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { IMPORT, JSJSON } from 't0n'

import type { Metadata, I18nMetadata } from '#/compiler/types'

import intl from './client'

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
  if (['locales', 'fallbackLocale', 'options'].some(i => !mod[i]))
    return {} as I18nMetadata

  // const routes = Object.fromEntries(mod.locales.map(locale => [locale, ]))

  const routes: Record<string, Record<string, string>> = {}
  const messages: Record<string, Record<string, string>> = {}
  for (const locale of mod.locales) {
    const intlPath = join(meta.root, 'i18n', locale + '.ts')
    if (existsSync(intlPath)) {
      const intlMod = await IMPORT<{default:{routes: Record<string, string>, messages: Record<string, string>}}>(intlPath)
      routes[locale] = intlMod.default.routes
      messages[locale] = intlMod.default.messages
    }
  }

  const i18n: I18nMetadata = {
    ...mod,
    routes,
    messages,
    routeMap: Object.fromEntries(
      Object.values(routes)
        .map(paths => Object.entries(paths).map(([key, path]) => path == key ? 0 : [path, key]).filter(Boolean))
        .flat() as Array<[string, string]>
    ),
    pageRoutes: [],
    string: '',
  }

  Object.entries(routes)
    .forEach(([locale, paths]) => {
       Object.entries(paths)
        .forEach(([route, path]) => i18n.pageRoutes.push({ locale, path }))
    })

  i18n.string = `export const fallbackLocale = ${JSJSON(mod.fallbackLocale)}
export const locales = ${JSJSON(mod.locales)}
export const messages = ${JSJSON(messages)}
export const routes = ${JSJSON(routes)}
export const routeMap = ${JSJSON(i18n.routeMap)}
export const pageRoutes = ${JSJSON(i18n.pageRoutes)}
export const options = ${JSJSON(mod.options)}
`

  intl(i18n.fallbackLocale, i18n.locales, messages, routes, i18n.routeMap)
  return meta.i18n = i18n
}
