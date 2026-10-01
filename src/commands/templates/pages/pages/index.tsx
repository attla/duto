import { t, Link } from 'duto'

export default function Index() {
  return (
    <div class="relative">
      <h1 class="title text-sky-gratient mt-10 lg:mt-2">{t`title`}</h1>
      <p class="sub-title">{t`description`}</p>
      <div class="flex flex-row gap-8 mt-10">

        <Link href="https://hub.bi/docs/duto" class="group inline-flex shrink-0 items-center justify-center leading-6 font-medium select-none focus:outline-0 gap-2 px-4 py-2.5 text-base rounded-lg bg-white hover:bg-neutral-200 border border-gray-700 text-zinc-900">
          {t`gotodocs`}<span class="ml-0.5 inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </div>
  )
}
