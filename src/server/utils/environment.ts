export const $prd = Symbol('prd')
export const $dev = Symbol('dev')

let env = $prd

export const getEnv = () => env
export const setEnv = (e: symbol) => env = e

export const isEnv = (e: symbol) => env === e

export const isDev = () => env === $dev
export const isDevelop = isDev
export const isDevelopment = isDev

export const isPrd = () => env === $prd
export const isProd = isPrd
export const isProduction = isPrd
