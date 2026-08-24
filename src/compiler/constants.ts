export const PAGE_RE = /\/pages\/.*\.(tsx?|jsx?)$/i
export const EXT_RE = /\.(tsx?|jsx?)$/i
export const DYNAMIC_RE = /\[/
export const INTERNAL_RE = /(?:.*\/)?_?(layout|error|template|loading)\.(tsx?|jsx?)$/i
export const LAYOUT_RE = /(?:.*\/)?_?(layout)\.(tsx?|jsx?)$/i
export const DOCTYPE_RE = /<!doctype html/i

// export const USE_CLIENT_RE = /^[\s\r\n]*["']use client["'](?=[\s\r\n]|$)/m
export const USE_CLIENT_RE =  /^(?:\s|\/\/.*\n|\/\*[\s\S]*?\*\/)*["']use client["'](?=\s|;|$)/
// export const IMPORT_RE = /import\s+(?:type\s+)?(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]/g
export const IMPORT_RE = /(?:\/\/.*|\/\*[\s\S]*?\*\/)|import\s+(?:type\s+)?(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]/g
export const BROWSER_ONLY = [
  'preact', '@preact/signals',
  'react', 'react-dom',
  'wouter', 'wouter-preact',
  'framer-motion', 'gsap', 'three',
]
export const BROWSER_ONLY_SET = new Set(BROWSER_ONLY)

export const LAYOUT_NAMES = ['_layout', 'layout']
export const NF_NAMES = ['404', 'not-found']
export const FILE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'] as const
export const CONFIG_EXTENSIONS = ['json', 'toml', 'yaml'] as const
export const EXTENSIONS = [...FILE_EXTENSIONS, ...CONFIG_EXTENSIONS] as const
