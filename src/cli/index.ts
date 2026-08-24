#!/usr/bin/env bun

if (!process?.isBun || typeof Bun === 'undefined') {
  console.error('Error: "Bun" is not available. Please install:')
  console.log('  curl -fsSL https://bun.sh/install | bash')
  process.exit(0)
}

global.__st = performance.now()

import { join } from 'pathe'
import { cli } from 't0n/cli'
import { version } from '!/package.json'

if (typeof document === 'undefined' && import.meta.main) {
  const cmd = (c: string) => join(import.meta.dirname, 'commands', c)

  cli({
    name: 'duto',
    description: 'Duto CLI',
    version,
    commands: {
      dev: cmd('dev'),
      build: cmd('build'),
      preview: cmd('preview'),
    }
  })
}
