import { defineConfig } from 'vitepress'

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
  base: '/', 
  cleanUrls: true,

  themeConfig: {
    // Top Navigation Bar
    nav: [
      ...readingOrder,
      { text: '☕ Buy me a coffee', link: 'https://buymeacoffee.com/nathan_' },
      { text: 'Contact Me', link: '/interference#contact' }
    ],

    // Cleaned footer
    footer: {
      copyright: 'The Open Universe Audit'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/B-2Me/open-universe' }
    ]
  },

  transformPageData(pageData) {
    const route = `/${pageData.relativePath.replace(/\.md$/, '').replace(/\/index$/, '/')}`
    const currentIndex = readingOrder.findIndex(item => item.link === route)
    
    if (currentIndex > -1) {
      if (currentIndex > 0) {
        pageData.frontmatter.prev = readingOrder[currentIndex - 1]
      }
      if (currentIndex < readingOrder.length - 1) {
        pageData.frontmatter.next = readingOrder[currentIndex + 1]
      }
    }
  }
})
