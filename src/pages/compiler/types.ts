import type { BunPlugin } from 'bun'
import type { FunctionComponent, VNode } from 'preact'
import type { Platform } from '$/cli/types'

export type PluginOptions = {
  root?: string,
  pagesDir?: string,
}

export type DutoOptions = {
  root: string,
  pagesDir: string,
  outDir: string,
  plugins: BunPlugin[],
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
  outDir: string,
  outPath: string,
  plugins: BunPlugin[],

  entry: string
  entries: string[],
  cache: Map<string, string>,
  css?: { dest: string, href: string },

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
  loads: Map<string, IRoute>, // all layouts
  nf: Map<string, IRoute>, // all 404
  pages: Map<string, IRoute>, // all pages
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
  Loading?: Page<P>,
}

/**
 * getStaticProps — build-only.
 * For static pages (no dynamic segments): returns a single props object.
 * For dynamic pages: returns an array of { [routeParam]: value, ...props }
 */
export type GetStaticProps =
  | (() => StaticProps | Promise<StaticProps>)
  | (() => StaticProps[] | Promise<StaticProps[]>)
export type StaticProps = Record<string, unknown>

export type RouteParams = Record<string, string | string[] | undefined>
export type GetProps = (params: RouteParams) => StaticProps | Promise<StaticProps>
export type Params = [string, number][]

export type View = [string | string[], Page | string, Params | 0, GetProps | 0 | 1 | null, Page | string]

export type Layout = { path: string, view: Page | string }
export type Routes = IRoute[]
export type IRoute = {
  content: string,
  mod: PageModule,

  hasGetStaticProps: boolean,
  hasGetProps: boolean,
  hasLoading: boolean,

  useClient: boolean,
  useRaw: boolean,
  useHtml: boolean,
  layouts: IRoute[],

  props?: StaticProps,
  pattern: string | string[], // wouter-compatible pattern, e.g. `/blog/:slug`
  params: Params,

  id: string,
  name: string,
  path: string,
  // filePath: string, // original file path relative to pages dir, e.g. `blog/[slug].tsx`

  is404: boolean,
  isDynamic: boolean,
  isInternal: boolean,
}
