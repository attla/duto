#!/usr/bin/env bun

function exit(msg?: string, desc?: string) {
  msg && console.error(msg)
  desc && console.log(desc)
  process.exit(0)
}

if (!import.meta.main)
  exit('Error: Duto must be used directly as CLI command.')

if (!process?.isBun || typeof Bun === 'undefined')
  exit('Error: "Bun" is not available.', '  Try install: https://bun.sh/get')

global.__st = performance.now()

import { join } from 'pathe'
import { cli } from 't0n/cli'
import { Envir } from 't0n'
import { version } from '!/package.json'
import { _root, _duto } from './utils'

const cmd = (c: string) => join(import.meta.dirname, 'commands', c)

let pkg
let commands = {}
try {
  pkg = await import(join(_root, 'package.json'))
  if (!pkg || !pkg.duto || !pkg?.duto?.type || !['pages', 'server'].includes(pkg.duto.type))
    exit('Error: invalid app type.')

  Envir.set('duto', pkg.duto)
  commands = (await import(join(_duto, pkg.duto.type, 'cli')))?.default
} catch {}

cli({
  name: 'duto',
  description: 'Duto',
  version,
  commands: {
    new: cmd('new'),
    upgrade: cmd('upgrade'),
    ...commands,
  },
})
