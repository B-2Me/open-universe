import { defineConfig } from 'vitepress'

// 1. Define your global reading order here once.
const readingOrder = [
  { text: 'Planck Field', link: '/field' },
  { text: 'Interface', link: '/interface' },
  { text: 'Source', link: '/source' },
  { text: 'Paradoxes', link: '/paradox' },
  { text: 'Interference', link: '/interference' },
  { text: 'Intent', link: '/intent' }
]

export default defineConfig({
  title: "The Open Universe",
  description: "Reality is a live-rendering, zero-storage computational grid.",
  base: '/open-universe/',
  cleanUrls: true,

  themeConfig: {
    // 2. Reuse the array for the top nav
    nav: readingOrder,

    // Notice: We completely removed the `sidebar` object.

    footer: {
      message: '<a href="#">Return to top ⭡</a>',
      copyright: 'The Open Universe Audit'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/B-2Me/open-universe' }
    ]
  },

  // 3. Dynamically inject Prev/Next links without generating a sidebar
  transformPageData(pageData) {
    // Convert VitePress's relativePath (e.g., 'field.md') to your link format ('/field')
    const route = `/${pageData.relativePath.replace(/\.md$/, '').replace(/\/index$/, '/')}`
    
    // Find where the current page sits in your sequence
    const currentIndex = readingOrder.findIndex(item => item.link === route)
    
    if (currentIndex > -1) {
      // If there's a previous page in the array, inject it
      if (currentIndex > 0) {
        pageData.frontmatter.prev = readingOrder[currentIndex - 1]
      }
      // If there's a next page in the array, inject it
      if (currentIndex < readingOrder.length - 1) {
        pageData.frontmatter.next = readingOrder[currentIndex + 1]
      }
    }
  }
})
