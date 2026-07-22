import { render, h } from 'preact'
// import { render, hydrate, h } from 'preact'
// import { useLocation, Switch, Route, Router } from 'wouter-preact'
// import { matchRoute } from 'wouter-preact'
// import type { Routes, IRoute } from '../types'
import type { Page, GetProps, IRoute } from '@/types'
// import { updatePickers } from '../i18n/client'

// type Route = [string, Page, IRoute['params'], GetProps]
// type Route = [string, Page] | [string, Page, IRoute['params']] | [string, Page, IRoute['params'], GetProps]
// type Routes = Route[]


// type WRouter = {
//   navigate: ((href: string) => void) | null,
//   routes: Set<string>,
//   load: (routes: Set<string>) => WRouter,
//   has: (path: string) => boolean,
//   // loaded: () => void,
//   mount: (routes: Routes) => void,
//   // App({ container }: {
//   //   container: HTMLElement;
//   // }): VNode<Attributes & RouterOptions & {
//   //     children: ComponentChild;
//   // }>,
// }

// export default {
//   navigate: null,
//   routes: new Set<string>(),
//   load(routes: Set<string>) {
//     this.routes = routes
//     return this
//   },
//   has(path: string) {
//     return this.routes.has(path)
//   },
//   // loaded() {
//   //   document.body.removeAttribute('hidden')
//   //   const [, navigate] = useLocation()
//   //   this.navigate = navigate

//   // },
//   mount(routes: Routes) {
//     // ( // If body it was server-rendered — hydrate instead of render
//     //   document.body.childElementCount > 0
//     //   ? hydrate
//     //   : render // @ts-ignore
//     // )(this.App(routes), document.body)

//     // @ts-ignore
//     render(this.App(routes), document.body)
//   },

//   App(routes: Routes, container: HTMLElement = document.body) {
//     return h(Router, null,
//       h(() => {
//         // const __ = useRoute(location.pathname)
//         // console.log(__)
//         document.body.removeAttribute('hidden')
//         const [, navigate] = useLocation()
//         this.navigate = navigate

//         // TODO: talvez registrar todos os valores pelo id do elemento em uma fila e atualizar nesse tick...
//         // input, select etc registra um update val e aqui popula..
//         updatePickers()
//         return null
//       }, null),
//       h(Switch,
//       null,


//       // ...[
//       //   ['/', 'index.tsx'],
//       //   ['/about', 'about.tsx'],
//       //   ['/blog/:slug', 'blog/[slug].tsx'],
//       //   ['/blog/:slug?', 'blog/[[slug]].tsx'],
//       //   ['/shop/*', 'shop/[...slug].tsx'],
//       //   ['/shop/*?', 'shop/[[...slug]].tsx'],
//       //   ['/:authorId/:postId', '[authorId]/[postId].tsx'],
//       //   ['/*', '404.tsx'],
//       //   ['/*', 'not-found.tsx'],
//       //   ['/users/*', 'users/not-found.tsx'],
//       // ].map(([path, name]) =>
//       //   h(Route, {
//       //     key: path,
//       //     path,
//       //     component: ({ params }: { params: Record<string, string> }) => {

//       //       renderRoute(container, () => h("div", { class: "p-8" }, h("h1",  { class: "text-white text-xl relative top-2", style: {zIndex:'999', position:'relative', padding: '12px'} }, name), dd(params)), params)
//       //       // renderRoute(container, () => h("pre", { class: "p-8" }, h("h1", null, JSON.stringify(params))), params)
//       //       return null
//       //     },
//       //   })
//       // ),


//       h(Route, {
//         path: this.has(location.pathname) ? location.pathname : '/',
//         component: () => null,
//       }),

//       ...routes.map(([path, Component, defs, getProps]) =>
//         h(Route, {
//           // key: path,
//           path,
//           component: ({ params }: { params: Record<string, string> }) => {
//             // Trigger async render (updates container imperatively to avoid
//             // React/Preact hook rules issues with async components)

//             renderRoute(container, Component, params, defs, getProps)
//             // Return null — renderRoute will call render() directly on the container
//             return null
//           },
//         })
//       ),

//     ) )


//   }
// } as WRouter

/** Captures wouter's navigate() so the duto:navigate event can call it */
// let _navigate: ((href: string) => void) | null = null

// ─── Page renderer ────────────────────────────────────────────────────────────

function normalizeParams(
  raw: Record<string, string>,
  paramDefs: IRoute['params']
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};
  for (const def of paramDefs) {
    const val = raw[def.name];
    if (def.catchAll) {
      result[def.name] = val
        ? val.split('/').filter(Boolean)
        : def.optional ? undefined : []
    } else {
      result[def.name] = val === undefined && def.optional ? undefined : val;
    }
  }
  return result
}

export async function renderRoute(
  container: HTMLElement,
  Component: Page,
  rawParams: Record<string, string>,
  paramDefs?: IRoute['params'],
  getProps?: GetProps,
  layouts?: Page[]
) {
  while (document.body.firstChild)
    document.body.removeChild(document.body.firstChild)

  // const params = normalizeParams(rawParams, paramDefs)
  // const mod    = await route._import()

  // let props: Record<string, unknown> = { ...params }


  let props: Record<string, unknown> = paramDefs ? normalizeParams(rawParams, paramDefs) : rawParams

  if (typeof getProps === 'function') {
    try { // TODO: melhorar tipagem do props
      const fetched = await Promise.resolve(getProps(props as Record<string, string | string[] | undefined>))
      props = { ...fetched, ...props }
    } catch (e) {
      console.error('[ssg] getProps failed:', e)
    }
  }

  let el = h(Component, props as any)

  const _layouts = layouts ? (Array.isArray(layouts) ? layouts : [layouts]) : []
  for (const layout of _layouts)
    el = h(layout, null, el)

  render(el, container)

 // TODO: melhorar tipagem do props
  // render(h(Component, props as any), container)
  // render(h(Component, props as any), container)
}








// TODO: remover..
// function dd(objeto) {
//   // Transforma o objeto em string JSON formatada com 2 espaços de recuo
//   const json = JSON.stringify(objeto, null, 2);

//   const renderizarJsonColorido = (textoJson) => {
//     // Regex para capturar propriedades, strings, números, booleanos, nulls E quebras de linha/espaços explicitamente
//     const regex = /(\n|\r\n|\s+|"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
//     const partes = [];
//     let ultimoIndex = 0;

//     textoJson.replace(regex, (match, p1, offset) => {
//       // Adiciona qualquer texto residual intermediário
//       if (offset > ultimoIndex) {
//         partes.push(textoJson.substring(ultimoIndex, offset));
//       }

//       // Se capturar uma quebra de linha, insere a tag <br /> correspondente
//       if (match.trim() === '' && (match.includes('\n') || match.includes('\r'))) {
//         partes.push(h('br', null));

//         // Se após a quebra de linha houver espaços de indentação, renderiza como spans de espaço
//         const espacos = match.replace(/[\n\r]/g, '');
//         if (espacos.length > 0) {
//           partes.push(h('span', { style: { whiteSpace: 'pre' } }, espacos));
//         }
//       }
//       // Se for apenas espaços de recuo (sem quebra de linha)
//       else if (match.trim() === '') {
//         partes.push(h('span', { style: { whiteSpace: 'pre' } }, match));
//       }
//       // Se for um token de dado, aplica a colorização do Laravel
//       else {
//         let estilo = { color: '#bd93f9' }; // Roxo para números

//         if (/^"/.test(match)) {
//           if (/:$/.test(match)) {
//             estilo = { color: '#ff79c6', fontWeight: 'bold' }; // Rosa para chaves (keys)
//           } else {
//             estilo = { color: '#f1fa8c' }; // Amarelo para strings
//           }
//         } else if (/true|false/.test(match)) {
//           estilo = { color: '#8be9fd' }; // Ciano para booleanos
//         } else if (/null/.test(match)) {
//           estilo = { color: '#6272a4', fontStyle: 'italic' }; // Cinza para nulos
//         }

//         partes.push(h('span', { style: estilo }, match));
//       }

//       ultimoIndex = offset + match.length;
//     });

//     if (ultimoIndex < textoJson.length) {
//       partes.push(textoJson.substring(ultimoIndex));
//     }

//     return partes;
//   };

//   // Estilo do container escuro em tela cheia
//   const estiloContainer = {
//     background: '#1e1e24', // Grafite escuro elegante
//     color: '#f8f8f2',
//     padding: '30px',
//     fontFamily: '"Fira Code", "Courier New", Courier, monospace',
//     fontSize: '14px',
//     lineHeight: '1.6',
//     overflow: 'auto',
//     position: 'fixed',
//     top: 0,
//     left: 0,
//     width: '100vw',
//     height: '100vh',
//     zIndex: 99,
//     textAlign: 'left',
//     boxSizing: 'border-box'
//   };

//   // Retorna a estrutura h() contendo o bloco quebrado e indentado linha por linha
//   return h('div', { style: estiloContainer }, renderizarJsonColorido(json));
// }










// function normalizeParams(
//   raw: Record<string, string>,
//   paramDefs: IRoute['params']
// ): Record<string, string | string[] | undefined> {
//   const result: Record<string, string | string[] | undefined> = {};
//   for (const def of paramDefs) {
//     const val = raw[def.name];
//     if (def.catchAll) {
//       result[def.name] = val
//         ? val.split('/').filter(Boolean)
//         : def.optional ? undefined : []
//     } else {
//       result[def.name] = val === undefined && def.optional ? undefined : val;
//     }
//   }
//   return result
// }

// async function renderRoute(
//   route: IRoute,
//   rawParams: Record<string, string>,
//   container: HTMLElement
// ) {
//   const params = normalizeParams(rawParams, route.params)
//   const mod    = await route._import()

//   let props: Record<string, unknown> = { ...params }

//   if (typeof mod.getProps === 'function') {
//     try {
//       const fetched = await Promise.resolve(mod.getProps(params))
//       props = { ...fetched, ...params }
//     } catch (e) {
//       console.error('[ssg] getProps failed:', e)
//     }
//   } else {
//     // No getProps → re-use SSG props (already in the DOM, nothing to do on first load)
//     // props = { ...(window.__SSG_PROPS__ ?? {}), ...params }
//   }

//   render(h(mod.default, props as any), container)
// }

