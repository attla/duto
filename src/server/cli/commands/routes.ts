import { command } from 't0n/cli'
import { rn } from 't0n/log'
import { _duto } from '@/utils'
import { highlightedURI, highlightedMethod } from '../utils'
import { getRoutes } from '$/routes'

export default command({
	meta: {
		name: 'routes',
		description: '📒 Displays all registered routes\n',
	},
	args: {
		path: {
			description: 'Filter the routes by path',
			type: 'string',
		},
		method: {
			description: 'Filter the routes by method',
			type: 'string',
		},
		reverse: {
			description: 'Reverse the ordering of the routes',
			type: 'boolean',
		},
	},
	async run({ args }) {
		const opts = {
			path: args?.path || '',
			method: args?.method?.toUpperCase() || '',
			reverse: !!args?.reverse,
		}

		const keys: Set<string> = new Set()
		let maxMethodLength = 0
		let maxPathLength = 0

		let routes = (await getRoutes())
      .filter(({ method, path }) => {
        method = method.toUpperCase()
				const key = method + '-' + path
				if (keys.has(key)) return false
				keys.add(key)

				let mLength = method.length
				if (method === 'GET') mLength += 5

				maxMethodLength = Math.max(maxMethodLength, mLength)
				maxPathLength = Math.max(maxPathLength, path.length)

				return [
					opts.path ? path.startsWith(opts.path) : true,
					opts.method ? method === opts.method : true,
				].every(Boolean)
			})

    if (!routes.length) {
      console.log('  No route found.')
      return rn()
    }

		if (opts.reverse)
			routes = routes.reverse()

		routes.forEach(route => {
			if (!route) return
      const method = route.method.toUpperCase()

			let mLength = method.length
			let str = highlightedMethod(method, null, true)

			if (method === 'GET')
				mLength += 5

			console.log(str + ' '.repeat(maxMethodLength - mLength) +'  '+ highlightedURI(route.path, method))
		})

		rn()
	},
})
