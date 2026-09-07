import { STATUS_CODES } from 'node:http'
import { generateSpecs, resolver } from 'hono-openapi'
import { array, object, string } from 'zod/mini'
import { Envir } from 't0n'
import { Scalar } from '@scalar/hono-api-reference'
import { minify } from '@minify-html/node'
import type { Hono } from '$/types'
import { useAuth } from '$/middlewares/auth'

export function openAPIConfig(opts: any) {
  const {
    disable = false,
    path = '/docs',
    agent = false,
    name = '',
    title = '',
    version = Envir.get('APP_VERSION') || Envir.get('VERSION_HASH') || '1.0.0',
    description = Envir.get('APP_DESCRIPTION', ''),
    auth = {},
    ...docs
  } = opts?.docs ?? {}

  return {
    disable,
    path,
    auth,
    agent: !!agent,
    name: name || title || Envir.get('APP_NAME', 'API Docs'),
    version,
    desc: description,
    ...docs,
  }
}

export async function generateOpenAPI(app: Hono, opts?: any) {
  return await generateSpecs(app, {
    documentation: {
      info: {
        title: opts.name,
        version: opts.version,
        description: opts.desc,
        contact: opts.contact,
        termsOfService: opts.terms || opts.termsOfService,
        license: opts.license,
      },
      externalDocs: opts.externalDocs,
      servers: opts.servers,
      security: useAuth() ? [{'JWT':[]}] : opts.security,
      tags: opts.tags,
      components: {
        ...(useAuth() ? { securitySchemes: {
          JWT: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        } } : {}),
        responses: {
          500: {
            description: STATUS_CODES[500],
            content: { // @ts-ignore
              'application/json': await resolver(object({
                m: array(string()),
              })).toOpenAPISchema(),
            },
          },
          ...opts?.responses,
        },
      },
    },
  })
}

export async function generateOpenAPIClient(app: Hono, opts?: any) {
  const customCss = `[href="https://www.scalar.com"],.scalar-mcp-layer{display:none!important}`
  app.get(
    opts.path,
    Scalar({
      theme: 'saturn',
      url: opts.path +'/openapi',
      showDeveloperTools: 'never',
      telemetry: false,
      documentDownloadType: 'json', //'direct',
      isLoading: true,
      persistAuth: true,
      hideClientButton: true,
      pageTitle: opts.name,
      agent: { disabled: !opts.agent },
      slug: opts.name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s_-]/g, '').replace(/[\s_-]+/g, '_').replace(/[^\x00-\x7F]/g, '') +'_'+ opts.version,
      customCss,
      // onLoaded: () => document?.querySelectorAll('[href="https://www.scalar.com"]')?.forEach(el => el.remove()),
      // favicon: 'https://example.com/favicon.png',
      // hideDownloadButton: true,
    })
  )

  const html = await (await app.request('/docs')).text()
  const result = minify(Buffer.from(html), {
    minify_css: true,
    minify_js: true,
    keep_comments: false,
  })

  return result.toString()
    .replace(',customCss:`' + customCss + '`', '')
    .replace('_integration:`hono`,', '')
}
