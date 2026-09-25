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
  
  head: [
    // Legacy fallback
    ['link', { rel: 'icon', href: '/images/favicon.ico' }],
    // Modern scalable icons
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/images/favicon-16x16.png' }],
    // Apple Touch Icon for iOS home screens
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/images/apple-touch-icon.png' }],
    // Optional: Android Chrome theme color (matches your glowing cyan or dark theme)
    ['meta', { name: 'theme-color', content: '#00e5ff' }],

    // Analytics
    [
      'script',
      {
        async: '',
        defer: '',
        src: 'https://cloud.umami.is/script.js',
        'data-website-id': '3532a46b-30cf-4984-ba30-292b1f6ca95e'
      }
    ]
  ],

  themeConfig: {
    // 1. Text Nav is now perfectly clean and won't run off the screen
    nav: readingOrder,

    footer: {
      copyright: 'The Open Universe Audit'
    },

    // 2. All external/action links are grouped in the icon overflow zone
    socialLinks: [
      { 
        icon: 'github', 
        link: 'https://github.com/B-2Me/open-universe',
        ariaLabel: 'Site Sourcecode'
      },
      { 
        // Solid Material Design Coffee Cup
        icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>' },
        link: 'https://buymeacoffee.com/nathan_',
        ariaLabel: 'Buy me a coffee'
      },
      { 
        // Solid Material Design Envelope
        icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>' },
        link: '/interference#contact',
        ariaLabel: 'Contact Me'
      },
      {
        icon: { svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><image href="/images/btwo-favicon.png" width="24" height="24" /></svg>' },
        link: 'https://btwo.me',
        ariaLabel: 'Published by btwo.me'
      }
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
