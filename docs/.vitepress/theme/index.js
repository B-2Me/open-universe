import DefaultTheme from 'vitepress/theme'
import './custom.css'
import StickyAudioPlayer from '../components/StickyAudioPlayer.vue'
import WakeSimulator from '../components/WakeSimulator.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('StickyAudioPlayer', StickyAudioPlayer);
    app.component('WakeSimulator', WakeSimulator);
  }
}
