<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'

const props = defineProps({
  audioSrc: String
})

const audioRef = ref(null)
const wrapperRef = ref(null)
// Collapsed by default: a "Listen" chip expands into the playback
// controller on first click (user gesture also licenses autoplay).
const isListening = ref(false)
const startListening = async () => {
  isListening.value = true
  await nextTick()
  audioRef.value?.play().catch(() => {})
}
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
    } else if (injectAttempts < 100) {
      // Retry injection up to 100 times (max 5 seconds) if the nav isn't in the DOM yet
      injectAttempts++
      setTimeout(injectPlayer, 50)
    }
  }
  
  injectPlayer()

  const pathSegments = window.location.pathname.replace(/^\/open-universe/, '').split('/').filter(Boolean)
  const pageName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].replace(/\.html$/, '') : 'clearing'

  try {
    const response = await fetch(withBase(`/audio/sync-maps/${pageName}.json`))
    // Dev server falls back to HTML for missing files (200 + text/html);
    // sync maps are generated artifacts, so absence is expected locally.
    const isJson = response.headers.get('content-type')?.includes('application/json')
    if (!response.ok || !isJson || !isMounted) {
      if (response.ok && !isJson) {
        console.warn(`No sync map for "${pageName}" — run npm run generate-audio to enable narration sync`)
      }
      return
    }
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
  <!-- Audio injector: collapsed "Listen" chip -> full controller -->
  <div ref="wrapperRef" class="embedded-audio-wrapper" v-if="audioSrc">
    <button
      v-show="!isListening"
      class="listen-btn"
      @click="startListening"
      aria-label="Listen to a narrated reading of this page"
      title="Listen — narrated audio for this page"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <!-- ear with signal arcs (material "hearing") -->
        <path d="M17 20c-.29 0-.56-.06-.76-.15-.71-.37-1.21-.88-1.71-2.38-.51-1.56-1.47-2.29-2.39-3-.79-.62-1.61-1.24-2.32-2.53C9.29 10.48 9 9.3 9 8c0-2.8 2.2-5 5-5s5 2.2 5 5h2c0-3.93-3.07-7-7-7S7 4.07 7 8c0 1.26.38 2.65 1.07 3.9.91 1.65 1.98 2.48 2.85 3.15.81.62 1.39 1.07 1.71 2.05.6 1.82 1.37 2.84 2.73 3.55.51.23 1.07.35 1.64.35 2.21 0 4-1.79 4-4h-2c0 1.1-.9 2-2 2zM7.64 2.64 6.22 1.22C4.23 3.21 3 5.96 3 9s1.23 5.79 3.22 7.78l1.41-1.41C6.01 13.74 5 11.49 5 9s1.01-4.74 2.64-6.36zM11.5 9c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5-2.5 1.12-2.5 2.5z"/>
      </svg>
      <span>Listen</span>
    </button>
    <audio v-show="isListening" ref="audioRef" controls preload="metadata">
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

.listen-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.listen-btn:hover {
  color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
  background: var(--vp-c-default-soft);
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

/* Mobile-specific adjustments for iOS Safari */
@media (max-width: 768px) {
  .floating-controls {
    /* Pushes the buttons up 5rem + the height of the iPhone gesture bar */
    bottom: calc(5rem + env(safe-area-inset-bottom));
    right: 1rem; /* Brings it slightly closer to the edge to save horizontal space */
  }
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
