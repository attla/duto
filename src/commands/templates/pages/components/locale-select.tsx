import { useSignal } from '@preact/signals'
import { options } from '@/i18n'
import { local, getLocale, setLocale, isPrefixed, r } from 'duto'
import { useLayoutEffect } from 'preact/hooks'

import Select from './select'

function Languages(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={[props.class || '', props.className || ''].filter(Boolean).join(' ')}><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg>
  )
}
export default function LocaleSelect({ class: className = '' }) {
  const localeOptions = Object.entries(options).map(([value, label]) => ({ label, value }))
  const selectedValue = useSignal(getLocale())
  let unsubscribe: (() => void) | null = null
  const handle = (e: any, lang?: string) => {
    lang ??= getLocale()
    selectedValue.value = lang
  }

  useLayoutEffect(() => {
    unsubscribe = local.subscribe('lang', e => !isPrefixed() && handle(null, e.val as string))
    const lang = getLocale()
    selectedValue.value = lang

    window.addEventListener('popstate', handle)
    return () => {
      window.removeEventListener('popstate', handle)
      unsubscribe?.()
    }
  }, [])

  const handleChange = async (e: Event) => {
    const target = e.target as HTMLSelectElement
    if (target) {
      await setLocale(target.value)
      selectedValue.value = target.value
      isPrefixed() && r((window?.location?.pathname || '').split('/').filter(Boolean).slice(1).join('/'), target.value)
    }
  }

  const containerClasses = [
    'locale-select overflow-hidden text-ellipsis p-1 rounded-lg hover:bg-neutral-200 hover:text-zinc-900',
    className
  ].filter(Boolean).join(' ')

  return (
    <Select
      Icon={Languages}
      options={localeOptions}
      value={selectedValue.value}
      class={'outline-none text-ellipsis absolute inset-0 opacity-0 cursor-pointer' + className}
      containerClass={containerClasses}
      id="locale-select"
      onchange={handleChange}
    />
  )
}
