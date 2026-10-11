import { local, type IStoreListener } from './storage'

export type Theme = 'auto' | 'dark' | 'light'

const key = 'theme'
const themes = ['dark', 'light']
const match = () => matchMedia('(prefers-color-scheme: dark)')
export const preferredColorScheme = () => match().matches ? 'dark' : 'light'
export const setThemeAttr = (theme: Theme) => {
  if (theme == 'auto') theme = preferredColorScheme()
  document.documentElement.classList.toggle('dark', theme == 'dark')
}

const isValid = (val: string) => themes.includes(val)
export const getTheme = () => {
  const val = local.get<string>(key) || ''
  return isValid(val) ? val : 'auto'
}
export const setTheme = (theme: Theme) => {
  setThemeAttr(theme)
  isValid(theme)
    ? local.set(key, theme)
    : local.remove(key)
}

export const onThemeChange = (e: IStoreListener<any>) => {
  const mm = match()
	mm.addEventListener('change', e)
  return [local.subscribe(key, e), () => mm.removeEventListener('change', e)]
}

// export function updatePickers(theme = storedTheme || 'auto') {
//   document.querySelectorAll('.theme-select').forEach(el => {
//     const select = el.querySelector('select')
//     if (select) select.value = theme
//     const tmpl = document.querySelector(`#theme-icons`)
//     const newIcon = tmpl && tmpl.content.querySelector('.' + theme)
//     if (newIcon) {
//       const oldIcon = el.querySelector('svg.label-icon')
//       if (oldIcon) oldIcon.replaceChildren(...newIcon.cloneNode(true).childNodes)
//     }
//   })
// }

// <template id="theme-icons">
// 	<Icon name="lucide:sun" class="light" />
// 	<Icon name="lucide:moon-star" class="dark" />
// 	<Icon name="lucide:swatch-book" class="auto" />
// </template>
