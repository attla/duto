import { Link as WouterLink, useLocation } from 'wouter-preact'
import type { LinkProps } from 'wouter-preact'

const isExternalUrl = (href?: string) =>
  href ? href.startsWith('http')
    || href.startsWith('//')
    || href.startsWith('mailto:')
    || href.startsWith('tel:') : false

export const Link = ({
  to = '',
  href = to,
  ...rest
}: LinkProps) => {
  const isExternal = isExternalUrl(rest.href = href)
  const isSRoute = window?.$duto?.sroutes?.has(href)

  if (isExternal) {
    rest.target = '_blank'
    rest.rel = 'noopener noreferrer'
  }

  if (!href || isExternal || isSRoute) {
    const [pathname] = useLocation()
    const baseClass = typeof rest.class === 'string' || !rest?.class
      ? (rest.class || '') as string
      : ''
    rest.class = baseClass + (pathname === href ? ' active' : '')

    !href && (delete rest.href)
    return <a is='i-l' {...rest} />
  }

  if (typeof rest.class === 'string' || !rest?.class)
    rest.className = a => (rest.class || '') + (a ? ' active' : '')

  return <WouterLink is='i-l' {...rest} />
}
