import { local } from '#/storage'
import { t, _prefixed } from './client'

export default class EI18n extends HTMLElement {
  static observedAttributes = ['s']
  #builded = false
  #unsubscribe: (() => void) | null = null

  connectedCallback() {
    if (!_prefixed) // @ts-ignore // TODO: talvez usar função para obter o valor atual..
      this.#unsubscribe = local.subscribe('lang', e => this.build(e.val))

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      this.build()
      return
    }

    setTimeout(() => {
      this.build()
    }, 0)
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
    // if (!this.isConnected) return
    const key = this.getAttribute('s')
    if (!key) return

    this.innerHTML = t(key, val)

    this.#builded = true
  }
}
