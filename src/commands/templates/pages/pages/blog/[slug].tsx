import { t, Link } from 'duto'
import { JSJSON } from 't0n'
import type { Post, Posts } from '@/types'
import NotFound from '../404'

// Mock data
export const ALL_POSTS: Posts = [
  {
    id: "hello-world",
    title: "Hello World",
    body:
      "Welcome to my blo! This post was statically generated at build time using `getStaticProps`. When navigating here via the SPA router, `getProps` fetches the same data dynamically.",
  },
  {
    id: "getting-started",
    title: "Getting Started with SSG",
    body:
      "Static site generation combines the best of both worlds: fast initial loads with the flexibility of dynamic data fetching.",
  },
]

export { Html } from '@/components/html'

export function getStaticProps() {
  return ALL_POSTS.map((post) => ({
    slug: post.id, // required: matches [slug] in the filename to compute the output path
    post,
  }))
}

// called during SPA navigation. Receives route params from wouter
export async function getProps({ slug }: { slug?: string }, ssg: Props[]) {
  await new Promise((resolve) => setTimeout(resolve, 650))
  const ssgPost = ssg.find(m => m.slug === slug)
  if (ssgPost) return { post: ssgPost.post }

  const post = (await (await fetch('https://jsonplaceholder.typicode.com/posts/' + slug)).json())
  return { post }
}

export type Props = {
  post?: Post | null,
  slug?: string,
}

export function Loading() {
  return (
    <article class="mt-6 w-xl">
      <div>
        <div class="animate-pulse rounded-md bg-gray-300 w-18 h-6" />
      </div>
      <div class="mt-2 animate-pulse rounded-md bg-gray-300 w-48 h-10" />
      <div class="mt-6 animate-pulse rounded-md bg-gray-300 w-full h-24" />
    </article>
  )
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
