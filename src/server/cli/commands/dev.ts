import { join } from 'pathe'
import { spawn, type ChildProcess } from 'node:child_process'

import { command } from 't0n/cli'
import type { Miniflare } from 'miniflare'
import { WRANGLER_CONFIG_FILES, type WranglerConfig } from 'localflare-core'

import { error, event, log, rn, warn } from 't0n/log'
import { getRuntime, shutdown, watch } from 't0n/cli'

import {
	build, wait, normalizePlatform, platformError,
	wranglerConfig, createMiniflare, localflareManifest,
	getDockerHost,
  // findTsx
} from '../utils'
import { _root } from '@/utils'
import { withPort } from 't0n/port'
import { Envir } from 't0n'
import { $dev, setEnv } from '$/utils/environment'

export default command({
	meta: {
		name: 'dev',
		description: '💻 Start the localhost server\n',
	},
	args: {
		port: {
			description: 'Port to listen on',
			type: 'number',
			default: 3000,
		},
		host: {
			description: 'Host to forward requests to, defaults to the zone of project',
			type: 'string',
			default: 'localhost',
		},
		platform: {
			alias: 'p',
			description: 'Environment platform',
			type: 'enum',
			options: ['aws', 'cf', 'node'] as const,
			// required: true,
		},
		minify: {
			description: 'Minify the result',
			type: 'boolean',
			default: true,
		},
	},
  async run({ args }) {
    setEnv($dev)
    const duto = Envir.get('duto', {})
		const platform = normalizePlatform(args.p || args.platform || duto.platform || args._[0] || 'node')
		if (!platform)
			return platformError()

		const desiredPort = args.port ? Number(args.port) : duto?.dev?.port || 3000
		const host = args.host ? String(args.host) : duto?.dev?.host || 'localhost'

		let isBuilding = false
		const startApp = async (start: Function, stop: Function|undefined = undefined, building: boolean = true) => {
			if (building) {
				if (isBuilding) return
				isBuilding = true
				event('Building..')
			}
			const fn = async (silent: boolean = false) => { // @ts-ignore
        building && await build({ platform, silent, minify: args.minify, env: 'dev' })
				await start()
			}

			try {
				await fn()
				watch(async () => {
          // event('Restarting..')
          try {
					  await fn(true)
          } catch (e) {
            error(e)
          }
					// event('Restarted...')
				}, [
          join(_root, '{actions,features,routes,configs,enums,libs,locales,middlewares,models,utils}/**/*.ts'),
          join(_root, 'node_modules/{duto,cripta,t0n}/**/*.ts'),
          join(_root, '.env.dev'),
          join(_root, '.env.prod'),
          join(_root, 'package.json'),
          ...WRANGLER_CONFIG_FILES.map(f => join(_root, f)),
        ], _root)
				// @ts-ignore
				stop && shutdown(stop)
			} catch (e: any) {
        error(e?.stack || e?.message || e)
				process.exit(0)
			} finally {
				isBuilding = false
			}
		}

		const applyExit = async (app: ChildProcess | null) => {
			if (!app) return null

			app //?.on('exit', code => process.exit(code ?? 0))
				.on('message', msg => {
					process.send && process.send(msg)
				}).on('disconnect', () => {
					process.disconnect && process.disconnect()
				})
		}
		const killProcess = async (app: ChildProcess | null) => {
			if (!app) return null
			// event('Stopping..')
			try {
				if (!app?.killed) {
					app.kill('SIGTERM')
					await wait(1000)

					if (!app?.killed) { // force kill
						app.kill('SIGKILL')
						await wait(1000)
					}
				}

				return null
			} catch (e) {
				error('Error stopping:', e)
			}

			return null
		}

		const started = (port: number) => {
			log(`Starting API on http://${host}:${port}`)
			if (platform === 'workerd')
				log(`Localflare on https://studio.localflare.dev`)
			rn()
    }

    withPort(desiredPort, async port => {
      switch (platform) {
        case 'aws':
          started(port)
          let lambda: ChildProcess | null = null
          const stopLambda = async () => {
            lambda = await killProcess(lambda)
          }
          const startLambda = async () => {
            if (lambda) await stopLambda()

            lambda = spawn(
              'sam',
              [
                'local', 'start-api',
                '--warm-containers', 'LAZY',
                '--debug', '--template-file', join(_root, 'template-dev.yaml'),
                '--port', String(port),
              ],
              {
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                // stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                shell: process.platform === 'win32',
                env: {...process.env, DOCKER_HOST: getDockerHost()},
              }
            )
            //.on('exit', code => {
            // 	warn(`Lambda process exited with code ${code ?? 0}`)
            // 	if (code != 0 && code != null)
            // 		error('Lambda process crashed, waiting for restart...')

            // 	lambda = null
            // }).on('message', msg => {
            // 	process.send && process.send(msg)
            // }).on('disconnect', () => {
            // 	process.disconnect && process.disconnect()
            // }).on('error', e => {
            // 	error('Lambda process error:', e)
            // 	lambda = null
            // })
            applyExit(lambda)
            await wait(2000)
          }

          await startApp(startLambda, stopLambda)
          break

        case 'workerd':
          started(port)

          let localflare: Miniflare | null = null
          const startLocalflare = async (workerConfig: WranglerConfig) => {
            if (localflare) return

            localflare = createMiniflare({
              ...workerConfig,
              vars: {
                ...workerConfig.vars,
                LOCALFLARE_MANIFEST: JSON.stringify(localflareManifest(workerConfig)),
              },
              main: '.duto/localfire.js',
              port: 8788,
              inspectorPort: 9230,
            })

            await localflare.ready
          }

          let worker: Miniflare | null = null
          const startWorker = async () => {
            if (worker) await worker.dispose()

            const workerConfig = await wranglerConfig() // @ts-ignore
            workerConfig.host = host // @ts-ignore
            workerConfig.liveReload = false

            worker = createMiniflare({ ...workerConfig, port })
            await worker.ready

            if (!localflare) await startLocalflare(workerConfig)
          }

          await startApp(startWorker)
          break
        default:
        case 'node':
          return console.error('@Deprecated')
          const isBun = getRuntime() === 'bun'
          const isWin32 = process.platform === 'win32'

          const _arg = isBun ? 'run' : findTsx()

          if (!_arg) {
            console.error('Error: "tsx" is not available. Please install tsx:')
            console.error('  npm i -D tsx')
            console.error('  or')
            console.error('  bun i -D tsx')
            process.exit(1)
          }

          started(port)
          const params = isBun
            ? ['--port=' + port, '--hot', '--silent', '--no-clear-screen', '--no-summary']
            : ['watch']

          let nodeApp: ChildProcess | null = null
          const stopNode = async () => {
            nodeApp = await killProcess(nodeApp)
          }

          const startNode = async () => {
            if (nodeApp) await stopNode()

            nodeApp = spawn(
              isBun && isWin32 ? 'bun' : process.execPath,
              [_arg, ...params, join(_root, `node_modules/duto/src/${isBun ? 'app/dev' : 'adapter/node'}.ts`)],
              {
                stdio: ['inherit', isBun ? 'pipe' : 'inherit', 'inherit', 'ipc'],
                env: {...process.env, PORT: port},
              }
            )

            if (isBun && nodeApp?.stdout) {
              nodeApp.stdout?.on('data', data => {
                const output = data.toString()
                if (!output.includes('Started development server'))
                  process.stdout.write(output)
              })
            }

            applyExit(nodeApp)
          }

          await startApp(startNode, stopNode, false)
      }
    })
	},
})
