import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "The Open Universe",
  description: "Reality is a live-rendering, zero-storage computational grid.",
  
  // This forces all assets to load from the correct GitHub Pages subpath
  base: '/open-universe/',
  
  cleanUrls: true,

  themeConfig: {
    nav: [
      { text: 'The Clearing', link: '/' },
      { text: 'The Local Interface', link: '/interface' },
      { text: 'The Source', link: '/source' },
      { text: 'Interference', link: '/interference' },
      { text: 'The Static', link: '/static' }
    ],
    sidebar: [
      {
        text: 'The Architecture',
        items: [
          { text: 'The Clearing', link: '/' },
          { text: 'The Local Interface', link: '/interface' },
          { text: 'The Source', link: '/source' },
          { text: 'Interference', link: '/interference' },
          { text: 'The Static', link: '/static' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nater0000/Chats' }
    ]
  }
})
