
import { t, Link } from 'duto'
import type { Post, Posts } from '@/types'
import { JSJSON } from '../../../../packages/t0n/src/json'
import NotFound from '../404'

// Mock data
const ALL_POSTS: Posts = [
  {
    id: "hello-world",
    title: "Hello World",
    body:
      "Welcome to my blog! This post was statically generated at build time using `getStaticProps`. When navigating here via the SPA router, `getProps` fetches the same data dynamically.",
  },
  {
    id: "getting-started",
    title: "Getting Started with SSG",
    body:
      "Static site generation combines the best of both worlds: fast initial loads with the flexibility of dynamic data fetching.",
  },
  {
    id: "signals-islands",
    title: "Signals & Islands",
    body:
      "Preact Signals give us fine-grained reactivity. Combined with the islands architecture, we can ship near-zero JS by default.",
  },
]


export { Html } from '@/components/html'

/**
 * Returns one entry per post.
 * Each entry MUST include the route param (`slug`) plus any page props.
 * The build script uses `slug` to compute the output path.
 */
export function getStaticProps() {
  return ALL_POSTS.map((post) => ({
    slug: post.id, // required: matches [slug] in the filename
    post,
  }))
}

// ── Browser-time data ─────────────────────────────────────────────────────────

/**
 * Called during SPA navigation. Receives route params from wouter.
 */
export async function getProps({ slug }: { slug?: string }) {
  const post = (await (await fetch('https://jsonplaceholder.typicode.com/posts/'+ slug)).json())
  return { post }
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  post?: Post | null,
  slug?: string,
}

export default function BlogPost({ post, slug }: Props) {
  if (!post?.title)
    return <NotFound />

  return (
    <>
      <article class="mt-6 max-w-2xl">
        <div>
          <Link href="/blog">
            ←
            <span class="ml-2">{t`blog`}</span>
          </Link>
        </div>
        <h1 class="mt-2 text-4xl font-black text-sky-gradient">{post.title}</h1>
        <p class="mt-6 leading-relaxed">{post.body}</p>
      </article>

      <div class="mt-12 p-4 rounded-lg text-sm bg-sky-50 text-sky-700 dark:bg-zinc-700 dark:text-white/80">
        {[
          ['Route', window.$duto?.route?.pattern],
          ['Route path', window.$duto?.route?.path],
          ['Route params', JSJSON(window?.$duto?.route?.params || {})],
          ['Route search params', window?.$duto?.search?.toString()],
        ].map(([label, info]) => ( <div><b>{label}:</b> {info || 'n/a'}</div>))}
      </div>
    </>
  )
}
