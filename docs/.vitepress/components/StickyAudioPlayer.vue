<script setup>
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

const props = defineProps({
  audioSrc: String
})

const audioRef = ref(null)
const wrapperRef = ref(null)

onMounted(() => {
  if (!audioRef.value || !wrapperRef.value) return

  // Automatically embed the player into the right side of the "On this page" local nav bar
  const localNavContainer = document.querySelector('.VPLocalNav .container')
  if (localNavContainer) {
    localNavContainer.appendChild(wrapperRef.value)
  }

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
  margin-left: auto; /* Pushes the player cleanly to the right side of the local nav bar */
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
/* Unscoped global styles for the active text highlighting */
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
