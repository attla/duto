import { join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { resolveExtension } from './file'

export function getTsConfig(configPath = './tsconfig.json') {
  const content = readFileSync(configPath, 'utf8')
  return JSON.parse(content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))
}

export function getAliases(root: string) {
  const tsconfig = getTsConfig(join(root, './tsconfig.json'))
  const compilerOptions = tsconfig.compilerOptions || {}
  const paths = Object.entries(compilerOptions.paths || {})
  const baseUrl = compilerOptions.baseUrl || '.'

  const aliases = {}

  for (const [aliasPattern, targetPatterns] of paths) // @ts-ignore
    aliases[aliasPattern.replace(/\/\*$/, '')] = resolve(process.cwd(), baseUrl, targetPatterns[0].replace(/\/\*$/, ''))

  return aliases
}

export function resolveAlias(importPath: string, aliases: Record<string, string>) {
  for (const [alias, realPath] of Object.entries(aliases)) {
    if (importPath.startsWith(alias +'/') || importPath === alias) {
      const subPath = importPath.substring(alias.length)
      const cleanSubPath = subPath.startsWith('/') ? subPath.substring(1) : subPath
      const resolved = join(realPath, cleanSubPath)

      return resolveExtension(resolved) ?? resolved
    }
  }

  return resolveExtension(importPath) ?? importPath
}
