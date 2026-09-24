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

const types = ['pages', 'server']
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
    type: {
      description: 'Project type',
      type: 'enum',
      options: types,
    },
    template: {
			alias: 't',
      description: 'Template to use',
      type: 'enum',
      options: templates,
    },
  },
	async run({ args }) { // @ts-ignore
    let dir = args._[0]
    if (dir) {
      step(bold('Using target directory: '+ dim('/'+ dir.replace(/^\//, ''))))
    } else {
      dir = await input({ message: 'Target directory', default: _root })
      if (!dir.startsWith(_root))
        dir = join(_root, dir)
    }

    const type = args.type || (await select({
      loop: true,
      message: 'Which type of project is it?',
      choices: types.map(v => ({ title: v, value: v})),
    }))

    if (!type)
      throw new Error('No type selected')
    if (!types.includes(type))
      throw new Error(`Invalid type selected: ${type}`)

    const dirs = ['base']
    const name = basename(/^(\.\/|\.\\|\.)$/.test(dir) ? _root : dir)

    if (type === 'server') {
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

      dirs.push(template)
    }

    if (
      existsSync(dir) && readdirSync(dir).length > 0
      && !(await confirm({ message: 'Directory not empty. Continue?', default: false }))
    ) {
      process.exit(1)
    } else {
      mkdirp(dir)
    }

    const spinner = createSpinner('Cloning the template').start()
    for (const d of dirs) {
      const templateDir = resolve(import.meta.dir, `./templates/${type}/`+ d)
      const files = readdirSync(templateDir)
      for (const file of files)
        copy(join(templateDir, file), join(dir, renameFiles[file] ?? file))
    }

    spinner.success()

    const pkgPath = join(dir, 'package.json')
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
    if (dir != _root) {
      rn()
      console.log(
        dim('Get started with:'),
        bold(`cd ${name} && duto`),
      )
    }
	},
})
