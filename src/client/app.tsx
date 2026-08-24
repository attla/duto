// @ts-ignore
import ':duto/client/hmr'

import { render, hydrate, h } from 'preact'
import { Switch, Route, Router } from 'wouter-preact'
import { useLocation, useParams, useSearchParams, } from 'wouter-preact'

import {
  fallbackLocale, locales, messages, routes, routeMap,
// @ts-ignore
} from ':duto/i18n'
// import i18n from '../i18n/client'
import i18n, { updatePickers } from '../i18n/client'

i18n(fallbackLocale, locales, messages, routes, routeMap)

import EI18n from '../i18n/element'
import Island from './island'
import Link from './link'

// import Router from './router'

import {
  views, SRoutes,
// @ts-ignore
} from ':duto'
// @ts-ignore
import ':root/styles'

window.$duto = {
  sroutes: SRoutes,
  location: '/',
  navigate: {},
  params: {},
  search: {},
  setSearch: {},
}
import { renderRoute } from './router'
// import { navigate } from 'wouter-preact/use-hash-location'

for (let [tag, el, opts] of [
  ['i-i', EI18n],
  ['i-l', Link, { extends: 'a' }],
  ['i-s', Island],
] as [string, new () => HTMLElement, ElementDefinitionOptions?][]) {
  if (!customElements.get(tag))
    customElements.define(tag, el, opts)
}
// Router.load(SRoutes).mount(views)

// render(h(Router, null,
//   h(() => {
//     // const __ = useRoute(location.pathname)
//     document.body.removeAttribute('hidden')
//     const [, navigate] = useLocation()
//     // console.log(navigate)
//     // this.navigate = navigate

//     // TODO: talvez registrar todos os valores pelo id do elemento em uma fila e atualizar nesse tick...
//     // input, select etc registra um update val e aqui popula..
//     updatePickers()
//     return null
//   }, null),
//   h(Switch, null,
//     h(Route, { path: SRoutes.has(location.pathname) ? location.pathname : '/' }),
//     ...views.map(([path, Component, defs, getProps]) =>
//     h(Route, {
//       path,
//       component: ({ params }: { params: Record<string, string> }) => {
//         // Trigger async render (updates container imperatively to avoid
//         // React/Preact hook rules issues with async components)

//         renderRoute(document.body, Component, params, defs, getProps)
//         // Return null — renderRoute will call render() directly on the container
//         return null
//       },
//     })
//   ),

// ) ), document.body)
render(<Router>
  {h(() => {
    document.body.removeAttribute('hidden')
    const [location, navigate] = useLocation()
    window.$duto.location = location
    window.$duto.navigate = navigate
    window.$duto.params = useParams()
    const [search, setSearch] = useSearchParams()
    window.$duto.search = search
    window.$duto.setSearch = setSearch

    // TODO: talvez registrar todos os valores pelo id do elemento em uma fila e atualizar nesse tick...
    // input, select etc registra um update val e aqui popula..
    updatePickers()

    // React.useEffect(() => {
    //   document.body.removeAttribute('hidden');
    //   navigateRef.current = navigate;
    //   updatePickers();
    // }, [navigate]);
    // return null;
  }, null)}
  <Switch>
    <Route path={SRoutes.has(location.pathname) ? location.pathname : '/'} component={({ params }) => {
      delete params[0]
      window.$duto.route = { pattern: location.pathname, params, path: location.pathname }
    }} />
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
