import type { Req, Res, $v } from 'duto'

export async function handle(req: Req, res: Res) {
  const id = req.param('id')

  return res.ok({
    id, desc: 'Blog post #'+ id,
  })
}
