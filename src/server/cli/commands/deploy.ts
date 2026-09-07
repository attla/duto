import { spawn } from 'node:child_process'
import { Envir } from 't0n'
import { command } from 't0n/cli'
import { error } from 't0n/log'
import { getRuntime } from 't0n/cli'

import { build, platforms, normalizePlatform, platformError } from '../utils'
import { _root } from '@/utils'

// import build from './build'

export default command({
	meta: {
		name: 'deploy',
		description: '☁️  Perform the build and execute deploy\n',
	},
	args: {
		platform: {
			alias: 'p',
			description: 'Environment platform',
			type: 'enum',
			options: platforms,
    },
		minify: {
			description: 'Minify the result',
			type: 'boolean',
			default: true,
		},
	},
	async run({ args }) { // @ts-ignore
		const platform = normalizePlatform(args.p || args.platform || args._[0] || Envir.get('duto.platform'))
		if (!platform)
			return platformError()

		// @ts-ignore
    await build({ platform, minify: args.minify })
		const isBun = getRuntime() === 'bun'

		switch (platform) {
			case 'aws':
				// TODO: perform aws deploy
				return error('Platform not yet implemented, contact the webmaster')
			case 'workerd':
				const child = spawn(
					isBun ? 'bunx' : 'npx',
					['wrangler', 'deploy'],
					{
						stdio: 'inherit',
						cwd: _root,
					}
				)

				child.on('exit', code => process.exit(code ?? 0))
					.on('message', msg => {
						process.send && process.send(msg)
					}).on('disconnect', () => {
						process.disconnect && process.disconnect()
					})

				return
			case 'vercel':
				return error('Platform not yet implemented, contact the webmaster')
				const vchild = spawn(
					isBun ? 'bunx' : 'npx',
					['vercel', 'deploy'],
					{
						stdio: 'inherit',
						cwd: _root,
					}
				)

				vchild.on('exit', code => process.exit(code ?? 0))
					.on('message', msg => {
						process.send && process.send(msg)
					}).on('disconnect', () => {
						process.disconnect && process.disconnect()
					})

				return
    }
	},
})
