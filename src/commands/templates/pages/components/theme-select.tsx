import { on } from 't0n'
import { useSignal } from '@preact/signals'
import { useLayoutEffect } from 'preact/hooks'
import { t, getTheme, setTheme } from 'duto'

import Select from './select'

function ThemeIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={[props.class || '', props.className || ''].filter(Boolean).join(' ')}><path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z"/><path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7"/><path d="M 7 17h.01"/><path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8"/></svg>
  )
}

export default function ThemeSelect({ class: className = '' }) {
  const options = [['auto', t`auto`], ['dark', t`dark`], ['light', t`light`]].map(([value, label]) => ({ value, label, selected: false }))
  const selectedValue = useSignal(getTheme())
  let unsubscribe: (() => void) | null = null
  const handle = e => selectedValue.value = e?.val ? e.val : getTheme()

  useLayoutEffect(() => {
    selectedValue.value = getTheme()
    if (!unsubscribe)
      unsubscribe = on('@theme', handle)

    return () => {
      unsubscribe?.()
    }
  }, [])

  const handleChange = async (e: Event) => {
    const target = e.target as HTMLSelectElement
    if (target) {
      setTheme(target.value)
      selectedValue.value = target.value
    }
  }

  const containerClasses = [
    'theme-select overflow-hidden text-ellipsis p-1 rounded-lg hover:bg-neutral-200 hover:text-zinc-900',
    className,
  ].filter(Boolean).join(' ')

  return (
    <Select
      Icon={ThemeIcon}
      options={options}
      value={selectedValue.value}
      width="6.25em"
      class="theme-select outline-none text-ellipsis absolute inset-0 opacity-0 cursor-pointer"
      containerClass={containerClasses}
      id="theme-select"
      onchange={handleChange}
      width="6.25em"
      id="theme-select"
    />
  )
}
