self.addEventListener('d:navigate', e => {
  const el = (e as CustomEvent<HTMLAnchorElement>).detail

  console.warn('d:navigate', el)
  if (el.href) self.$duto.navigate?.(el.href)
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

  constructor() {
    super()
    this.addEventListener('click', this.#onClick)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick)
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
      self.dispatchEvent(new CustomEvent('d:navigate', { detail: this }))

    // TODO: scroll from #hash to elements
  }
}
