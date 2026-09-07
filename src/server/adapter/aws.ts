import { handle } from 'hono/aws-lambda'
import { app } from '$/entry'

export const handler = handle(app)
