import { h, type JSX } from 'preact'
import { on, emit } from 't0n'
import { local } from '#/client/storage'

const sync = async e => {
  _locale = e?.val ? e.val : getLocale()
  await loadLang(_locale)
  emit('@i18n', e)
}

on('popstate', sync)
on('pushState', sync)
on('replaceState', sync)
on('hashchange', sync)
on('s:lang', sync)

const accepted = (lang: string | undefined, locales: string[] = [], fallback: string) => lang && locales.includes(lang) ? lang : fallback

const splitLang = (lang: string) => {
  let arr = []
  if (lang.indexOf('-') > -1) {
    arr = lang.split('-')
  } else if (lang.indexOf('_') > -1) {
    arr = lang.split('_')
  } else {
    arr = [lang]
  }

  return arr.map(v => v.toLowerCase())
}

const isAccepted = (lang: string, locales: string[] = []) => {
  if (locales.includes(lang)) return true

  for (var locale in locales) {
    if (locale == lang || lang.startsWith(locale) || lang.endsWith(locale)) return true
  }

  return false
}

const getAccepted = (lang: string, locales: string[] = [], defaultLocale = '') => {
  if (!lang || !locales?.length) return defaultLocale

  lang = lang.toLowerCase()

  const spl = splitLang(lang)

  for (var key in spl) {
    if (isAccepted(spl[key], locales)) return spl[key]
  }

  return defaultLocale
}

export const detect = (locales: string[], defaultLocale: string) => {
  if (!defaultLocale) defaultLocale = 'en'
  if (typeof window === 'undefined') return defaultLocale

  locales = locales.map(l => l.toLowerCase())

  if (window?.navigator?.languages)
    return window.navigator.languages.map(lang => getAccepted(lang, locales)).filter(Boolean)[0] || defaultLocale

  // @ts-ignore
  return getAccepted(window?.navigator?.language || window.navigator?.userLanguage || '', locales, defaultLocale)
}


const fixDate = (str: string) => str.replace(/de/g, (match, offset, val) => val.lastIndexOf('de', offset - 1) === -1 ? match : '').replace(/\s+/g, ' ').trim()

let _locales: string[] = []
let _messages: Record<string, Record<string, string>> = {}
let _paths: Record<string, Record<string, string>> = {}
// let _routeMap: Record<string, string> = {}

let _locale: string = ''
let _detected: string = ''
export let _prefixed: boolean = false

export const isPrefixed = () => _prefixed

export const getLocale = () => {
  if (typeof window === 'undefined') {
    return cached() || _detected
  } else {
    const matched = window?.location?.pathname.match(new RegExp(`^/(${_locales.join('|')})(/|$)`))
    if (matched && matched[1]) {
      _prefixed = true
      return matched[1]
    }

    _prefixed = false
    return cached() || _detected
    // return matched && matched[1] ? matched[1] : cached() || _detected
  }
}

export const setLocale = async (lang: string) => {
  _locale = accepted(lang, _locales, _detected)
  await loadLang(_locale)
  cache(_locale)
}

async function loadLang(lang: string) {
  if (!_paths[lang] || !_messages[lang]) {
    const intlMod = await import('/'+ lang +'.js')
    if (!intlMod) return
    _paths[lang] = intlMod.paths ?? intlMod.default?.paths
    _messages[lang] = intlMod.messages ?? intlMod.default?.messages
  }
}

export default async function i18n(
  fallbackLocale: string,
  locales: string[],
  messages: Record<string, Record<string, string>>,
  paths: Record<string, Record<string, string>>,
  // routeMap: Record<string, string>,
) {
  _locales = locales
  _messages = messages
  _paths = paths
  // _routeMap = routeMap
  _detected = detect(locales, fallbackLocale)
  _locale = typeof window === 'undefined' ? fallbackLocale : getLocale()

  await loadLang(_locale)
}

export const cache = (val: string) => local.set('lang', accepted(val, _locales, ''))
export const cached = () => local.get('lang') as string || ''

export const updateWidth = (el: HTMLSelectElement) => {
  if (el) {
    const option = el.querySelector(`option[value="${el.value}"]`) as HTMLOptionElement
    const length = option?.textContent.split(' ')[0]?.length || 0
    el.style.width = (length * 15.7)+ 'px'
  }
}
export const updatePickers = (lang?: string) => {
  lang ??= accepted(lang, _locales, _locale)

  document.querySelectorAll('.locale-select').forEach(el => {
    const select = el.querySelector('select')
    if (select) {
      select.value = lang
      updateWidth(select)
    }
  })
}

export const route = (key = '', lang?: string) => {
  lang ??= accepted(lang, _locales, _locale)
  return (_prefixed ? '/'+ lang : '') + (key ? '/'+key.split('/').map(p => _paths[lang]?.[p] || p).join('/') : '')
}

export const redirect = (key = '', lang?: string) => {
  lang ??= accepted(lang, _locales, _locale)
  const path = route(key, lang)

  if (!location.pathname.endsWith(path)) // @ts-ignore
    self.$duto?.navigate(path)
}
////////////////////////////////////////////////////////////////////////////////
type Primitives = string | number | boolean
type Params = Record<string, Primitives> | Primitives[]
type Hybrid = string & JSX.Element

type TProps = {
  s?: string
  children?: string
  lang?: string
  params?: Params
}

type TFunc = {
  (key: string, lang?: string): Hybrid
  (key: string, params: Record<string, Primitives>, lang?: string): Hybrid
  (key: string, params: Primitives[], lang?: string): Hybrid
  (strings: TemplateStringsArray, ...values: Primitives[]): Hybrid
  (props: TProps): Hybrid
}
type TStrFunc = {
  (key: string, lang?: string): string
  (key: string, params: Record<string, Primitives>, lang?: string): string
  (key: string, params: Primitives[], lang?: string): string
}

const lookup = (key: string, lang: string): string => {
  if (!key) return ''
  if (key.startsWith('_')) return key.replace(/^_+/, '')

  const msg = _messages[lang] ?? _messages[_locale]
  return (msg && key in msg ? msg[key] : key) as string
}

// Um único regex serve para objeto ({name}) e array ({0}), já que arr['0'] === arr[0]
const interpolate = (template: string, params?: Params): string =>
  params
    ? template.replace(/\{(\w+)\}/g, (_, k: string) =>
        String((params as Record<string, Primitives>)[k] ?? `{${k}}`))
    : template

// t`Olá ${name}` -> 'Olá %0%'
const taggedKey = (strings: TemplateStringsArray, values: Primitives[]): string =>
  strings.reduce((acc, s, i) => acc + s + (i < values.length ? `%${i}%` : ''), '')

const resolveTagged = (strings: TemplateStringsArray, values: Primitives[], lang: string): string =>
  lookup(taggedKey(strings, values), lang)
    .replace(/%(\d+)%/g, (_, i: string) => String(values[Number(i)]))

// VNode que se comporta como string em qualquer coerção
const hybridNode = (key: string, text: string, lang?: string, params?: Params): Hybrid => {
  const attrs: Record<string, string> = { s: key, children: text }
  if (lang) attrs.lang = lang
  if (params) attrs.params = JSON.stringify(params)

  const toText = { value: () => text }

  return Object.defineProperties(h('i-i', attrs), {
    toString: toText,
    valueOf: toText,
    [Symbol.toPrimitive]: toText,
  }) as unknown as Hybrid
}

const parseArgs = (rest: unknown[]): { params?: Params; lang?: string } => {
  const [a, b] = rest

  return {
    params: a && typeof a === 'object' ? (a as Params) : undefined,
    lang: [b, a].find((v): v is string => typeof v === 'string'),
  }
}

const translate = (key: string, params?: Params, lang?: string): string =>
  interpolate(lookup(key, lang ?? _locale), params)

const render = (key: string, params?: Params, lang?: string): Hybrid =>
  hybridNode(key, translate(key, params, lang), lang, params)

// $t('key'), $t('key', lang), $t('key', params), $t('key', params, lang)
export const $ = ((key: string, ...rest: unknown[]): string => {
  const { params, lang } = parseArgs(rest)
  return translate(key, params, lang)
}) as TStrFunc

export const t = ((first: string | TemplateStringsArray | TProps, ...rest: unknown[]): Hybrid => {
  // t`home` ou t`Bem-vindo ${name}`
  if (Array.isArray(first)) {
    const strings = first as unknown as TemplateStringsArray
    const values = rest as Primitives[]

    return hybridNode(taggedKey(strings, values), resolveTagged(strings, values, _locale))
  }

  // <t s='home' /> ou <t>home</t>
  if (typeof first === 'object') {
    const { s, children, lang, params } = first as TProps

    return render(s ?? children ?? '', params, lang)
  }

  // t('key'), t('key', lang), t('key', params), t('key', params, lang)
  const { params, lang } = parseArgs(rest)
  return render(first, params, lang)
}) as TFunc

export const tl = (lang: string) =>
  (strings: TemplateStringsArray, ...values: Primitives[]): string =>
    resolveTagged(strings, values, lang)
////////////////////////////////////////////////////////////////////////////////

// export const t = (key: string, lang?: string) => {
//   lang ??= accepted(lang, _locales, _locale)
//   const msg = _messages[lang]

//   if (key && !key.startsWith('_') && key in msg)
//     return msg[key]

//   return key?.replace(/^_+/, '')
// }
export const d = (str: string, format?: string, lang?: string) => {
  lang ??= accepted(lang, _locales, _locale)

  const date = new Date(str+ 'T00:00:00')
  if (isNaN(date.getTime())) return str

  if (format && !['short', 'long'].includes(format)) {
    const year = date.getFullYear(),
      month = date.getMonth(),
      day = date.getDate(),
      formatter = new Intl.DateTimeFormat(lang, {month: 'long'}),
      monthName = formatter.format(date),
      shortFormatter = new Intl.DateTimeFormat(lang, {month: 'short'}),
      shortMonthName = shortFormatter.format(date)

    return fixDate(format
      .replace(/YYYY/g, year.toString())
      .replace(/YY/g, year.toString().slice(-2))
      .replace(/MMMM/g, monthName)
      .replace(/MMM/g, shortMonthName)
      .replace(/MM/g, (month + 1).toString().padStart(2, '0'))
      .replace(/M/g, (month + 1).toString())
      .replace(/DD/g, day.toString().padStart(2, '0'))
      .replace(/D/g, day.toString()))
      // .replace(/de/g, (match, offset, val) => val.lastIndexOf('de', offset - 1) === -1 ? match : '')
  }

  return fixDate(new Intl.DateTimeFormat(lang, {
    // dateStyle: 'full',
    year: 'numeric',
    month: format == 'short' ? 'short' : 'long',
    day: 'numeric',
  }).format(date))
}
