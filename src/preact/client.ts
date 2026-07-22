import { h, hydrate, render } from 'preact'
import StaticHtml from './static-html'
import type { SignalLike } from './types'

const sharedSignalMap = new Map<string, SignalLike>()

type MaskId = number | string

function getIslandMaskId(el: HTMLElement): MaskId | null {
  return el.id || null
}

function setVNodeMask(child: any, maskId: MaskId) {
  const mask: [MaskId, number] = [maskId, 0]
  child._mask = mask
  child.__m = mask
}

export default async (
  el: HTMLElement,
  Component: unknown,
  props: Record<string, unknown>,
  { default: children, ...slotted }: Record<string, unknown>,
): Promise<void> => {
  for (const [key, value] of Object.entries(slotted)) // @ts-ignore
    props[key] = h(StaticHtml, { value, name: key })

  const signalsRaw = el.dataset.set
  if (signalsRaw) {
    const { signal } = await import('@preact/signals')
    const signals: Record<string, string | [string, number][]> = JSON.parse(signalsRaw)

    for (const [propName, signalId] of Object.entries(signals)) {
      if (Array.isArray(signalId)) {
        signalId.forEach(([id, indexOrKeyInProps]) => {
          const mapValue = (props[propName] as any)[indexOrKeyInProps]
          let valueOfSignal = mapValue
          let resolvedKey: string | number = indexOrKeyInProps

          if (typeof indexOrKeyInProps !== 'string') {
            valueOfSignal = mapValue[0]
            resolvedKey = mapValue[1]
          }

          if (!sharedSignalMap.has(id))
            sharedSignalMap.set(id, signal(valueOfSignal))

          // @ts-ignore
          props[propName][resolvedKey] = sharedSignalMap.get(id)
        })
      } else {
        if (!sharedSignalMap.has(signalId))
          sharedSignalMap.set(signalId, signal(props[propName]))

        props[propName] = sharedSignalMap.get(signalId)
      }
    }
  }

  const rawChildren = children ?? props.children
  delete props.children

  const child = h(
    Component as any,
    props,
    rawChildren == null
      ? undefined
      : typeof rawChildren === 'string'
        ? h(StaticHtml, { value: rawChildren })
        : rawChildren
  )

  const islandMaskId = getIslandMaskId(el)
  if (islandMaskId !== null)
    setVNodeMask(child, islandMaskId)

  hydrate(child, el)

  el.addEventListener('d:unmount', () => {
    render(null, el)

    // 2. Remove o elemento do DOM apenas após o desmonte,
    //    usando microtask para garantir que o Preact finalizou
    //    o ciclo de reconciliação antes da remoção física
    Promise.resolve().then(() => el.remove())
  }, { once: true })
}
