import { getEnv } from 't0n'
import { command } from 't0n/cli'
import { withPort } from 't0n/port'
import { getMetadata } from '#/compiler/meta'
import { _root, shell } from '@/utils'
import { args } from './dev'
import { getConfig, preview } from '../utils'

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

    withPort(desiredPort, shell(async (port) => {
      await preview(await getMetadata(config), host, port)
    }))
	},
})
