import { Envir } from 't0n'
import { dirname, join } from 'pathe'

export const _duto = join(dirname(new URL(import.meta.url).pathname), '..')
export const _root = Envir.get('npm_config_local_prefix') || Envir.get('PWD') || join(_duto, '../../../')
