import type { PropNameToSignalMap, SignalLike } from './types'

export type Context = {
	id: string;
	c: number;
	islandCount: number;
	signals: Map<SignalLike, string>;
	propsToSignals: Map<Record<string, any>, PropNameToSignalMap>;
}

const contexts = new Map<string, Context>()

export function getContext(id: string): Context {
	if (contexts.has(id))
		return contexts.get(id)!

	let ctx = {
		c: 0,
		islandCount: 0,
		get id() {
			return 'p' + this.c.toString()
		},
		signals: new Map(),
		propsToSignals: new Map(),
	}

	contexts.set(id, ctx)
	return ctx
}

export function incrementId(ctx: Context): string {
	let id = ctx.id
	ctx.c++
	return id
}

export function incrementIslandId(ctx: Context): number {
	const islandId = ctx.islandCount
	ctx.islandCount++
	return islandId
}
