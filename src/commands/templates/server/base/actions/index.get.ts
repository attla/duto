import type { Req, Res } from 'duto'

export async function handle(req: Req, res: Res) {
  return res.ok({ message: 'Duto index' })
}
