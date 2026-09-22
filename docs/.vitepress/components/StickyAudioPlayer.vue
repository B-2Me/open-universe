<script setup>
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

const props = defineProps({
  audioSrc: String
})

const audioRef = ref(null)
const wrapperRef = ref(null)

onMounted(async () => {
  if (!audioRef.value || !wrapperRef.value) return

  // Embed player into the right side of the "On this page" local nav bar
  const localNavContainer = document.querySelector('.VPLocalNav .container')
  if (localNavContainer) {
    localNavContainer.appendChild(wrapperRef.value)
  }

  // Determine current page name from pathname to load its sync map
  const pathSegments = window.location.pathname.replace(/^\/open-universe/, '').split('/').filter(Boolean)
  const pageName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].replace(/\.html$/, '') : 'clearing'

  try {
    const response = await fetch(withBase(`/audio/sync-maps/${pageName}.json`))
    if (!response.ok) return
    const syncMap = await response.json()

    // Select all readable DOM nodes in exact order (Headings + Paragraphs)
    const contentElements = document.querySelectorAll('.vp-doc h1, .vp-doc h2, .vp-doc h3, .vp-doc p')
    
    // Attach sync metadata to DOM elements
    contentElements.forEach((el, index) => {
      if (syncMap[index]) {
        el.classList.add('sync-text')
        el.dataset.start = syncMap[index].start
        el.dataset.end = syncMap[index].end
      }
    })

    const syncSpans = document.querySelectorAll(".sync-text")
    let currentActiveElement = null

    const syncText = () => {
      if (audioRef.value.paused) return
      
      const currentTime = audioRef.value.currentTime
      let foundActive = false

      syncSpans.forEach(el => {
        const start = parseFloat(el.dataset.start)
        const end = parseFloat(el.dataset.end)
        
        if (currentTime >= start && currentTime < end) {
          foundActive = true
          if (currentActiveElement !== el) {
            if (currentActiveElement) currentActiveElement.classList.remove('active')
            el.classList.add('active')
            currentActiveElement = el
            
            const offsetHeight = 150 
            const elementPosition = el.getBoundingClientRect().top + window.pageYOffset
            window.scrollTo({
              top: elementPosition - offsetHeight,
              behavior: 'smooth'
            })
          }
        }
      })

      if (!foundActive && currentActiveElement) {
        currentActiveElement.classList.remove('active')
        currentActiveElement = null
      }

      requestAnimationFrame(syncText)
    }

    audioRef.value.addEventListener("play", () => requestAnimationFrame(syncText))
    
    syncSpans.forEach(el => {
      el.style.cursor = 'pointer'
      el.addEventListener('click', () => {
        audioRef.value.currentTime = parseFloat(el.dataset.start)
        audioRef.value.play()
      })
    })

  } catch (err) {
    console.error("Failed to load sync map:", err)
  }
})
</script>

<template>
  <div ref="wrapperRef" class="embedded-audio-wrapper" v-if="audioSrc">
    <audio ref="audioRef" controls preload="metadata">
      <source :src="withBase(audioSrc)" type="audio/mpeg">
    </audio>
  </div>
</template>

<style scoped>
.embedded-audio-wrapper {
  display: flex;
  align-items: center;
  margin-left: auto;
  max-width: 380px;
  width: 100%;
  height: 32px;
  padding: 0 4px;
  background: transparent;
  border: none;
  box-shadow: none;
}

.embedded-audio-wrapper audio {
  width: 100%;
  height: 28px;
  outline: none;
}
</style>

<style>
.sync-text {
  transition: background-color 0.3s ease, color 0.3s ease;
  padding: 2px 4px;
  border-radius: 4px;
}
.sync-text.active {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
</style>
