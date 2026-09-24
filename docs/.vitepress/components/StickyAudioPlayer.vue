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

// --- NEW: Scroll State & FAB Logic ---
const isAutoScrollActive = ref(true)
const showScrollTop = ref(false)
let isSystemScroll = false
let scrollTimeout = null

const handleScroll = () => {
  // Show "Return to top" if scrolled down more than 300px
  showScrollTop.value = window.scrollY > 300

  // If user scrolls manually while playing, suspend auto-scroll
  if (!isSystemScroll && audioRef.value && !audioRef.value.paused) {
    isAutoScrollActive.value = false
  }
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const syncToAudio = () => {
  isAutoScrollActive.value = true
  const currentActive = document.querySelector('.sync-text.active')
  if (currentActive) {
    isSystemScroll = true
    const offsetHeight = 150
    const elementPosition = currentActive.getBoundingClientRect().top + window.pageYOffset
    window.scrollTo({
      top: elementPosition - offsetHeight,
      behavior: 'smooth'
    })
    
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isSystemScroll = false
    }, 800)
  }
}
// -------------------------------------

onMounted(async () => {
  isMounted = true
  window.addEventListener('scroll', handleScroll, { passive: true })

  if (!audioRef.value || !wrapperRef.value) return

  // Polling function to wait for VitePress to render the LocalNav across route changes
  let injectAttempts = 0
  const injectPlayer = () => {
    if (!isMounted) return
    const localNavContainer = document.querySelector('.VPLocalNav .container')
    
    if (localNavContainer) {
      const existingWrappers = localNavContainer.querySelectorAll('.embedded-audio-wrapper')
      existingWrappers.forEach(el => el.remove())
      localNavContainer.appendChild(wrapperRef.value)
    } else if (injectAttempts < 40) {
      // Retry injection up to 40 times (max 2 seconds) if the nav isn't in the DOM yet
      injectAttempts++
      setTimeout(injectPlayer, 50)
    }
  }
  
  injectPlayer()

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
            
            // --- UPDATED: Only auto-scroll if active ---
            if (isAutoScrollActive.value) {
              isSystemScroll = true
              const offsetHeight = 150 
              const elementPosition = el.getBoundingClientRect().top + window.pageYOffset
              window.scrollTo({
                top: elementPosition - offsetHeight,
                behavior: 'smooth'
              })
              
              clearTimeout(scrollTimeout)
              scrollTimeout = setTimeout(() => {
                isSystemScroll = false
              }, 800)
            }
            // ------------------------------------------
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
          // If the user manually clicks a paragraph, we assume they want to sync
          isAutoScrollActive.value = true 
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
  window.removeEventListener('scroll', handleScroll)
  clearTimeout(scrollTimeout)

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
  <!-- Original Audio Injector -->
  <div ref="wrapperRef" class="embedded-audio-wrapper" v-if="audioSrc">
    <audio ref="audioRef" controls preload="metadata">
      <source :src="withBase(audioSrc)" type="audio/mpeg">
    </audio>
  </div>

  <!-- New Floating Controls -->
  <div class="floating-controls">
    <transition name="fade-slide">
      <button 
        v-if="!isAutoScrollActive && audioRef && !audioRef.paused" 
        @click="syncToAudio" 
        class="fab sync-fab"
        title="Sync to Audio"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Sync Audio
      </button>
    </transition>

    <transition name="fade-slide">
      <button 
        v-if="showScrollTop" 
        @click="scrollToTop" 
        class="fab top-fab"
        title="Scroll to Top"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
    </transition>
  </div>
</template>

<style scoped>
/* Original Styles */
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

/* New Floating Controls Styles */
.floating-controls {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 100;
  align-items: flex-end;
}

.fab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background-color: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.fab:hover {
  background-color: var(--vp-c-default-soft);
  color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.sync-fab {
  padding: 0.5rem 1rem 0.5rem 0.75rem;
}

.top-fab {
  padding: 0.75rem;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(15px);
}
</style>

<style>
/* Original Global Styles */
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
