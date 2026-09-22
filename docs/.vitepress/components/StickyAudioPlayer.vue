<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  audioSrc: String
})

const audioRef = ref(null)

onMounted(() => {
  if (!audioRef.value) return

  // Target the spans injected by the markdown AST pipeline
  const syncSpans = document.querySelectorAll("span.sync-text")
  let currentActiveSpan = null

  const syncText = () => {
    if (audioRef.value.paused) return
    
    const currentTime = audioRef.value.currentTime
    let foundActive = false

    syncSpans.forEach(span => {
      const start = parseFloat(span.dataset.start)
      const end = parseFloat(span.dataset.end)
      
      if (currentTime >= start && currentTime < end) {
        foundActive = true
        if (currentActiveSpan !== span) {
          if (currentActiveSpan) currentActiveSpan.classList.remove('active')
          span.classList.add('active')
          currentActiveSpan = span
          
          // Smooth scroll to the active paragraph, leaving room for the VitePress nav and sticky player
          const offsetHeight = 150 
          const elementPosition = span.getBoundingClientRect().top + window.pageYOffset
          window.scrollTo({
            top: elementPosition - offsetHeight,
            behavior: 'smooth'
          })
        }
      }
    })

    if (!foundActive && currentActiveSpan) {
      currentActiveSpan.classList.remove('active')
      currentActiveSpan = null
    }

    requestAnimationFrame(syncText)
  }

  audioRef.value.addEventListener("play", () => requestAnimationFrame(syncText))
  
  // Click-to-seek functionality
  syncSpans.forEach(span => {
    span.style.cursor = 'pointer'
    span.addEventListener('click', () => {
      audioRef.value.currentTime = parseFloat(span.dataset.start)
      audioRef.value.play()
    })
  })
})
</script>

<template>
  <div class="sticky-audio-wrapper" v-if="audioSrc">
    <audio ref="audioRef" controls preload="metadata">
      <source :src="audioSrc" type="audio/mpeg">
    </audio>
  </div>
</template>

<style scoped>
.sticky-audio-wrapper {
  position: sticky;
  top: 80px; /* Sits cleanly below the VitePress top nav bar */
  z-index: 50;
  background: var(--vp-c-bg-soft);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  border: 1px solid var(--vp-c-divider);
  display: flex;
  justify-content: center;
}

.sticky-audio-wrapper audio {
  width: 100%;
  max-width: 800px;
  outline: none;
}
</style>

<style>
/* Unscoped global styles for the spans injected by the markdown pipeline */
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
