import { h, type JSX } from 'preact'
import { local } from '#/storage'
import { navigate } from '..'

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

const detect = (locales: string[], defaultLocale: string) => {
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
let _routes: Record<string, Record<string, string>> = {}
let _routeMap: Record<string, string> = {}

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

export const setLocale = (lang: string) => {
  cache(lang)
  _locale = accepted(lang, _locales, _detected)
}

export default function i18n(
  fallbackLocale: string,
  locales: string[],
  messages: Record<string, Record<string, string>>,
  routes: Record<string, Record<string, string>>,
  routeMap: Record<string, string>,
) {
  _locales = locales
  _messages = messages
  _routes = routes
  _routeMap = routeMap
  _detected = detect(locales, fallbackLocale)
  _locale = typeof window === 'undefined' ? fallbackLocale : getLocale()

  // console.error(routes)
  // console.error(routeMap)
}

export const cache = (val: string) => local.set('lang', accepted(val, _locales, ''))
export const cached = () => local.get('lang') as string || ''

export const updateWidth = (el: HTMLSelectElement) => {
  if (el) {
    const option = el.querySelector(`option[value="${el.value}"]`) as HTMLOptionElement
    const length = option.textContent.split(' ')[0]?.length || 0
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

export const route = (route = '', lang?: string) => {
  lang ??= accepted(lang, _locales, _locale)
  const path = _routeMap[route]
  return _routes[lang][path ? path : route] || _routes[lang]?.notfound || undefined
}

export const redirect = (key = '', lang?: string) => r(key, lang)
export const r = (key: string, lang?: string) => {
  lang ??= accepted(lang, _locales, _locale)
  const path = '/'+ lang + (key ? '/'+ route(key, lang) : '')

  if (!location.pathname.endsWith(path))
    navigate(path)

  // return '/' + lang + '/' + (key in _routes[lang] ? _routes[lang][key] : key)
}
// export const redirect = (r = '', lang?: string) => {
//   lang = accepted(lang, _locales, _locale)
//   const path = '/'+ lang + (r ? '/'+ route(r, lang) : '')

//   if (!location.pathname.endsWith(path))
//     location.pathname = path
// }

////////////////////////////////////////////////////////////////////////////////

type Primitives = string | number | boolean

type TFunc = {
  (key: string, lang?: string): string
  (key: string, params: Record<string, Primitives>, lang?: string): string
  (key: string, params: Primitives[], lang?: string): string
  (strings: TemplateStringsArray, ...values: Primitives[]): string & JSX.Element
  (props: TProps): JSX.Element
}

type TProps = {
  s?: string
  children?: string
  lang?: string
  params?: Record<string, Primitives> | Primitives[]
}

const lookup = (key: string, lang: string): string => {
  if (!key) return '';
  if (key.startsWith('_')) return key.replace(/^_+/, '');
  const msg = _messages[lang] ?? _messages[_locale];
  return (key in msg ? msg[key] : key) as string;
}

const interpolate = (template: string, params: Record<string, Primitives> | Primitives[]): string => {
  if (Array.isArray(params))
    return template.replace(/\{(\d+)\}/g, (_, i) => String(params[Number(i)] ?? `{${i}}`))

  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

const taggedKey = (strings: TemplateStringsArray, values: Primitives[]): string =>
  strings.reduce((acc, s, i) => acc + s + (values[i] !== undefined ? `%${i}%` : ''), '');

const resolveTagged = (strings: TemplateStringsArray, values: Primitives[], lang: string): string => {
  const template = lookup(taggedKey(strings, values), lang)
  return values.reduce((acc, val, i) => acc.replace(`%${i}%`, String(val)), template)
}

// --- VNode que se comporta como string em qualquer coerção ---
const hybridNode = (key: string, resolved: string, lang?: string, params?: TProps['params']) => {
  const attrs: Record<string, string> = { s: key, children: resolved }
  if (lang) attrs.lang = lang
  if (params) attrs.params = JSON.stringify(params)

  const vnode = h('i-i', attrs) as unknown as Record<string | symbol, unknown>

  const _attrs = { value: () => resolved, enumerable: false }
  Object.defineProperty(vnode, 'toString', _attrs)
  Object.defineProperty(vnode, 'valueOf', _attrs)
  vnode[Symbol.toPrimitive] = () => resolved

  return vnode as unknown as string & JSX.Element
}

const isJSXProps = (val: unknown): val is TProps =>
  typeof val === 'object' && val !== null && !Array.isArray(val) && !('raw' in val)

export const t = ((first: string | TemplateStringsArray | TProps, ...rest: unknown[]): unknown => {

  // --- JSX: <t s='home' /> ou <t>home</t> ---
  if (isJSXProps(first)) {
    const { s, children, lang, params } = first;
    const key = s ?? children ?? '';
    const resolved = params
      ? interpolate(lookup(key, lang ?? _locale), params)
      : lookup(key, lang ?? _locale);

    return hybridNode(key, resolved, lang, params)
  }

  // --- Tagged template: t`home` ou t`Bem-vindo ${name}` ---
  if (Array.isArray(first) && 'raw' in first) {
    const strings = first as TemplateStringsArray;
    const values = rest as Primitives[];
    const key = taggedKey(strings, values);
    const resolved = resolveTagged(strings, values, _locale);

    return hybridNode(key, resolved);
  }

  // --- Chamada normal: t('key', ...) ---
  const key = first as string;
  const lang = () => typeof rest[rest.length - 1] === 'string' ? rest[rest.length - 1] as string : _locale;

  if (typeof rest[0] === 'object' && rest[0] !== null)
    return interpolate(lookup(key, lang()), rest[0] as Record<string, Primitives> | Primitives[]);

  return lookup(key, rest[0] && typeof rest[0] === 'string' ? rest[0] : _locale)
}) as TFunc

export const tl = (lang: string) =>
  (strings: TemplateStringsArray, ...values: Primitives[]): string =>
    resolveTagged(strings, values, lang);
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

// export default function i18n(
//   fallbackLocale: string,
//   locales: string[],
//   messages: Record<string, Record<string, string>>,
//   routes: Record<string, Record<string, string>>,
//   routeMap: Record<string, string>,
// ) {
// 		// const fallbackLocale = 'pt-br'
// 		// const locales = ['pt-br', 'en']

// 		const localeRegex = new RegExp(`^/(${locales.join('|')})(/|$)`)
// 		const matched = window.location.pathname.match(localeRegex)

// 		const detected = detect(locales, fallbackLocale)
// 		const locale = matched ? matched[1] : detected

// 		return {
// 			detected,
// 			locale,
// 			locales,
// 			cache(val: string) {
// 				localStorage.setItem('lang', accepted(val, locales, ''))
// 			},
// 			cached() {
// 				return localStorage.lang || ''
// 			},
// 			updateWidth (el: HTMLSelectElement) {
// 				if (el) {
// 					const option = el.querySelector(`option[value="${el.value}"]`) as HTMLOptionElement
// 					const length = option.textContent.split(' ')[0]?.length || 0
// 					el.style.width = (length * 15.7)+ 'px'
// 				}
// 			},
// 			updatePickers(lang = '') {
// 				lang = accepted(lang, locales, locale)
// 				document.querySelectorAll('.locale-select').forEach(el => {
// 					const select = el.querySelector('select')
// 					if (select) {
// 						select.value = lang
// 						this.updateWidth(select)
// 					}
// 				})
// 			},
// 			route(route = '', lang?: string) {
// 				lang = accepted(lang, locales, locale)
// 				const path = routeMap[route]
// 				return routes[lang][path ? path : route] || routes[lang]?.notfound || undefined
// 			},
// 			redirect(route = '', lang?: string) {
// 				lang = accepted(lang, locales, locale)
// 				const path = '/'+ lang + (route ? '/'+ this.route(route, lang) : '')

// 				if (!window.location.pathname.endsWith(path))
// 					window.location.pathname = path
//       },

//       t(key: string, lang?: string) {
//         lang ??= accepted(lang, locales, locale)
//         const msg = messages[lang]

//         if (key && !key.startsWith('_') && key in msg)
//           return msg[key]

//         return key?.replace(/^_+/, '')
//       },
//       r(key: string, lang?: string) {
//         lang ??= accepted(lang, locales, locale)

//         return '/' + lang + '/' + (key in routes[lang] ? routes[lang][key] : key)
//       },
//       d(str: string, format?: string, lang?: string) {
//         lang ??= accepted(lang, locales, locale)

//         const date = new Date(str+ 'T00:00:00')
//         if (isNaN(date.getTime())) return str

//         if (format && !['short', 'long'].includes(format)) {
//           const year = date.getFullYear(),
//             month = date.getMonth(),
//             day = date.getDate(),
//             formatter = new Intl.DateTimeFormat(lang, {month: 'long'}),
//             monthName = formatter.format(date),
//             shortFormatter = new Intl.DateTimeFormat(lang, {month: 'short'}),
//             shortMonthName = shortFormatter.format(date)

//           return fixDate(format
//             .replace(/YYYY/g, year.toString())
//             .replace(/YY/g, year.toString().slice(-2))
//             .replace(/MMMM/g, monthName)
//             .replace(/MMM/g, shortMonthName)
//             .replace(/MM/g, (month + 1).toString().padStart(2, '0'))
//             .replace(/M/g, (month + 1).toString())
//             .replace(/DD/g, day.toString().padStart(2, '0'))
//             .replace(/D/g, day.toString()))
//             // .replace(/de/g, (match, offset, val) => val.lastIndexOf('de', offset - 1) === -1 ? match : '')
//         }

//         return fixDate(new Intl.DateTimeFormat(lang, {
//           // dateStyle: 'full',
//           year: 'numeric',
//           month: format == 'short' ? 'short' : 'long',
//           day: 'numeric',
//         }).format(date))
//       },
// 		}
// }
