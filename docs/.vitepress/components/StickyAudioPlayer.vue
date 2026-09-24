<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  audioSrc: {
    type: String,
    required: true
  }
})

// Audio & Sync State (Assuming you have these from your existing logic)
const isPlaying = ref(false)
const currentTime = ref(0)
const activeIndex = ref(-1)

// Floating Controls & Scroll State
const isAutoScrollActive = ref(true)
const showScrollTop = ref(false)
let isSystemScroll = false
let scrollTimeout = null

const handleScroll = () => {
  // Reveal "Scroll to Top" if scrolled down past 300px
  showScrollTop.value = window.scrollY > 300

  // If the user manually scrolls while playing, suspend auto-scroll
  if (!isSystemScroll && isPlaying.value) {
    isAutoScrollActive.value = false
  }
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const syncToAudio = () => {
  isAutoScrollActive.value = true
  scrollToActiveElement()
}

const scrollToActiveElement = () => {
  if (!isAutoScrollActive.value) return
  
  // Replace '.active-text' with whatever class you apply to the highlighted text
  const activeEl = document.querySelector('.active-text')
  if (activeEl) {
    isSystemScroll = true
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    
    // Lock the system scroll flag for the duration of the smooth scroll animation
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isSystemScroll = false
    }, 800) 
  }
}

// Watch your existing activeIndex to trigger system scrolls
watch(activeIndex, () => {
  if (isAutoScrollActive.value) {
    scrollToActiveElement()
  }
})

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  clearTimeout(scrollTimeout)
})
</script>

<template>
  <!-- Your existing Sticky Audio Player UI goes here -->
  <div class="audio-player-container">
    <!-- Player UI -->
  </div>

  <!-- Floating Action Buttons (Pop-overs) -->
  <div class="floating-controls">
    <!-- Sync to Audio Button: Only shows if auto-scroll is paused and audio is playing -->
    <transition name="fade-slide">
      <button 
        v-if="!isAutoScrollActive && isPlaying" 
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

    <!-- Scroll to Top Button -->
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

/* Smooth enter/leave transitions for the pop-overs */
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
