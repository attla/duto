import { basename, join, relative, resolve } from 'pathe'
import { command } from 't0n/cli'
import { bold, dim, green, red } from 't0n/color'
import { event, error, step, log, rn } from 't0n/log'
import { _root } from '@/utils'

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import confirm from '@inquirer/confirm'
import input from '@inquirer/input'
import select from '@inquirer/select'
import { createSpinner } from 'nanospinner'
import { exit } from 'node:process'

const templates = [
  'aws',
  'workerd',
  'vercel',
]

const renameFiles: Record<string, string | undefined> = {
  _gitignore: '.gitignore',
  _gitkeep: '.gitkeep',
}


function mkdirp(dir: string) {
  try {
    mkdirSync(dir, { recursive: true })
  } catch (e) {
    if (e instanceof Error) {
      if ('code' in e && e.code === 'EEXIST') {
        return
      }
    }
    throw e
  }
}

function copy(src: string, dest: string) {
  const stat = statSync(src)
  stat.isDirectory()
    ? copyDir(src, dest)
    : copyFileSync(src, dest)
}
function copyDir(srcDir: string, destDir: string) {
  mkdirSync(destDir, { recursive: true })
  for (const file of readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

export default command({
	meta: {
		name: 'new',
		description: '📄 Create new project with duto\n',
	},
  args: {
    install: {
			alias: 'i',
      description: 'Install dependencies',
      type: 'boolean',
      default: false,
    },
    template: {
			alias: 't',
      description: 'Template to use',
      type: 'enum',
      options: templates,
    },
  },
	async run({ args }) { // @ts-ignore
    const root = process.cwd() || process.env?.PWD || process.stdin?.path
    let dir = args._[0]
    if (dir) {
      step(bold('Using target directory: '+ dim('/'+ dir.replace(/^\//, ''))))
    } else {
      dir = await input({ message: 'Target directory', default: root })
      if (!dir.startsWith(root))
        dir = join(root, dir)
    }

    const name = basename(/^(\.\/|\.\\|\.)$/.test(dir) ? root : dir)
    const template = args.template || (await select({
      loop: true,
      message: 'Which template do you want to use?',
      choices: templates.map(v => ({ title: v, value: v})),
      default: 'workerd',
    }))

    if (!template)
      throw new Error('No template selected')

    if (!templates.includes(template))
      throw new Error(`Invalid template selected: ${template}`)

    if (existsSync(dir) && readdirSync(dir).length > 0) {
      const response = await confirm({ message: 'Directory not empty. Continue?', default: false })
      if (!response) process.exit(1)
    } else {
      mkdirp(dir)
    }

    const spinner = createSpinner('Cloning the template').start()
    for (const t of ['base', template]) {
      const templateDir = resolve(import.meta.dir, './templates/'+ t)
      const files = readdirSync(templateDir)
      for (const file of files.filter(f => f !== 'package.json'))
        copy(join(templateDir, file), join(dir, renameFiles[file] ?? file))
    }

    spinner.success()

    const pkgPath = resolve(__dirname, `./templates/base/package.json`)
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      pkg.name = name
      writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
    }

    if (args?.install) {
      const spinner2 = createSpinner('Installing project dependencies').start()
      const proc = Bun.spawn(['bun', 'i'], { stdout: 'ignore', stderr: 'inherit' })
      const procExit = await proc.exited

      if (procExit === 0) {
        spinner2.success()
      } else {
        spinner2.stop({
          mark: red('×'),
          text: 'Failed to install project dependencies',
        })
        exit(procExit)
      }
    }

    event('New project successfully created')
    if (dir != root) {
      rn()
      console.log(
        dim('Get started with:'),
        bold(`cd ${name}`),
      )
    }
	},
})
