import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "The Open Universe",
  description: "Reality is a live-rendering, zero-storage computational grid.",
  base: '/open-universe/',
  cleanUrls: true,

  themeConfig: {
    // Top Navigation Bar with icons
    nav: [
      { text: 'The Clearing', link: '/clearing' },
      { text: 'The Interface', link: '/interface' },
      { text: 'The Source', link: '/source' },
      { text: 'The Descent', link: '/descent' },
      { text: 'The Interference', link: '/interference' }
      ///{ text: 'The Static', link: '/static' }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/B-2Me/open-universe' }
    ]
  }
})
