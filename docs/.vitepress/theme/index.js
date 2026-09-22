import DefaultTheme from 'vitepress/theme'
import './custom.css'
import StickyAudioPlayer from '../components/StickyAudioPlayer.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register the audio player globally
    app.component('StickyAudioPlayer', StickyAudioPlayer)
  }
}
