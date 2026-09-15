
import { get, set } from 't0n'

const obj: Record<string, unknown> = {}

export function getConfig<T = unknown>(key: string, defaultValue: T): T
export function getConfig<T = unknown>(key: string, defaultValue?: T): T | undefined
export function getConfig<T = unknown>(key: string, defaultValue?: T) {
  return get<T>(obj, key, defaultValue)
}
export const setConfig = (key: string, val: unknown) => set(obj, key, val)
export function addConfig<T = unknown>(data: Record<string, T>) {
  Object.assign(obj, data)
}
// export const getConfig = <T = unknown>(key: string, defaultValue?: T) => get<T>(obj, key, defaultValue)
// import { DataBag } from 't0n'

// const Config = new DataBag()
// export default Config
