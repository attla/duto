import res from './response'
import $v from './validator'
import { GET_REQUEST } from './request'
import type { Context, Next, RuleFactory } from './types'

export const _mw: Record<string, Function> = {}
export const getMiddlewares = () => _mw
export function getMiddleware(id: string | Function): Function {
  if (typeof id === 'function') return id
  const mw = _mw[id] || null
  if (!mw) throw new Error(`Handler ${id} not registered`)
  return mw
}
export function registerMiddleware(id: string, handler: Function) {
  _mw[id] = handler
}

export const resolveMw = (mw: Function) => {
  return mw.length < 3 ? mw : async (c: Context, next: Next) => await getMiddleware(mw)(c.get(GET_REQUEST as unknown as string), res, next, c)
}

export const resolveHandle = (mw: (string | Function)[], handle: Function, ruleFn?: RuleFactory) => {
  const h = async (c: Context) => await handle(c.get(GET_REQUEST as unknown as string), res)
  mw = mw?.length ? mw.map(getMiddleware) : []

  const rules = typeof ruleFn === 'function' ? ruleFn($v) : null
  if (!rules) return [...mw, h]

  return [...mw, ...$v.parse(rules), h]
}
