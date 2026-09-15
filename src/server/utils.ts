import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'pathe'
import { _root } from '@/utils'

export function getLastCommitHash(path: string = '.git') {
  try {
    const gitDir = join(_root, path)

    let headContent = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim()

    if (headContent.startsWith('ref:'))
      headContent = readFileSync(join(gitDir, headContent.substring(5)), 'utf8').trim()

    return headContent
  } catch (e) {
    return null
  }
}

export function ensureDir(filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}



let id = '';
export const nextId = () => {
  const chars = id.split('')
  let i = chars.length - 1

  while (i >= 0) {
    if (chars[i] === 'z') {
      chars[i] = 'A'
      i--
    } else if (chars[i] === 'Z') {
      chars[i] = 'a'
      i--
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      return id = chars.join('')
    }
  }

  return id = 'a' + chars.join('')
}

export const verbAlias = {
  get: 0,
  post: 1,
  put: 2,
  patch: 3,
  delete: 4,
  head: 5,
  options: 6,
  connect: 7,
  trace: 8,
} as Record<string, number>

export const getVerb = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'connect',
  'trace',
]

