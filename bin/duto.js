#!/usr/bin/env node

if (!process?.isBun || typeof Bun === 'undefined') {
  console.error('Error: "Bun" is not available. Please install:')
  console.log('  curl -fsSL https://bun.sh/install | bash')
  process.exit(0)
}

global.__st = performance.now()

try {
  import('../src/cli/index.ts')
  // await import('../src/cli/index.ts')
} catch (e) {
  console.error(e)
  process.exit(1)
}

// Node.js compat

// import { spawn } from 'node:child_process';
// import { join, dirname, resolve } from 'node:path';
// import { existsSync } from 'node:fs';
// import { fileURLToPath } from 'node:url';

// const __dirname = dirname(fileURLToPath(import.meta.url));

// const runtime = (() => {
//   try {
//     const arg = (process.argv[1] || '')?.replace(/\\/g, '/');

//     if (arg?.endsWith('.bin/duto'))
//       return 1

//     if (arg?.endsWith('duto/bin/duto.js'))
//       return 2
//   } catch {}

//   return 0
// })()

// if (runtime) {
//   runDuto()
// }

// function runDuto() {
//   const isBun = process?.isBun || typeof Bun !== 'undefined';
//   const targetScript = resolve(__dirname, '../src/cli/index.ts');

//   let executor = process.execPath;
//   let args = [];

//   if (isBun) {
//     args = [targetScript, ...process.argv.slice(2)];
//   } else {
//     const tsxBin = findTsx();

//     if (!tsxBin) {
//       console.error('Error: "tsx" is not available. Please install tsx:');
//       console.error('  npm i -D tsx');
//       console.error('  or');
//       console.error('  bun i -D tsx');
//       process.exit(1);
//     }

//     args = [
//       '--no-warnings',
//       tsxBin,
//       targetScript,
//       ...process.argv.slice(2)
//     ].filter(arg => !arg.includes('experimental-vm-modules') && !arg.includes('loader'));
//   }

//   return execute(executor, args)
// }

// function findTsx() {
//   const exts = ['', '.exe', '.cmd'];
//   const paths = [
//     [__dirname, '../node_modules/tsx/dist/cli.mjs'],
//     [process.cwd(), 'node_modules/tsx/dist/cli.mjs'],
//     [__dirname, '../node_modules/.bin/tsx'],
//     [process.cwd(), 'node_modules/.bin/tsx'],
//   ];

//   for (const _path of paths) {
//     const path = join(..._path);
//     for (const ext of exts) {
//       const entry = path + ext;
//       if (existsSync(entry)) return entry;
//     }
//   }

//   return ''
// }

// function execute(command, args) {
//   const child = spawn(command, args, {
//     stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
//     env: {
//       ...process.env,
//       NODE_ENV: process.env.NODE_ENV || 'development',
//       TSX_DISABLE_CACHE: '1',
//     }
//   });

//   process.on('SIGINT', () => child.kill('SIGINT'))
//     .on('SIGTERM', () => child.kill('SIGTERM'));

//   return child
//     .on('exit', code => process.exit(code ?? 0))
//     .on('message', msg => process.send?.(msg))
//     .on('disconnect', () => process.disconnect?.())
// }
