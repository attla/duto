import { t, Link } from 'duto'
import type { Posts } from '@/types'
import { ALL_POSTS } from './[slug]'

export { Html } from '@/components/html'

export async function getStaticProps() {
  const posts = (await (await fetch('https://jsonplaceholder.typicode.com/posts')).json())
    ?.sort(() => 0.5 - Math.random())
    .slice(0, 10)

  posts.unshift(...ALL_POSTS)
  return { posts }
}

export type Props = {
  posts?: Posts,
}

export default function Blog({ posts }: Props) {
  return (
    <>
      <h1 class="title">Blog</h1>

      <div class="mt-2 highlight">
        {t`b1`}&nbsp;<b><i>getStaticProps()</i></b> (SSG)
      </div>

      {!posts?.length && (
        <p class="mt-8">No posts found.</p>
      )}

      <div class="mt-8 flex flex-col max-w-2xl">
        {posts?.map((post) => (
          <Link
            key={post.id}
            to={`/blog/${post.id}`}
            class="group block relative p-4 border-b border-gray-200 dark:border-zinc-700/70 transition-all duration-300 ease-out"
          >
            <div class="flex items-start gap-4">
              <div class="flex-1 min-w-0">
                <h2 class="text-base font-medium group-hover:text-sky-gradient">
                  {post.title}
                </h2>
                <p class="mt-1 text-sm text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-400 line-clamp-2 pr-6">
                  {post.body}
                </p>
              </div>

              <div class="absolute right-0 top-[35%] flex-shrink-0 bg-indigo-50 group-hover:bg-gray-100 dark:bg-gray-600/90 dark:group-hover:bg-gray-500 rounded-full p-1 transition-all duration-300 group-hover:translate-x-1">
                <svg
                  class="size-5 text-gray-400 group-hover:text-sky-500 dark:group-hover:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
