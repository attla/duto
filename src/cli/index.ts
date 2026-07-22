import { defineCommand, runMain, renderUsage } from 'citty'
import type { ArgsDef, CommandDef } from 'citty'
import { createConsola } from 'consola'
import { logo } from 't0n/log'
import { isColorSupported, gray } from 't0n/color'
import { version as dutoVersion } from '!/package.json'

// import dev from './commands/dev'
import dev from './commands/dev'
import build from './commands/build'
import preview from './commands/preview'

const name = 'Duto CLI'
const version = [name, isColorSupported ? gray('v'+dutoVersion) : dutoVersion].join(' ')

const _args = process.argv.slice(2)
const length = _args.length
if (!length || (length === 1 && ['-v', '--version', '--v', '-version'].includes(_args[0]))) {
  console.log(version)
  process.exit(0)
}

console.log(`\n${logo} ${version}\n`)

const consola = createConsola({ formatOptions: {date: false} })
async function showUsage<T extends ArgsDef = ArgsDef>(cmd: CommandDef<T>, parent?: CommandDef<T>) {
  try {
    consola.log((await renderUsage(cmd, parent)).split('\n').slice(1).join('\n') + '\n')
  } catch (error) {
    consola.error(error)
  }
}

const main = defineCommand({
  meta: {
    name: 'duto',
    version: '',
    description: name,
  },
  subCommands: {
    dev,
    build,
    preview,
    // deploy,
    // routes,
    // endpoints: routes,
    // migrate,
    // make,
    // 'make:config': make,
    // 'make:enum': make,
    // 'make:route': make,
    // 'make:action': make,
    // 'make:endpoint': make,
  },
})

runMain(main, { rawArgs: length ? undefined : ['-h'], showUsage })
