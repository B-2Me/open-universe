import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "The Open Universe",
  description: "Reality is a live-rendering, zero-storage computational grid.",
  base: '/open-universe/',
  cleanUrls: true,

  themeConfig: {
    // Top Navigation Bar with icons
    nav: [
      { text: 'The Planck Field', link: '/field' },
      { text: 'The Interface', link: '/interface' },
      { text: 'The Source', link: '/source' },
      { text: 'The Paradoxes', link: '/paradox' },
      ///{ text: 'The Descent', link: '/descent' },
      { text: 'The Interference', link: '/interference' },
      { text: 'The Intent', link: '/intent' }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/B-2Me/open-universe' }
    ]
  }
})
