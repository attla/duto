import { useLocation } from 'wouter-preact'
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
  if (isExternalUrl(rest.href = href)) {
    rest.target = '_blank'
    rest.rel = 'noopener noreferrer'
  } else {
    rest.is = 'i-l'
  }

  const [pathname] = useLocation()
  const baseClass = typeof rest.class === 'string' || !rest?.class
    ? (rest.class || '') as string
    : ''
  rest.class = baseClass + (pathname === href ? ' active' : '')

  !href && (delete rest.href)
  return <a {...rest} />
}
