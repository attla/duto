import { on } from 't0n'
import { $ } from './client'

export default class EI18n extends HTMLElement {
  static observedAttributes = ['s']
  #builded = false
  #unsubscribe: (() => void) | null = null

  connectedCallback() {
    this.#unsubscribe = on('@i18n', e => this.build())
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

  build() {
    const key = this.getAttribute('s')
    if (!key) return

    this.innerHTML = $(key)
    this.#builded = true
  }
}
