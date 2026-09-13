import type { Req, Res, $v } from 'duto'
import { newID } from 't0n'

export async function handle(req: Req, res: Res) {
  return res.ok(Array.from({ length: 5 }, () => {
    const id = newID()
    return { id, desc: 'Blog post #'+ id }
  }))
}
