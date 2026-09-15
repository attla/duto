import { command } from 't0n/cli'
import { dim } from 't0n/color'
import { error, log, rn } from 't0n/log'
import { withPort } from 't0n/port'
import { getMetadata } from '#/compiler/meta'
import { _root } from '@/utils'
import { args } from './dev'
import { getConfig, preview } from '../utils'
import { getEnv } from 't0n'

export default command({
  meta: {
		name: 'preview',
		description: '💻  Locally preview production build\n',
	}, // @ts-ignore
	args,
  async run({ args }) {
    const config = await getConfig()
    const duto = getEnv('duto', {})
		const desiredPort = Number(args.port || duto?.dev?.port || 3000)
		const host = String(args.host || duto?.dev?.host || 'localhost')

    withPort(desiredPort, async (port) => {
      try {
        await preview(await getMetadata(config.root as string, config.pagesDir as string), host, port)
        log(`Running on http://${host}:${port}${global?.__st ? dim(` in ${Math.ceil(performance.now() - global.__st)} ms`) : ''}`)
      } catch (e: any) {
        error('Preview failed:', e?.message || e)
        process.exit(0)
      } finally {
        rn()
      }
    })
	},
})
