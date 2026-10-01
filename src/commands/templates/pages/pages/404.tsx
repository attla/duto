import { t, Link } from 'duto'

export default function NotFound() {
  return (
    <div class="flex flex-col items-center justify-center text-center w-full text-lg py-16">
      <h1 class="text-sky-gratient text-mono text-7xl lg:text-8xl">404</h1>
      <p class="body-large mb-2 mt-4 text-3xl lg:text-4xl">{t`notfound`}</p>
      <p class="body lg:body-large">{t`sorry404`}</p>
      <Link to="/" class="border-b border-current mt-8">{t`backhome`}</Link>
    </div>
  )
}
