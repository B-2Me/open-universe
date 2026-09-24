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
  
  // Changed to '/' so it works perfectly on planckfield.site
  base: '/', 
  cleanUrls: true,

  themeConfig: {
    nav: readingOrder,

    // Footer with your direct Buy Me a Coffee link
    footer: {
      message: '<a href="https://github.com/B-2Me/open-universe" target="_blank">Site Sourcecode</a><br><a href="https://buymeacoffee.com/nathan_" target="_blank">☕ Buy me a coffee</a><br><a href="/interference#contact">Contact Me</a><br><a href="#">Return to top ⭡</a>',
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
