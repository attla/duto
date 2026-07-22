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
    // Respeita comportamento padrão
    if (
      e.defaultPrevented
      || this.target === '_blank'
      || e.metaKey
      || e.ctrlKey
      || e.shiftKey
      || e.altKey
      || e.button !== 0
    ) {
      return
    }
    // Allow ctrl/cmd+click to open in new tab normally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    // e.preventDefault()
    if ((e.target as HTMLAnchorElement).hasAttribute('href'))
      window.dispatchEvent(new CustomEvent('d:navigate', { detail: e.target }))

    // Exemplo: interceptar navegação SPA
    // event.preventDefault()
    // router.push(this.href)
  }

  // Proxy opcional para facilitar typings
  get url() {
    return new URL(this.href)
  }
}


window.addEventListener('d:navigate', e => {
  const el = (e as CustomEvent<HTMLAnchorElement>).detail

  console.warn('d:navigate', el)
  // if (href) _navigate?.(href)
  // _navigate?.('/haha-2')
})

// const links = document.querySelectorAll('a[d]')
// for (const link of links) { // @ts-ignore
//   link.addEventListener('click', (e: MouseEvent) => {
//     // Allow ctrl/cmd+click to open in new tab normally
//     if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
//     e.preventDefault()
//     window.dispatchEvent(new CustomEvent('d:navigate', { detail: e.target }))
//   })
// }
