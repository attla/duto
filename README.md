<h1 align="left">
  🛢 Duto
  <a href="https://npmjs.com/package/duto"><img  src="https://img.shields.io/npm/v/duto.svg" alt="npm package"></a>
  <br/>
  <a href="https://pr.new/attla/duto"><img align="right" src="https://developer.stackblitz.com/img/start_pr_dark_small.svg" alt="Start new PR in StackBlitz Codeflow"></a>
</h1>

> ⚠️ Duto is under ALFA development — expect updates, rough edges, and occasional breack changes.
<br/>

Duto is minimalist framework, focused on client-side pages and serverless APIs.

Principles:
 - No vendor lock-in! Deploy anywhere with: `duto deploy`
 - Developer happiness as a design constraint
 - Optimized by default!

Pages features:
 - Static pages `/blog.tsx` `getStaticProps()`
 - Prerendered dynamic pages `/blog/[slug].tsx` `getStaticProps()`
 - Dynamic pages on client-side `/blog/[slug].tsx` `getProps()`
 - Not found page on client-side `/blog/not-found.tsx`
 - Efficient route hierarchy `/not-found.tsx`
 - Catch-all page whitout SSR! `/blog/[...slug].tsx`
 - Optional catch-all routes whitout SSR! `/blog/[[...slug]].tsx`
 - Simple internationalization (i18n) integration `tˋfeaturesˋ`

Server features:
 - Instant server and cold starts
 - Optimized build, greater efficiency in less bundle size
 - Built-in core shims for compatibility with custom runtimes
 - Fully typed OpenAPI documentation
 - Powerful request validations
 - Fine-grained authentication

[Read the Docs to Learn More](https://hub.bi/docs/duto)

## Ecosystem Packages

| Package | Version | Description |
| -: | :- | :- |
| [forj](https://github.com/attla/forj) | [![forj version](https://img.shields.io/npm/v/forj.svg?label=%20)](https://npm.im/forj) | 🗂️ Fast and lightweight query builder in typescript |
| [cripta](https://github.com/attla/cripta) | [![cripta version](https://img.shields.io/npm/v/cripta.svg?label=%20)](https://npm.im/cripta) | 🧛 A layer of encryption a little too judicious. |
| [t0n](https://github.com/attla/t0n) | [![t0n version](https://img.shields.io/npm/v/t0n.svg?label=%20)](https://npm.im/t0n) | 🧰 Collection of elegant typescript resources for web artisans. |

## License

This package is licensed under the [MIT license](https://github.com/attla/duto/blob/main/LICENSE) © [HUB](https://hub.bi)
