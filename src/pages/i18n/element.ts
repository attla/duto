import { local } from '#/client/storage'
import { $, _prefixed } from './client'

export default class EI18n extends HTMLElement {
  static observedAttributes = ['s']
  #builded = false
  #unsubscribe: (() => void) | null = null

  connectedCallback() { // @ts-ignore
    this.#unsubscribe = local.subscribe('lang', e => this.build(e?.val))
    document.readyState === 'interactive' || document.readyState === 'complete'
      ? this.build()
      : setTimeout(this.build, 0)
  }

  attributeChangedCallback() {
    if (this.#builded)
      this.build()
  }

  disconnectedCallback() {
    if (this.#unsubscribe) {
      this.#unsubscribe?.()
      this.#unsubscribe = null
    }
  }

  build(val?: string) {
    const key = this.getAttribute('s')
    if (!key) return

    this.innerHTML = $(key, val)
    this.#builded = true
  }
}
