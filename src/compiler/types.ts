// import type { ComponentType, FunctionComponent, VNode } from 'preact'
import type { FunctionComponent, VNode } from 'preact'

export type PluginOptions = {
  rootDir?: string,
  // Directory to scan for pages, relative to Vite root. Default: "./pages"
  pagesDir?: string,
}

export type DepMetadata = {
  path: string,
  ref: string,
}

export type FileMetadata = {
  path: string,
  content: string,
  deps: Map<string, DepMetadata>,
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
  aliases: Record<string, string>,
  map: Map<string, FileMetadata>,
  violations: Map<string, DepMetadata[]>,
  layouts: Map<string, IRoute>, // all layouts
  pages: Map<string, IRoute>, // all
  spages: Set<string>, // ssg pages
  routes: Routes, // client-side
  // routes: Map<string, IRoute>, // client-side
  assets: string[],
  i18n: I18nMetadata,
  string: string,
  summary: Map<string, SummaryMetadata>,
}

export type Page<P = {}> = FunctionComponent<VNode<P>>
// A page module as imported by Bun/Vite
export type PageModule<P = {}> = {
  default: Page<P>,
  // default: ComponentType<VNode<any>>,
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

/**
 * getProps — browser-only.
 * Receives route params and returns props for the component
 */
export type GetProps = (params: RouteParams) => StaticProps | Promise<StaticProps>
export type RouteParams = Record<string, string | string[] | undefined>

export type Routes = IRoute[]
export type IRoute = {
  content: string,
  mod: PageModule,
  /** True if the page exports getStaticProps */
  hasGetStaticProps: boolean,
  /** True if the page exports getProps */
  hasGetProps: boolean,
  isClientOnly: boolean,
  islands: ImportUsage[], // TODO mover para cá
  // islands: IslandMeta[],
  // safeFilePath: string,
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



export interface Usage {
  type: 'jsx' | 'call' | 'reference'
  source: string,
  imported: string,
  local: string,
  start: number,
  end: number,
  text: string,
  node: unknown,
  parent: unknown,
}

export interface ImportUsage {
  source: string,
  imported: string,
  local: string,
  importStart: number,
  importEnd: number,
  importText: string,
  usages: Usage[],
}

export interface IslandMeta {
  /** Identificador curto e único (base64url de 7 chars) */
  id: string
  /** URL pública do asset JS do componente */
  url: string
  /** Nome do export usado */
  export: string
  /** Props serializadas como JSON (HTML-encoded) */
  props: string
  /** HTML do SSR do componente */
  ssrHtml: string
}

// export interface ReplaceIslandsOptions {
//   /**
//    * Função que resolve o nome do componente para a URL pública do asset JS.
//    * Ex: 'Counter' → '/assets/Counter.BQxoyJbC.js'
//    */
//   resolveUrl: (exportName: string) => string
//   /**
//    * Função que carrega o módulo do componente para fazer SSR.
//    * Recebe o source da importação (ex: '@/components/counter2') e o nome do export.
//    */
//   loadComponent: (source: string, exportName: string) => Promise<unknown>
// }


// export type Island = {
//   /** Unique id — written as data-island on the placeholder div */
//   id: string,
//   /** Component display name — used by the client to look up the component */
//   name: string,
//   /** Props serialised into the placeholder for client hydration */
//   props: Record<string, unknown>,
// }

// export type RenderResult = {
//   html: string,
//   islands: Island[],
//   /** true if any islands were found (= client JS needed) */
//   hasIslands: boolean,
// }

// export type IslandMeta = {
//   id: string,
//   name: string,
//   props: Record<string, unknown>,
// }

