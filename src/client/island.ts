import hydrator from '../preact/client'

const propTypes: { [k: string]: (value: any) => any } = {
  0: (value) => reviveObject(value),
  1: (value) => reviveArray(value),
  2: (value) => new RegExp(value),
  3: (value) => new Date(value),
  4: (value) => new Map(reviveArray(value)),
  5: (value) => new Set(reviveArray(value)),
  6: (value) => BigInt(value),
  7: (value) => new URL(value),
  8: (value) => new Uint8Array(value),
  9: (value) => new Uint16Array(value),
  10: (value) => new Uint32Array(value),
  11: (value) => Number.POSITIVE_INFINITY * value,
}

// Not using JSON.parse reviver because it's bottom-up but we want top-down
const reviveTuple = (raw: any): any => {
  const [type, value] = raw
  return type in propTypes ? propTypes[type](value) : undefined
}

const reviveArray = (raw: any): any => (raw as Array<any>).map(reviveTuple)
const reviveObject = (raw: any): any => {
  if (typeof raw !== 'object' || raw === null) return raw
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, reviveTuple(value)]))
}

// 🌊🏝🌴
export default class Island extends HTMLElement {
  public Component: any
  private _hydrated = false
  static observedAttributes = ['props']

  connectedCallback() {
    if (!this.hasAttribute('await-children') || document.readyState === 'interactive' || document.readyState === 'complete') {
      this.build()
      return
    }

    setTimeout(() => {
      this.build()
    }, 0)
  }

  disconnectedCallback() {
  	// document.removeEventListener('d:after-swap', this.unmount);
  	// document.addEventListener('d:after-swap', this.unmount, { once: true });

    this.unmount()
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (this.Component) {
      // console.log(`[AttributeChanged] O atributo "${name}" mudou de "${oldValue}" para "${newValue}".`, this)
      this._hydrated = false
      this.hydrate()
    }
  }

  async build() {
    const componentModule = await import(this.getAttribute('url')!)
    const componentExport = this.getAttribute('export') || 'default'
    if (!componentExport.includes('.')) {
      this.Component = componentModule[componentExport]
    } else {
      this.Component = componentModule
      for (const part of componentExport.split('.'))
        this.Component = this.Component[part]
    }

    await this.hydrate()
  }

  // hydrate = async () => {
   async hydrate() {
    // Make sure the island is mounted on the DOM before hydrating. It could be unmounted
    // when the parent island hydrates and re-creates this island.
    if (!this.isConnected || this._hydrated) return

    // Wait for parent island to hydrate first so we hydrate top-down. The `ssr` attribute
    // represents that it has not completed hydration yet.
    const parent = this.parentElement?.closest('i-s')
    if (parent) {
      parent.addEventListener('d:hydrate', this.hydrate, { once: true })
      return
    }

    const slotted = this.querySelectorAll('d-b')
    const slots: Record<string, string> = {};
    // Always check to see if there are templates.
    // This happens if slots were passed but the client component did not render them
    const templates = this.querySelectorAll('template[d-template]')
    for (const template of templates) {
      const closest = template.closest(this.tagName)
      if (!closest?.isSameNode(this)) continue
      slots[template.getAttribute('d-template') || 'default'] = template.innerHTML
      template.remove()
    }
    for (const slot of slotted) {
      const closest = slot.closest(this.tagName)
      if (!closest?.isSameNode(this)) continue
      slots[slot.getAttribute('name') || 'default'] = slot.innerHTML
    }

    let props: Record<string, unknown>

    try {
      props = this.hasAttribute('props') ? reviveObject(JSON.parse(this.getAttribute('props')!)) : {}
    } catch (e) {
      let componentName: string = this.getAttribute('url') || '<unknown>'
      const componentExport = this.getAttribute('export')

      if (componentExport)
        componentName += ` (export ${componentExport})`

      console.error(
        `[hydrate] Error parsing props for component ${componentName}`,
        this.getAttribute('props'),
        e,
      )
      throw e
    }

    // @ts-ignore
    await hydrator(this, this.Component, props, slots)

    this._hydrated = true
    this.dispatchEvent(new CustomEvent('d:hydrate'))
  }

  unmount() {
    if (!this.isConnected) this.dispatchEvent(new CustomEvent('d:unmount'))
  }
}
