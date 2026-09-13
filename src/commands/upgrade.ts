import { command } from 't0n/cli'
import { dim, green } from 't0n/color'
import { event, error, step, log, rn } from 't0n/log'
import { _root } from '@/utils'
import { version } from '!/package.json'

import { createSpinner } from 'nanospinner'

export default command({
	meta: {
		name: 'upgrade',
		description: '📄 Upgrade to latest version of Duto\n',
	},
  async run({ args }) { // @ts-ignore
    const spinner = createSpinner('Upgrading...').start()

    const proc = Bun.spawn(['bun', 'update', '-g', 'duto'], { stdout: 'ignore', stderr: 'ignore' })
    const exitCode = await proc.exited

    if (exitCode === 0) {
      spinner.success({ text: 'Upgraded' })
    } else {
      spinner.error({ text: `Falha ao atualizar duto (exit ${exitCode})` })
      process.exit(exitCode)
    }

    event(green('Congrats!') + ` You're already on the latest version of Duto.`)
    // event(green('Congrats!') + ` You're already on the latest version of Duto ${dim(`(which is v${version})`)}`)
	},
})
