// @ts-ignore
import ':duto/hmr'

import { render, hydrate, h } from 'preact'
import { Switch, Route, Router } from 'wouter-preact'
import { useLocation, useParams, useSearchParams, } from 'wouter-preact'

// @ts-ignore
import { fallbackLocale, locales, routeMap } from ':duto/i18n'
// import i18n from '../i18n/client'
import i18n, { updatePickers } from '../i18n/client'

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
  views, SRoutes,
// @ts-ignore
} from ':duto'
// @ts-ignore
import ':root/styles'


// window.$duto = {
//   sroutes: SRoutes,
//   location: '/',
//   navigate: {},
//   params: {},
//   search: {},
//   setSearch: {},
// }
import { renderRoute } from './router'

render(<Router>
  {h(() => {
    document.body.removeAttribute('hidden')
    self.$duto = self.$duto || {}
    self.$duto.sroutes = SRoutes
    const [location, navigate] = useLocation()
    self.$duto.location = location
    self.$duto.navigate = navigate
    self.$duto.params = useParams()

    const [search, setSearch] = useSearchParams()
    self.$duto.search = search
    self.$duto.setSearch = setSearch

    updatePickers()
  }, null)}
  <Switch>
    {/* @ts-ignore */}
    {...views.map(([path, Component, defs, getProps, layouts]) => (
      <Route path={path} component={({ params }: { params: Record<string, string> }) => {
        // Trigger async render (updates container imperatively to avoid
        // React/Preact hook rules issues with async components)

        delete params[0]
        window.$duto.route = { pattern: path, params, path: location.pathname }

        renderRoute(document.body, Component, params, defs, getProps, layouts)
        // Return null — renderRoute will call render() directly on the container
        return null
      }} />
    ))}
  </Switch>
</Router>, document.body)
