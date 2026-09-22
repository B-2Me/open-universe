<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'

const props = defineProps({
  audioSrc: String
})

const audioRef = ref(null)
const wrapperRef = ref(null)
let animationFrameId = null
let isMounted = true

onMounted(async () => {
  isMounted = true
  if (!audioRef.value || !wrapperRef.value) return

  const localNavContainer = document.querySelector('.VPLocalNav .container')
  if (localNavContainer) {
    // Purge any stale audio wrappers left over from previous page navigations
    const existingWrappers = localNavContainer.querySelectorAll('.embedded-audio-wrapper')
    existingWrappers.forEach(el => el.remove())
    
    // Attach the fresh player for the current page
    localNavContainer.appendChild(wrapperRef.value)
  }

  const pathSegments = window.location.pathname.replace(/^\/open-universe/, '').split('/').filter(Boolean)
  const pageName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].replace(/\.html$/, '') : 'clearing'

  try {
    const response = await fetch(withBase(`/audio/sync-maps/${pageName}.json`))
    if (!response.ok || !isMounted) return
    const syncMap = await response.json()

    const rawElements = document.querySelectorAll('.vp-doc h1, .vp-doc h2, .vp-doc h3, .vp-doc p, .vp-doc li')
    const contentElements = Array.from(rawElements).filter(el => {
      if (el.tagName === 'LI' && el.querySelector('p')) {
        return false
      }
      return true
    })
    
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
      if (!isMounted || !audioRef.value || audioRef.value.paused) return
      
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

      animationFrameId = requestAnimationFrame(syncText)
    }

    const handlePlay = () => {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(syncText)
    }

    if (audioRef.value) {
      audioRef.value.addEventListener("play", handlePlay)
    }
    
    syncSpans.forEach(el => {
      el.style.cursor = 'pointer'
      el.addEventListener('click', () => {
        if (audioRef.value) {
          audioRef.value.currentTime = parseFloat(el.dataset.start)
          audioRef.value.play()
        }
      })
    })

  } catch (err) {
    console.error("Failed to load sync map:", err)
  }
})

onUnmounted(() => {
  isMounted = false
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  if (audioRef.value) {
    audioRef.value.pause()
  }
  if (wrapperRef.value && wrapperRef.value.parentNode) {
    wrapperRef.value.parentNode.removeChild(wrapperRef.value)
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
