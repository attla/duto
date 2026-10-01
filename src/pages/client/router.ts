import { render, h } from 'preact'
import type { Page, GetProps, IRoute } from '#/compiler/types'

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
  paramDefs?: IRoute['params'] | 0,
  getProps?: GetProps | 0 | 1,
  layouts?: Page[]
) {
  while (document.body.firstChild)
    document.body.removeChild(document.body.firstChild)

  let props: Record<string, unknown> = paramDefs ? normalizeParams(rawParams, paramDefs) : rawParams

  if (typeof Component === 'string') {
    const mod = await import(Component)
    Component = mod.default
    getProps = getProps === 1 ? mod.getProps : 0
  }

  // @ts-ignore
  const sProps = self.$duto?.props
  if (typeof sProps === 'object' && sProps !== null) {
    Object.assign(props, sProps)
  } else if (typeof getProps === 'function') {
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
  // render(h(Component, props as any), container)
}
