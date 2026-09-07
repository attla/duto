import Config from '$/config'
import { registerOpenAPI } from '$/open-api/register'
import { Ability } from '$/auth'
import $ from '$/app'

// @ts-ignore
import '.duto/imports.mjs'
// @ts-ignore
import { routes, middlewares } from '.duto/imports.mjs'

// @ts-ignore
Ability.fromRoutes(routes)
Ability.roles = Config.get('roles', {})

// @ts-ignore
const app = $({ routes, middlewares })
registerOpenAPI(app, Config.get('duto.docs', {}))

export { app }
