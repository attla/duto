

import { h } from 'preact'
import { memo } from 'preact/compat'

const StaticHtml = memo(({ value, name, hydrate = true }: {
  value: string,
  name?: string,
  hydrate?: boolean,
}) => {
  if (!value) return null
  const tagName = hydrate ? 'd-b' : 'd-p'
  return h(tagName, { name, dangerouslySetInnerHTML: { __html: value } })
}, () => true) // segundo argumento = areEqual, sempre true = nunca re-renderiza

export default StaticHtml

// import { h } from 'preact'
/**
 * Duto passes `children` as a string of HTML, so we need
 * a wrapper `div` to render that content as VNodes
 *
 * As a bonus, we can signal to Preact that this subtree is
 * entirely static and will never change via `shouldComponentUpdate`
 */
// const StaticHtml = ({ value, name, hydrate = true }: {
//   value: string,
//   name?: string,
//   hydrate?: boolean,
// }) => {
//   if (!value) return null
//   const tagName = hydrate ? 'd-b': 'd-p' // 'astro-slot' : 'astro-static-slot'
//   return h(tagName, { name, dangerouslySetInnerHTML: { __html: value } })
// }

// /**
//  * This tells Preact to opt-out of re-rendering this subtree
//  * In addition to being a performance optimization
//  * this also allows other frameworks to attach to `children`
//  *
//  * See https://preactjs.com/guide/v8/external-dom-mutations
//  */
// StaticHtml.shouldComponentUpdate = () => false

// export default StaticHtml
