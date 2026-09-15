import { getConfig } from '$/config'
import { registerOpenAPI } from '$/open-api/register'
import { Ability } from '$/auth'
import $ from '$/app'

// @ts-ignore
import '.duto/imports.mjs'
// @ts-ignore
import { routes, middlewares } from '.duto/imports.mjs'

// @ts-ignore
Ability.fromRoutes(routes)
Ability.roles = getConfig('roles', {})

// @ts-ignore
const app = $({ routes, middlewares })
registerOpenAPI(app, getConfig('duto.docs', {}))

export { app }
