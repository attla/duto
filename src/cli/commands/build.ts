import { defineCommand } from 'citty'
import { build } from 'vite'
import { filesize } from 'filesize'
import { wait, error, rn, event } from 't0n/log'
import { getConfig } from '~/utils'
import { meta } from '@/vite-plugin'
import { dim, underline } from 't0n/color'
import type { SummaryMetadata } from '@/types'

export default defineCommand({
	meta: {
		name: 'build',
		description: '🗂️  Perform the build for production\n',
	},
	args: {
	},
	async run({ args }) {
    wait('Building..')

		try {
      await build(await getConfig())
      const st = global?.__st ? Math.ceil(performance.now() - global.__st) : 0
      const metadata = meta()

      const trunc = (str: string, length: number, width = 35) => length > width ? str.slice(0, width - 3) + '...' : str + (length < width ? ' '.repeat(width - length) : '')

      const format = (row: SummaryMetadata, i: number, max: number, deep: boolean = false) => {
        let str = (deep ? (i === max - 1 ? '└' : '├') : (i === 0 ? '┌' : (i === max - 1 ? '└' : '├'))) + ' '

        if (!deep) str += (['○', '●', '⌾'][row.type] || '○') + ' '
        const size = filesize(row.sizeBr || 0)
        return dim(str + [row.path, size + ' '.repeat(10 - size.length) + filesize(row.size || 0)].map(col => trunc(col, col.length, deep ? 33 : 35)).join(''))
      }

      rn()
      console.log('    '+ ['Route', 'Size'].map(col => trunc(dim(underline(col)), col.length)).join(''))

      let i = 0
      const max = metadata.summary.size
      for (const [, row] of metadata.summary) {
        console.log(format(row, i, max))

        if (row.children?.size) {
          let i2 = 0
          const max2 = row.children.size
          for (const [, r] of row.children) {
            console.log(dim('├   ')+ format(r, i2, max2, true))
            i2++

            if (i2 > 3 && max2 > 4) {
              console.log(dim(`    [+${max2 - i2} more paths]`))
              break
            }
          }
        }
        i++
      }

      rn(2)
      console.log(dim('○ [Static] prerendered as static HTML'))
      console.log(dim('● [SSG] prerendered as static HTML (uses getStaticProps)'))
      console.log(dim('⌾ [CSR] rendered on client side (uses getProps)'))
			rn()
      event(`Builded successfully${st ? dim(` in ${st} ms`) : ''}`)
		} catch (e: any) {
			error(e)
			// error('Build failed:', e?.message || e)
			process.exit(0)
		} finally {
			rn()
		}
	},
})
