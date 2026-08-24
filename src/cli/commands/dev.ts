import { command, watch, killProcess } from 't0n/cli'
import { dim } from 't0n/color'
import { error, log, rn } from 't0n/log'
import { withPort } from 't0n/port'
import { getMetadata } from '@/meta'
import { _root } from '@/utils'
import { getConfig, preview, reload } from '~/utils'

export const args = {
  port: {
    alias: 'p',
    description: 'Port to listen on',
    type: 'number',
    default: 3000,
  },
  host: {
    description: 'Host to forward requests to, defaults to the zone of project',
    type: 'string',
    default: 'localhost',
  },
}

export default command({
  meta: {
		name: 'dev',
		description: '🧪  Start dev server\n',
	}, // @ts-ignore
	args,
  async run({ args }) {
    const config = await getConfig()
		const desiredPort = args.port ? Number(args.port) : (config?.preview?.port ? Number(config.preview.port) : 3000)
    const host = args.host ? String(args.host) : (config?.preview?.host ? String(config.preview.host) : 'localhost')

    let buildProcess: Bun.Subprocess | null = null

    const _build = async () => {
      if (buildProcess) await killProcess(buildProcess)
      buildProcess = Bun.spawn(['duto', 'build', '--hmr'], {stdin: 'inherit', stdout: 'ignore', stderr: 'inherit'})

      try {
        const code = await buildProcess.exited

        if (code !== 0)
          throw new Error(`Build failed with code ${code}`)
      } finally {
        buildProcess = null
      }
    }

    withPort(desiredPort, async (port) => {
      const ignore = [
        /(^|[\/\\])\.(duto|git|cache|vscode|idea|next|nuxt|nyc_output)([\/\\]|$)/,
        /(^|[\/\\])(node_modules|tmp|dist|build|out|coverage)([\/\\]|$)/,

        /\.(DS_Store|localized|tmp|temp|log|pid|swp|swo)$/,
        /(Thumbs\.db|desktop\.ini)$/,
        /~$/,

        /(^|[\/\\])\.(Spotlight-V100|Trashes)([\/\\]|$)/,
        /(^|[\/\\])__MACOSX([\/\\]|$)/,
      ]

      try {
        await _build()
        await preview(await getMetadata(config.root as string, config.pagesDir as string), host, port)

        log(`Running on http://${host}:${port}${global?.__st ? dim(` in ${Math.ceil(performance.now() - global.__st)} ms`) : ''}`)

				watch(async () => {
          await _build()
          reload()
				}, '.', _root, (path: string) => {
          for (const pattern of ignore)
            if (pattern.test(path)) return true

          return false
        })
      } catch (e: any) {
        error(e)
        process.exit(0)
      } finally {
        rn()
      }
    })

	},
})
