import { defineCommand } from 'citty'
// import { build, preview } from 'vite'
import { withPort } from 't0n/port'
import { error, event, log, rn, wait } from 't0n/log'
import { _root } from '@/utils'
import { getConfig, preview, reload } from '~/utils'
import { watch } from 't0n/cli'
import { spawn, type ChildProcess } from 'node:child_process'

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

export default defineCommand({
  meta: {
		name: 'dev',
		description: '🧪  Start dev server\n',
	}, // @ts-ignore
	args,
  async run({ args }) {
    const config = await getConfig()
		const desiredPort = args.port ? Number(args.port) : (config?.preview?.port ? Number(config.preview.port) : 3000)
    const host = args.host ? String(args.host) : (config?.preview?.host ? String(config.preview.host) : 'localhost')

    // const _build = async () => {
    //   return await build(await getConfig())
    // }

    // let buildProcess: ChildProcess | null = null
    // const _build = async () => {
    //   if (buildProcess) await killProcess(buildProcess)

    //   return new Promise<void>((resolve, reject) => {
    //     let timeoutId: NodeJS.Timeout | null = null

    //     buildProcess = spawn('duto', ['build'], {
    //       // stdio: 'ignore',
    //       stdio: ['inherit', 'ignore', 'inherit', 'ipc'],
    //       shell: process.platform === 'win32'
    //     })

    //     buildProcess.on('close', (code) => {
    //       if (timeoutId) clearTimeout(timeoutId)
    //       buildProcess = null

    //       if (code === 0) {
    //         resolve()
    //       } else {
    //         reject(new Error(`Build failed with code ${code}`))
    //       }
    //     })

    //     buildProcess.on('error', (error) => {
    //       if (timeoutId) clearTimeout(timeoutId)
    //       buildProcess = null
    //       reject(error)
    //     })
    //   })
    // }

		// const killProcess = async (app: ChildProcess | null) => {
		// 	if (!app) return null
		// 	// event('Stopping..')
		// 	try {
		// 		if (!app?.killed) {
		// 			app.kill('SIGTERM')
		// 			await wait(1000)

		// 			if (!app?.killed) { // force kill
		// 				app.kill('SIGKILL')
		// 				await wait(1000)
		// 			}
		// 		}

		// 		return null
		// 	} catch (e) {
		// 		error('Error stopping:', e)
		// 	}

		// 	return null
    // }

    let buildProcess: Bun.Subprocess | null = null

    const _build = async () => {
      if (buildProcess) await killProcess(buildProcess)
      buildProcess = Bun.spawn(['duto', 'build'], {stdin: 'inherit', stdout: 'ignore', stderr: 'inherit'})

      try {
        const code = await buildProcess.exited

        if (code !== 0)
          throw new Error(`Build failed with code ${code}`)
      } finally {
        buildProcess = null
      }
    }

    const killProcess = async (proc: Bun.Subprocess | null) => {
      if (!proc || proc.exitCode !== null) return

      try {
        proc.kill('SIGTERM')

        const exited = await Promise.race([
          proc.exited.then(() => true),
          new Promise(r => setTimeout(r, 1000)).then(() => false),
        ])

        if (!exited && proc.exitCode === null) {
          proc.kill('SIGKILL')
          await proc.exited
        }
      } catch (e) {
        error('Error stopping:', e)
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

        await preview({ port, host })

        log(`Running on http://${host}:${port}`)

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
