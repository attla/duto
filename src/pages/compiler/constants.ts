export const PAGE_RE = /\/pages\/.*\.(tsx?|jsx?)$/i
export const EXT_RE = /\.(tsx?|jsx?)$/i
export const DYNAMIC_RE = /\[/
export const INTERNAL_RE = /(?:.*\/)?_?(layout|error|template|loading)\.(tsx?|jsx?)$/i
export const LAYOUT_RE = /(?:.*\/)?_?(layout)\.(tsx?|jsx?)$/i
export const DOCTYPE_RE = /<!doctype html/i

// export const USE_CLIENT_RE = /^[\s\r\n]*["']use client["'](?=[\s\r\n]|$)/m
export const USE_CLIENT_RE = /^(?:\s|\/\/.*\n|\/\*[\s\S]*?\*\/)*["']use client["'](?=\s|;|$)/

export const LAYOUT_NAMES = ['_layout', 'layout']
export const NF_NAMES = ['404', 'not-found']
export const FILE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']
export const CONFIG_EXTENSIONS = ['json', 'toml', 'yaml', 'json5', 'jsonc']
export const EXTENSIONS = [...FILE_EXTENSIONS, ...CONFIG_EXTENSIONS]

export const EXTENSIONS_LIST = new Set([
  // ===== IMAGES =====
  'jpg', 'jpeg', 'jpe', 'jfif', 'png', 'gif', 'bmp', 'dib', 'webp', 'svg', 'svgz',
  'ico', 'tif', 'tiff', 'heic', 'heif', 'avif', 'raw', 'cr2', 'nef', 'arw', 'dng',
  'psd', 'ai', 'eps', 'indd', 'sketch', 'fig', 'xd',

  // ===== DOCS =====
  'pdf', 'doc', 'docx', 'docm', 'dot', 'dotx', 'xls', 'xlsx', 'xlsm', 'xlsb',
  'xlt', 'xltx', 'ppt', 'pptx', 'pptm', 'pot', 'potx', 'pps', 'ppsx',
  'txt', 'text', 'rtf', 'odt', 'ods', 'odp', 'odg', 'ott', 'ots', 'otp',
  'pages', 'numbers', 'key', 'epub', 'mobi', 'azw', 'azw3', 'djvu', 'tex', 'latex',

  // ===== AUDIO =====
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'oga', 'opus', 'wma', 'm4a', 'm4b',
  'aiff', 'aif', 'alac', 'ape', 'wv', 'mid', 'midi', 'amr', 'ac3', 'dts',

  // ===== VIDEO =====
  'mp4', 'm4v', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'f4v', 'webm', 'mpg', 'mpeg',
  'mpe', 'm2v', '3gp', '3g2', 'ogv', 'ts', 'mts', 'm2ts', 'vob', 'rm', 'rmvb',
  'asf', 'divx', 'xvid',

  // ===== COMPACT =====
  'zip', 'rar', '7z', 'tar', 'gz', 'gzip', 'bz2', 'bzip2', 'xz', 'lz', 'lzma',
  'z', 'tgz', 'tbz', 'tbz2', 'txz', 'cab', 'iso', 'img', 'dmg', 'jar', 'war',
  'ear', 'apk', 'ipa', 'deb', 'rpm', 'msi', 'pkg', 'snap', 'flatpak',

  // ===== DEV =====
  // Web
  'html', 'htm', 'xhtml', 'shtml', 'css', 'scss', 'sass', 'less', 'styl',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'vue', 'svelte', 'astro',

  // Backend / Geral
  'py', 'pyw', 'pyi', 'pyx', 'rb', 'rbw', 'php', 'php3', 'php4', 'php5', 'phtml',
  'java', 'class', 'jar', 'kt', 'kts', 'scala', 'sc', 'groovy', 'gradle',
  'c', 'h', 'cc', 'cpp', 'cxx', 'c++', 'hpp', 'hxx', 'h++', 'cs', 'csx',
  'go', 'rs', 'swift', 'm', 'mm', 'dart', 'lua', 'pl', 'pm', 't', 'raku',
  'r', 'rmd', 'jl', 'nim', 'zig', 'v', 'cr', 'ex', 'exs', 'erl', 'hrl',
  'clj', 'cljs', 'cljc', 'edn', 'hs', 'lhs', 'ml', 'mli', 'fs', 'fsx', 'fsi',
  'elm', 'purs', 'reason', 're', 'rei', 'ocaml', 'pas', 'pp', 'f', 'f90', 'f95',
  'for', 'f77', 'asm', 's', 'nasm', 'wasm', 'wat', 'sol', 'move', 'cairo',
  'vb', 'vbs', 'vba', 'bas', 'frm', 'cls', 'ada', 'adb', 'ads',
  'cob', 'cbl', 'cobol', 'pro', 'prolog', 'lisp', 'lsp', 'cl', 'el', 'scm',
  'rkt', 'tcl', 'awk', 'sed', 'ahk', 'au3', 'applescript', 'scpt',

  // Shell / Scripts
  'sh', 'bash', 'zsh', 'fish', 'ksh', 'csh', 'tcsh', 'ps1', 'psm1', 'psd1',
  'bat', 'cmd', 'btm',

  // ===== DATA / CONFIGS =====
  'json', 'json5', 'jsonc', 'jsonl', 'ndjson', 'geojson', 'topojson',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config', 'properties', 'env',
  'xml', 'xsd', 'xsl', 'xslt', 'dtd', 'rss', 'atom', 'plist',
  'csv', 'tsv', 'psv', 'dsv', 'parquet', 'avro', 'orc', 'arrow', 'feather',
  'sql', 'sqlite', 'sqlite3', 'db', 'mdb', 'accdb', 'dbf', 'dump',
  'graphql', 'gql', 'proto', 'thrift', 'avsc', 'capnp',
  'lock', 'editorconfig', 'gitignore', 'gitattributes', 'npmrc', 'nvmrc',
  'dockerignore', 'htaccess', 'htpasswd',

  // ===== MARKUP / DOCS =====
  'md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx', 'rst', 'adoc', 'asciidoc',
  'org', 'wiki', 'textile', 'creole', 'pod',

  // ===== FONTS =====
  'ttf', 'otf', 'woff', 'woff2', 'eot', 'fon', 'fnt', 'pfb', 'pfm',

  // ===== 3D / CAD / MODEL =====
  'obj', 'fbx', 'dae', '3ds', 'max', 'blend', 'stl', 'step', 'stp', 'iges', 'igs',
  'dwg', 'dxf', 'dgn', 'skp', 'sldprt', 'sldasm', 'ipt', 'iam', 'prt', 'asm',
  'gltf', 'glb', 'usd', 'usda', 'usdc', 'usdz', 'abc', 'ply', 'x3d',

  // ===== EXE / BINS =====
  'exe', 'com', 'scr', 'pif', 'msi', 'msp', 'appx', 'appxbundle', 'msix',
  'app', 'dmg', 'pkg', 'mpkg', 'deb', 'rpm', 'apk', 'ipa', 'snap', 'flatpak',
  'appimage', 'run', 'bin', 'elf', 'so', 'dll', 'dylib', 'lib', 'a', 'o', 'obj',
  'out', 'ko', 'sys', 'drv', 'ocx', 'cpl',

  // ===== CERT / SECURITY =====
  'pem', 'crt', 'cer', 'der', 'pfx', 'p12', 'key', 'pub', 'asc', 'gpg', 'pgp',
  'csr', 'crl', 'jks', 'keystore',

  // ===== SUBTITLES =====
  'srt', 'vtt', 'ass', 'ssa', 'sub', 'sbv', 'ttml', 'dfxp',

  // ===== EBOOKS =====
  'epub', 'mobi', 'azw', 'azw3', 'fb2', 'lit', 'lrf', 'pdb', 'prc', 'cbr', 'cbz',

  // ===== OTHERS / LOGS =====
  'log', 'tmp', 'temp', 'bak', 'backup', 'old', 'orig', 'swp', 'swo',
  'pid', 'sock', 'srt', 'diff', 'patch', 'rej'
])
