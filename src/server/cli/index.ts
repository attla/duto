import { join } from 'pathe'

const cmd = (c: string) => join(import.meta.dirname, 'commands', c)
const make = cmd('make')
const routes = cmd('routes')

export default {
  dev: cmd('dev'),
  build: cmd('build'),
  deploy: cmd('deploy'),
  routes,
  endpoints: routes,
  migrate: cmd('migrate'),
  make,
  'make:config': make,
  'make:enum': make,
  'make:route': make,
  'make:action': make,
  'make:endpoint': make,
  'make:migrate': make,
  'make:migration': make,
  'make:model': make,
  'make:job': make,
  'make:seed': make,
  'make:seeder': make,
  'make:test': make,
}
