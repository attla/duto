import { join } from 'pathe'

const cmd = (c: string) => join(import.meta.dirname, 'commands', c)

export default {
  dev: cmd('dev'),
  build: cmd('build'),
  preview: cmd('preview'),
  // deploy: cmd('deploy'),
}
