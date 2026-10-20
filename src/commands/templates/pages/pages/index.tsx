import { t, Link } from 'duto'

export { Html } from '@/components/html'

export default function Index() {
  return (
    <div class="relative space-y-8">
      <h1 class="title text-sky-gradient lg:mt-2">{t`title`}</h1>
      <p class="sub-title">{t`description`}</p>
      <div class="divide-y divide-gray-300 dark:divide-zinc-700/70">
        {[
          ['https://hub.bi/docs/duto', t`gotodocs`],
          ['blog', t`Blog`],
        ].map(([href, label]) => (
          <Link
            href={href}
            class="group flex items-center justify-between gap-4 py-4 px-2.5"
          >
            <span class="font-semibold group-hover:text-sky-gradient">{label}</span>
            <span class="text-lg mr-3 transition-transform group-hover:text-sky-600 dark:group-hover:text-sky-300 group-hover:translate-x-1">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
