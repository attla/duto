// @ts-ignore
import ':duto/hmr'

import { render, h, Fragment, type ComponentChild, type ComponentType } from 'preact'
import { flushSync, useLayoutEffect, useReducer, useRef } from 'preact/compat'
import { Router, useLocation, useParams, useSearchParams, useRouter, matchRoute } from 'wouter-preact'
import type { AroundNavHandler } from 'wouter-preact'
import type { Params, StaticProps, View, Layout as LayoutDef } from '#/compiler/types'


import { setThemeAttr, getTheme } from './theme'
// @ts-ignore
setThemeAttr(getTheme())

// @ts-ignore
import { fallbackLocale, locales } from ':duto/i18n'
import i18n, {
  detect, isPrefixed,
  getLocale, setLocale,
  cache, cached,
  redirect,
  route,
  d, t, tl,
} from '../i18n/client'

await i18n(fallbackLocale, locales, {}, {})

// Custom elements
import EI18n from '../i18n/element'
import Link from './link'

import {
  views,
  layouts,
// @ts-ignore
} from ':duto'
// @ts-ignore
import ':root/css'

// @ts-ignore
self.$duto = self.$duto || {}
// @ts-ignore
Object.assign($duto, {
  i18n: {
    detect, isPrefixed,
    getLocale, setLocale,
    cache, cached,
    redirect,
    route,
    d, t, tl,
  },
})

type NormalizedParams = Record<string, string | string[] | undefined>

function normalizeParams(
  raw: Record<string, string>,
  defs: Params,
): NormalizedParams {
  const result: NormalizedParams = {}

  for (let i = 0, len = defs.length; i < len; i++) {
    const def = defs[i]
    const name = def[0]
    const flags = def[1]
    const val = raw[name]

    if (flags & 2) {
      if (!val) {
        result[name] = flags & 1 ? undefined : []
        continue
      }

      const parts = val.split('/')
      let count = 0

      for (let j = 0, n = parts.length; j < n; j++) {
        if (parts[j]) {
          parts[count++] = parts[j]
        }
      }

      parts.length = count
      result[name] = parts
    } else {
      result[name] =
        val === undefined && (flags & 1) !== 0
          ? undefined
          : val
    }
  }

  return result
}

// ───────────────────────────────────────────────────────────────
// Layouts
//
// `layouts: Layout[]` global. Um layout vale para toda URL que começa
// com o seu `path` (match "loose" do wouter, respeitando fronteira de
// segmento: '/users' vale p/ '/users/12/dashboard', não p/ '/users-x').
// A hierarquia é a profundidade do path (menos segmentos = mais externo),
// então a ordem do array não importa.
// ───────────────────────────────────────────────────────────────

type LayoutComp = ComponentType<any>
type Rendered = { layouts: LayoutComp[], page: ComponentChild }

const imp = (p: string) => import((p[0] == '/' ? '' : '/') + p)

const depthOf = (p: string) => p.split('/').filter(Boolean).length
const sortedLayouts: LayoutDef[] = [...(layouts as LayoutDef[])]
  .sort((a, b) => depthOf(a.path) - depthOf(b.path)) // sort é estável

const layoutCache = new Map<LayoutDef, Promise<LayoutComp>>()

// Mesmo Layout => mesma referência de componente (o Preact só preserva
// a instância se o `type` for idêntico entre duas rotas).
function resolveLayout(l: LayoutDef): Promise<LayoutComp> {
  let p = layoutCache.get(l)
  if (!p) {
    p = typeof l.view === 'string'
      ? imp(l.view).then(m => m.default as LayoutComp)
      : Promise.resolve(l.view as LayoutComp)
    p.catch(() => layoutCache.delete(l))
    layoutCache.set(l, p)
  }
  return p
}

// ───────────────────────────────────────────────────────────────
// Resolução de rota
// ───────────────────────────────────────────────────────────────

// View[4]: componente de Loading, ou string de caminho.
// Se for string, usa o export `Loading` do módulo; se o caminho for
// diferente de View[1] e não houver `Loading`, cai no `default`.
async function resolveLoading(view: View): Promise<LayoutComp | undefined> {
  const L = view[4] as any
  if (!L) return
  if (typeof L !== 'string') return L
  const mod = await imp(L)
  return mod.Loading ?? (L === view[1] ? undefined : mod.default)
}

async function resolveRoute(
  view: View,
  rawParams: Record<string, string>,
  matched: LayoutDef[],
  onLoading: (r: Rendered) => void,
): Promise<Rendered> {
  let Component = view[1] as any
  let getProps = view[3] as any
  const defs = view[2]

  let props: StaticProps = defs ? normalizeParams(rawParams, defs) : { ...rawParams },
    sProps = null

  const layoutsP = Promise.all(matched.map(resolveLayout))
  const pageP = typeof Component === 'string' ? imp(Component) : null
  layoutsP.catch(() => { })
  pageP?.catch(() => { })

  // Loading só faz sentido quando há getProps a esperar. É renderizado
  // ANTES do getProps() (e antes mesmo do import da página terminar,
  // se o Loading vier de um módulo separado).
  if (getProps) {
    const Loading = await resolveLoading(view)
    if (Loading) {
      onLoading({
        layouts: await layoutsP,
        page: h(Fragment, { key: viewId(view) + ':loading' }, h(Loading, props as any)),
      })
    }
  }

  if (pageP) {
    const mod = await pageP
    Component = mod.default
    getProps = getProps === 1 ? mod.getProps : 0
    sProps = mod.props ?? null
  }

  if (typeof getProps === 'function') {
    try {
      props = {
        ...(await getProps(props as Record<string, string | string[] | undefined>, sProps)),
        ...props
      }
    } catch (e) {
      console.error('[ssg] getProps failed:', e)
    }
  } else if (sProps && typeof sProps === 'object' && !Array.isArray(sProps)) {
    Object.assign(props, sProps)
  }

  return {
    layouts: await layoutsP,
    page: h(Fragment, { key: viewId(view) }, h(Component, props as any)),
  }
}

type Entry = {
  promise: Promise<Rendered>
  loading: Rendered | null
  on: Set<(r: Rendered) => void>
}

const entries = new Map<string, Entry>()
const resolved = new Map<string, Rendered>()

const patternsOf = (view: View): string[] => Array.isArray(view[0]) ? view[0] : [view[0]]
const viewId = (view: View) => patternsOf(view).join('|')
function matchView(
  parser: any,
  view: View,
  location: string,
): [pattern: string, params: Record<string, string>] | null {
  for (const pattern of patternsOf(view)) {
    const [ok, p] = matchRoute(parser, pattern, location)
    if (ok) return [pattern, (p ?? {}) as Record<string, string>]
  }
  return null
}

const keyOf = (view: View, params: Record<string, string>, matched: LayoutDef[]) =>
  viewId(view) + '|' + JSON.stringify(params) + '|' + matched.map(l => l.path).join(',')

function load(view: View, params: Record<string, string>, matched: LayoutDef[], key: string): Entry {
  let e = entries.get(key)
  if (!e) {
    const entry: Entry = { loading: null, on: new Set(), promise: null as any }
    entry.promise = resolveRoute(view, params, matched, (r) => {
      entry.loading = r
      entry.on.forEach(fn => fn(r))
    }).then(
      (r) => (resolved.set(key, r), r),
      (err) => (entries.delete(key), Promise.reject(err)),
    )
    entries.set(key, e = entry)
  }
  return e
}

// ───────────────────────────────────────────────────────────────
// Árvore estável de layouts
//
// Equivalente lógico a:
//   <Layout> <LayoutUsers> <Page/> </LayoutUsers> </Layout>
// Cada <Outlet depth={n}> renderiza layouts[n] (com <Outlet n+1> dentro)
// ou, ao fim da cadeia, a página. Cada Outlet só re-renderiza quando o
// que ele exibe muda: se o layout[n] é o mesmo entre duas rotas, a
// instância (estado + DOM) é mantida e nem a função do layout reexecuta.
// ───────────────────────────────────────────────────────────────

let slot: Rendered = { layouts: [], page: null }
const subs = new Set<() => void>()

const pick = (depth: number): unknown => slot.layouts[depth] ?? slot.page

function setSlot(r: Rendered) {
  slot = r
  subs.forEach(fn => fn())
}

function Outlet({ depth }: { depth: number }) {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const seen = useRef<unknown>(null)
  seen.current = pick(depth)

  useLayoutEffect(() => {
    const check = () => {
      const next = pick(depth)
      if (next !== seen.current) {
        seen.current = next
        bump(0)
      }
    }
    subs.add(check)
    check() // pega mudança ocorrida entre o render e o effect
    return () => { subs.delete(check) }
  }, [depth])

  const Layout = slot.layouts[depth]
  return Layout ? h(Layout, null, h(Outlet, { depth: depth + 1 })) : slot.page
}

function App() {
  const { parser } = useRouter()
  const [location] = useLocation()

  // primeira view que casar vence
  let pattern = ''
  let view: View | null = null
  let params: Record<string, string> = {}
  for (const v of views as View[]) {
    const m = matchView(parser, v, location)
    if (m) {
      view = v
      ;[pattern, params] = m
      break
    }
  }

  const matched = sortedLayouts.filter(l => matchRoute(parser, l.path, location, true)[0])

  const { 0: _wild, ...clean } = params
  const key = view ? keyOf(view, clean, matched) : ''

  useLayoutEffect(() => {
    if (!view) {
      setSlot({ layouts: [], page: null })
      return
    }

    // @ts-ignore
    $duto.route = { pattern, params: clean, path: location }

    const done = resolved.get(key)
    if (done) {
      setSlot(done)
      return
    }

    let cancelled = false
    const entry = load(view, clean, matched, key)
    const onLoading = (r: Rendered) => { if (!cancelled) setSlot(r) }

    if (entry.loading) onLoading(entry.loading)
    entry.on.add(onLoading)
    entry.promise
      .then(r => { if (!cancelled) setSlot(r) })
      .catch(e => console.error('[route] load failed:', e))

    return () => {
      cancelled = true
      entry.on.delete(onLoading)
    }
  }, [key, pattern])

  return <Outlet depth={0} />
}


// enable view transitions for navigation
const aroundNav: AroundNavHandler = (navigate, to, options) => {
  // feature detection for browsers that dont support View Transitions
  if (!document.startViewTransition)
    return navigate(to, options)

  // only use view transitions if explicitly requested
  options?.transition
   ? document.startViewTransition(() => flushSync(() => navigate(to, options)))
   : navigate(to, options)
}

// clean prerendered content
while (document.body.firstChild)
  document.body.removeChild(document.body.firstChild)

render(<Router aroundNav={aroundNav}>
  {/* @ts-ignore */}
  {h(() => {
    // @ts-ignore
    if ($duto?.$) return
    document.body.removeAttribute('hidden')

    const [,navigate] = useLocation()
    // @ts-ignore
    $duto.$ = true
    // @ts-ignore
    $duto.navigate = navigate
    // @ts-ignore
    $duto.params = useParams()

    const [search, setSearch] = useSearchParams()
    // @ts-ignore
    $duto.search = search
    // @ts-ignore
    $duto.setSearch = setSearch

    for (let [tag, el, opts] of [
      ['i-i', EI18n],
      ['i-l', Link, { extends: 'a' }],
    ] as [string, new () => HTMLElement, ElementDefinitionOptions?][]) {
      !customElements.get(tag) && customElements.define(tag, el, opts)
    }

    dispatchEvent(new CustomEvent('@load'))
  })}
  <App />
</Router>, document.body)
