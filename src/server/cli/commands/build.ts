import { Envir } from 't0n'
import { command } from 't0n/cli'
import { gray } from 't0n/color'
import { wait, error, rn } from 't0n/log'
import { platforms, build, normalizePlatform, platformError } from '../utils'

export default command({
	meta: {
		name: 'build',
		description: '🗂️  Perform the build\n',
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
	async run({ args }) {
    const platform = normalizePlatform(args.p || args.platform || Envir.get('duto.platform') || args._[0] || 'node')
		if (!platform)
			return platformError()

		wait('Building for platform: '+ gray(platform))

		try { // @ts-ignore
      await build({ platform, minify: args.minify })
    } catch (e: any) {
			error('Build failed:\n\n', e)
			process.exit(0)
		} finally {
			rn()
		}
	},
})
