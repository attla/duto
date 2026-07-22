import { defineCommand } from 'citty'
import { withPort } from 't0n/port'
import { error, log, rn } from 't0n/log'
import { getConfig, preview } from '~/utils'
import { _root } from '@/utils'

import { args } from './dev'
import { dim } from 't0n/color'

export default defineCommand({
  meta: {
		name: 'preview',
		description: '💻  Locally preview production build\n',
	}, // @ts-ignore
	args,
  async run({ args }) {
    const config = await getConfig()
		const desiredPort = args.port ? Number(args.port) : (config?.preview?.port ? Number(config.preview.port) : 3000)
    const host = args.host ? String(args.host) : (config?.preview?.host ? config.preview.host as string : 'localhost')

    withPort(desiredPort, async (port) => {
      try {
        await preview({port, host})
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
