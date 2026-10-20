import { on } from 't0n'
import { route } from '../i18n/client'

addEventListener('@navigate', e => {
  const el = (e as CustomEvent<HTMLAnchorElement>).detail
  // @ts-ignore
  if (el.href) $duto.navigate?.(el.href)
})

export default class Link extends HTMLAnchorElement {
  static observedAttributes = [
    'href',
    'target',
    'download',
    'rel',
    'hreflang',
    'referrerpolicy',
    'ping',
    'type',
  ]
  #unsubscribe: (() => void) | null = null
  #href: string | null = null

  constructor() {
    super()
    this.addEventListener('click', this.#onClick)
  }

  connectedCallback() {
    this.#href = this.getAttribute('href') // @ts-ignore
    this.#unsubscribe = on('@i18n', e => this.build(e?.val))

    document.readyState === 'interactive' || document.readyState === 'complete'
      ? this.build()
      : setTimeout(this.build, 0)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick)
    if (this.#unsubscribe) {
      this.#unsubscribe?.()
      this.#unsubscribe = null
    }
  }

  build(val?: string) {
    const href = this.#href
    if (!href || href.charCodeAt(0) === 47 || href.startsWith('http')) return
    this.setAttribute('href', route(href, val))
  }

  #onClick = (e: MouseEvent) => {
    if (
      e.defaultPrevented // respects default behavior
      || this.target === '_blank'
      // allow ctrl/cmd+click to open in new tab normally
      || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      || e.button !== 0
    ) return

    e.preventDefault()
    if (this.hasAttribute('href'))
      self.dispatchEvent(new CustomEvent('@navigate', { detail: this }))

    // TODO: scroll from #hash to elements
  }
}
