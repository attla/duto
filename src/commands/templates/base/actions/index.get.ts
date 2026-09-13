import type { Req, Res, $v } from 'duto'

export async function handle(req: Req, res: Res) {
  return res.ok({ message: 'Duto index' })
}
