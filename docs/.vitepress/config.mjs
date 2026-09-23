import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "The Open Universe",
  description: "Reality is a live-rendering, zero-storage computational grid.",
  base: '/open-universe/',
  cleanUrls: true,

  themeConfig: {
    // Top Navigation Bar
    nav: [
      { text: 'The Planck Field', link: '/field' },
      { text: 'The Interface', link: '/interface' },
      { text: 'The Source', link: '/source' },
      { text: 'The Paradoxes', link: '/paradox' },
      { text: 'The Interference', link: '/interference' },
      { text: 'The Intent', link: '/intent' }
    ],

    // The Sidebar establishes the reading order for Prev/Next generation
    sidebar: [
      {
        text: 'The Audit',
        items: [
          { text: 'The Planck Field', link: '/field' },
          { text: 'The Interface', link: '/interface' },
          { text: 'The Source', link: '/source' },
          { text: 'The Paradoxes', link: '/paradox' },
          { text: 'The Interference', link: '/interference' },
          { text: 'The Intent', link: '/intent' }
        ]
      }
    ],

    // Universal footer (displays on home page and wide-layout pages)
    footer: {
      message: '<a href="#">Return to top ⭡</a>',
      copyright: 'The Open Universe Audit'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/B-2Me/open-universe' }
    ]
  }
})
