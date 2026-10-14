// @ts-ignore
import ':duto/hmr'

import { render, h, type ComponentChild } from 'preact'
import { flushSync, useLayoutEffect, useState } from 'preact/compat'
import { Switch, Route, Router } from 'wouter-preact'
import { useLocation, useParams, useSearchParams, } from 'wouter-preact'
import type { AroundNavHandler } from 'wouter-preact'
import type { Params, StaticProps, View } from '#/compiler/types'


import { setThemeAttr, getTheme } from './theme'

setThemeAttr(getTheme())

// @ts-ignore
import { fallbackLocale, locales, routeMap } from ':duto/i18n'
// import i18n from '../i18n/client'
import i18n, {
  detect, isPrefixed,
  getLocale, setLocale,
  cache, cached,
  redirect,
  route,
  d, t, tl,
  updatePickers,
} from '../i18n/client'

await i18n(fallbackLocale, locales, {}, {}, routeMap)

// Custom elements
import EI18n from '../i18n/element'
import Link from './link'

for (let [tag, el, opts] of [
  ['i-i', EI18n],
  ['i-l', Link, { extends: 'a' }],
] as [string, new () => HTMLElement, ElementDefinitionOptions?][]) {
  !customElements.get(tag) && customElements.define(tag, el, opts)
}

import {
  views,
// @ts-ignore
} from ':duto'
// @ts-ignore
import ':root/styles'


// var props = {}
// const propKey = "props"
// const script = document.currentScript || ('function' == typeof document.querySelector ? document.querySelector(`script[${propKey}]`) : void 0)
// if (script) {
//   const opts = script.getAttribute(propKey)
//   if (opts) {
//     try {
//       props = JSON.parse(opts)
//     } catch (e) { }
//   }
// }

// @ts-ignore
self.$duto = self.$duto || {}
// @ts-ignore
Object.assign($duto, {
  // props,
  // location: '/',
  // navigate: {},
  // params: {},
  // search: {},
  // setSearch: {},
  i18n: {
    detect, isPrefixed,
    getLocale, setLocale,
    cache, cached,
    redirect,
    route,
    d, t, tl,
  },
})


function normalizeParams(
  raw: Record<string, string>,
  paramDefs: Params
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {}
  for (const def of paramDefs) {
    const val = raw[def.name]
    if (def.catchAll) {
      result[def.name] = val
        ? val.split('/').filter(Boolean)
        : def.optional ? undefined : []
    } else {
      result[def.name] = val === undefined && def.optional ? undefined : val
    }
  }
  return result
}

async function resolveRoute(
  [, Component, defs, getProps, layouts]: View,
  rawParams: Record<string, string>,
) {
  let props: StaticProps = defs ? normalizeParams(rawParams, defs) : { ...rawParams },
    sProps = null

  if (typeof Component === 'string') {
    const mod = await import((Component[0] == '/' ? '' : '/')+ Component)
    Component = mod.default
    getProps = getProps === 1 ? mod.getProps : 0
    sProps = mod.props ?? null
  }

  // @ts-ignore
  // const sProps = $duto?.props
  // if (sProps && typeof sProps === 'object') { // @ts-ignore
  //   $duto.props = null
  //   Object.assign(props, sProps)
  // } else

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

  let el = h(Component, props as any)
  for (const layout of [layouts ?? []].flat())
    el = h(layout, null, el)

  return el
}

const promises = new Map<string, Promise<ComponentChild>>()
const resolved = new Map<string, ComponentChild>()
let last: ComponentChild = null

const keyOf = (view: View, params: Record<string, string>) => view[0] + '|' + JSON.stringify(params)
function load(view: View, params: Record<string, string>) {
  const key = keyOf(view, params)
  if (!promises.has(key)) {
    promises.set(key, resolveRoute(view, params).then((el) => {
      resolved.set(key, el)
      return el
    }))
  }
  return promises.get(key)
}

function View({ view, params }: { view: View, params: Record<string, string>}) {
  const { 0: _wild, ...clean } = params
  const key = keyOf(view, clean)

  const [loaded, setLoaded] = useState(() => resolved.get(key) ?? last)
  const el = resolved.get(key) ?? loaded
  if (resolved.has(key)) last = el

  useLayoutEffect(() => {
    let cancelled = false
    $duto.route = { pattern: view[0], params: clean, path: location.pathname }

    load(view, clean).then(el => {
      if (cancelled) return
      last = el
      setLoaded(el)
      // dispatchEvent(new CustomEvent('d:load'))
    })
    return () => { cancelled = true }
  }, [key])

  return el
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
  {h(() => {
    if ($duto?.location) return
    document.body.removeAttribute('hidden')

    const [location, navigate] = useLocation()
    $duto.location = location
    $duto.navigate = (to, options) => {
      // console.log(to, options)
      // to = new URL(to).pathname
      navigate(to, options)
    }
    $duto.params = useParams()

    const [search, setSearch] = useSearchParams()
    $duto.search = search
    $duto.setSearch = setSearch

    updatePickers()
    dispatchEvent(new CustomEvent('d:load'))
  })}
  <Switch>
    {views.map(v => (
      <Route key={v[0]} path={v[0]}>
        {(params) => <View view={v} params={params} />}
      </Route>
    ))}
  </Switch>
</Router>, document.body)
