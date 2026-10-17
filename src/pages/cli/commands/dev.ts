import { command } from 't0n/cli'
import { withPort } from 't0n/port'
import { _root, shell } from '@/utils'
import { getConfig, preview } from '../utils'
import { getEnv, setEnv } from 't0n'

import { meta, build, watchBuild } from '#/compiler/bun-plugin'

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
  args: {
    ...args,
		minify: {
			description: 'Minify the result',
			type: 'boolean',
			default: true,
		},
  },
  async run({ args }) {
    setEnv('duto.hmr', true)
    setEnv('duto.minify', args.minify ?? true)

    const duto = getEnv('duto', {})
    const desiredPort = Number(args.port || duto?.dev?.port || 3000)
    const host = String(args.host || duto?.dev?.host || 'localhost')

    const config = await getConfig()

    withPort(desiredPort, shell(async (port) => {
      setEnv('duto.dev.port', port)
      setEnv('duto.dev.host', host)

      await build(config)
      await preview(meta(), host, port)

      watchBuild(config)
    }))
	},
})
