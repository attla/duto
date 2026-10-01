// import type { ComponentType, FunctionComponent, VNode } from 'preact'
import type { Platform } from '$/cli/types'
import type { FunctionComponent, VNode } from 'preact'

export type PluginOptions = {
  root?: string,
  // Directory to scan for pages, relative to Vite root. Default: "./pages"
  pagesDir?: string,
}

export type I18nMetadata = {
  fallbackLocale: string,
  locales: string[],
  messages: Record<string, Record<string, string>>,
  routes: Record<string, Record<string, string>>,
  routeMap: Record<string, string>,
  pageRoutes: { locale: string, path: string }[]
  options: Record<string, string>,
  string: string,
}

export type SummaryMetadata = {
  type: number,
  path: string,
  size: number,
  sizeBr: number,
  sizeJS: number,
  children?: Map<string, SummaryMetadata>,
}

export type Metadata = {
  root: string,
  dir: string,
  type: 'pages' | 'server',
  platform: Platform,
  dev: {
    host: string,
    port: number,
  },
  hmr: boolean,
  minify: boolean,

  aliases: Record<string, string>,
  layouts: Map<string, IRoute>, // all layouts
  nf: Map<string, IRoute>, // all 404
  pages: Map<string, IRoute>, // all
  spages: Set<string>, // ssg pages
  routes: Routes, // client-side
  // routes: Map<string, IRoute>, // client-side
  i18n: I18nMetadata,
  string: string,
  summary: Map<string, SummaryMetadata>,
}

export type Page<P = {}> = FunctionComponent<VNode<P>>
// A page module as imported by Bun/Vite
export type PageModule<P = {}> = {
  default: Page<P>, // ComponentType<VNode<any>>,
  getStaticProps?: GetStaticProps,
  getProps?: GetProps,
}

/**
 * getStaticProps — build-only.
 * For static pages (no dynamic segments): returns a single props object.
 * For dynamic pages: returns an array of { [routeParam]: value, ...props }
 *
 */
export type GetStaticProps =
  | (() => StaticProps | Promise<StaticProps>)
  | (() => StaticProps[] | Promise<StaticProps[]>)
export type StaticProps = Record<string, unknown>

export type GetProps = (params: RouteParams) => StaticProps | Promise<StaticProps>
export type RouteParams = Record<string, string | string[] | undefined>

export type Routes = IRoute[]
export type IRoute = {
  content: string,
  mod: PageModule,
  hasGetStaticProps: boolean,
  hasGetProps: boolean,
  isClientOnly: boolean,
  layouts: IRoute[],
  importName: string,

  ////////////////////////////

  fileExt: string,
  fileName: string,
  /** Original file path relative to pages dir, e.g. `blog/[slug].tsx` */
  filePath: string,
  fullFilePath: string,
  /** Wouter-compatible pattern, e.g. `/blog/:slug` */
  pattern: string,
  /** Params extracted from the path segments */
  params: Record<string, RouteParam>,
  // params: RouteParam[],
	/**
	 * Similar to the "params" field, but with more associated metadata. For example, for `/site/[blog]/[...slug].tsx`, the segments are:
	 *
	 * 1. `{ content: 'site', dynamic: false, spread: false }`
	 * 2. `{ content: 'blog', dynamic: true, spread: false }`
	 * 3. `{ content: '...slug', dynamic: true, spread: true }`
	 */
	// segments: RoutePart[][]; // alternativa ao "params"
  is404: boolean,
  /** True if this route has any dynamic segments */
  isDynamic: boolean,
  /** True if this route are internal */
  isInternal: boolean,
}

export type RouteParam = {
  name: string,
  optional: boolean,
  catchAll: boolean,
  value?: string | string[],
}
