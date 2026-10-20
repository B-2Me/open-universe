import DefaultTheme from 'vitepress/theme'
import './custom.css'
import StickyAudioPlayer from '../components/StickyAudioPlayer.vue'
import WakeSimulator from '../components/WakeSimulator.vue'
import LoomSimulator from '../components/LoomSimulator.vue'
import HopfionViewer from '../components/HopfionViewer.vue'
import FrictionReplay from '../components/FrictionReplay.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('StickyAudioPlayer', StickyAudioPlayer);
    app.component('WakeSimulator', WakeSimulator);
    app.component('LoomSimulator', LoomSimulator);
    app.component('HopfionViewer', HopfionViewer);
    app.component('FrictionReplay', FrictionReplay);
  }
}
