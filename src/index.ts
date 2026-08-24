export {
  Redirect,
  useLocation, useParams, useSearch, useSearchParams,
  matchRoute,
} from 'wouter-preact'

export {
  t, r, d,
  getLocale, setLocale,
  isPrefixed,
} from './i18n/client'

export { local } from './client/storage'

export const navigate = <S = any>(
  to: string | URL,
  options?: { replace?: boolean; state?: S; transition?: boolean }
) => {
  if (window?.$duto?.sroutes?.has(to)) {
    location.pathname = to
    return
  }

  const n = window?.$duto?.navigate || useLocation()[1]
  n(to, options)
}

export { Link } from './components/link'
