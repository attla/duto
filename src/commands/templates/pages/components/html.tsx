import { t } from 'duto'

export type Props = {
  children?: preact.ComponentChildren
  class?: string

	locale?: string
  name?: string
  title: string
  description?: string
}

export function Html({
  children,
  class: className,

	locale = 'en',
	name = 'Duto',
	title,
	description = '',
  ...props
}: Props) {
  const _class = [
    'bg-gradient-to-br from-zinc-200 to-zinc-150 dark:from-zinc-800 dark:to-zinc-950 text-gray-600 dark:text-gray-300',
    className,
  ].filter(Boolean).join(' ')

  const _title = [name, t(title ?? '')].filter(Boolean).join(' › ')
  const _description = t(description || title || '')

  return (
    <html class={_class} {...props}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <link rel="icon" type="image/x-icon" sizes="48x48" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />

        {/* <link rel="sitemap" href="/sitemap-index.xml" /> */}

        <title dangerouslySetInnerHTML={{ __html: _title }} />
        {_description && <meta name="description" content={_description} />}
      </head>

      <body class="flex flex-col min-h-svh max-w-screen overflow-x-clip relative z-10 ">
        {children}
      </body>
    </html>
  )
}
