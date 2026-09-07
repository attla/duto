<h1 align="left">Duto<br/><a href="https://pr.new/attla/duto"><img align="right" src="https://developer.stackblitz.com/img/start_pr_dark_small.svg" alt="Start new PR in StackBlitz Codeflow"></a><a href="https://npmjs.com/package/duto"><img align="right" src="https://img.shields.io/npm/v/duto.svg" alt="npm package"></a></h1>

> ⚠️ Duto is under ALFA development — expect updates, rough edges, and occasional breack changes.
<br/>

This framework is fully geared towards the serverless world.

Server features:
 - Instant Server Start
 - Fast Cold Start
 - Optimized Build

Pages features:
 - Static pages `/blog.tsx` `getStaticProps()`
 - Prerendered dynamic pages `/blog/[slug].tsx` `getStaticProps()`
 - Dynamic pages on client-side `/blog/[slug].tsx` `getProps()`
 - Not found page on client-side `/blog/not-found.tsx`
 - Efficient route hierarchy `/not-found.tsx`
 - Catch-all page whitout SSR! `/blog/[...slug].tsx`
 - Optional catch-all routes whitout SSR! `/blog/[[...slug]].tsx`
 - Simple internationalization (i18n) integration `tˋfeaturesˋ`
 - No vendor lock-in! `duto deploy`

[Read the Docs to Learn More](https://github.com/attla/duto/blob/main/DOCS.md)

## Ecosystem Packages

| Package | Version | Description |
| -: | :- | :- |
| [forj](https://github.com/attla/forj) | [![forj version](https://img.shields.io/npm/v/forj.svg?label=%20)](https://npm.im/forj) | 🗂️ Fast and lightweight query builder in typescript |
| [t0n](https://github.com/attla/t0n) | [![t0n version](https://img.shields.io/npm/v/t0n.svg?label=%20)](https://npm.im/t0n) | 🧰 Collection of elegant typescript resources for web artisans. |
| [cripta](https://github.com/attla/cripta) | [![cripta version](https://img.shields.io/npm/v/cripta.svg?label=%20)](https://npm.im/cripta) | 🧛 A layer of encryption a little too judicious. |

## License

This package is licensed under the [MIT license](https://github.com/attla/duto/blob/main/LICENSE) © [HUB](https://hub.bi)
