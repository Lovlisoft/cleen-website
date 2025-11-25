<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import SceneVideo from '../components/SceneVideo.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import CleenLogo from '../assets/cleen.svg'
import AudioControl from '../assets/audio-control.svg'
import MenuIcon from '../assets/menu-icon.svg'

gsap.registerPlugin(ScrollTrigger)

const VIDEO_SCENES = [
  { id: 'scene-1', label: 'Intro', time: 2, window: 2 },
  { id: 'scene-2', label: 'Transition A', time: 7, window: 2 },
  { id: 'scene-3', label: 'Mid Motion', time: 14, window: 2 },
  { id: 'scene-4', label: 'Smile Close', time: 19, window: 2 },
  { id: 'scene-5', label: 'Glow', time: 23, window: 2 },
  { id: 'scene-6', label: 'Finale', time: 32, window: 2 }
]

const TOTAL_FRAMES = 846
const sections = ref([])
const experienceRef = ref(null)
const activeSceneIndex = ref(0)
const scrollProgress = ref(0)
const triggers = []
const isTransitioning = ref(false)
const isLoading = ref(true)
const loadingProgress = ref(0)
const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

let lenis
let rafId

const setSectionRef = (el) => {
  if (el && !sections.value.includes(el)) {
    sections.value.push(el)
  }
}

const activateScene = (index) => {
  activeSceneIndex.value = index
}

// Convert scene time (seconds) to frame index
const timeToFrameIndex = (time) => {
  const maxTime = 32
  return Math.min(Math.round((time / maxTime) * TOTAL_FRAMES), TOTAL_FRAMES - 1)
}

const getFramePath = (frameIndex) => {
  const padded = String(frameIndex + 1).padStart(5, '0')
  return `/videos/scroll-frames/frame_${padded}.jpg`
}

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const preloadCriticalFrames = async () => {
  const criticalFrames = []
  
  // Load frames for each scene
  VIDEO_SCENES.forEach((scene) => {
    const frameIndex = timeToFrameIndex(scene.time)
    criticalFrames.push(frameIndex)
    // Also preload a few frames around each scene for smooth transitions
    for (let i = -2; i <= 2; i++) {
      const nearbyFrame = frameIndex + i
      if (nearbyFrame >= 0 && nearbyFrame < TOTAL_FRAMES) {
        criticalFrames.push(nearbyFrame)
      }
    }
  })
  
  // Remove duplicates
  const uniqueFrames = [...new Set(criticalFrames)].sort((a, b) => a - b)
  
  const total = uniqueFrames.length
  let loaded = 0
  
  const promises = uniqueFrames.map((frameIndex) => {
    return loadImage(getFramePath(frameIndex))
      .then(() => {
        loaded++
        loadingProgress.value = Math.min(loaded / total, 0.7) // Frames are 70% of total
      })
      .catch(() => {
        loaded++
        loadingProgress.value = Math.min(loaded / total, 0.7)
      })
  })
  
  await Promise.all(promises)
}

const preloadAssets = async () => {
  const assets = [CleenLogo, AudioControl, MenuIcon]
  
  const total = assets.length
  let loaded = 0
  
  const promises = assets.map((src) => {
    return loadImage(src)
      .then(() => {
        loaded++
        loadingProgress.value = 0.7 + (loaded / total) * 0.3 // Assets are 30% of total
      })
      .catch(() => {
        loaded++
        loadingProgress.value = 0.7 + (loaded / total) * 0.3
      })
  })
  
  await Promise.all(promises)
}

const preloadAll = async () => {
  const startTime = Date.now()
  const minLoadingTime = 2000 // Minimum 2 seconds
  
  try {
    loadingProgress.value = 0
    
    // Block scroll during loading
    document.body.style.overflow = 'hidden'
    
    // Preload frames and assets in parallel
    await Promise.all([preloadCriticalFrames(), preloadAssets()])
    
    loadingProgress.value = 1
    
    // Calculate remaining time to meet minimum loading duration
    const elapsedTime = Date.now() - startTime
    const remainingTime = Math.max(0, minLoadingTime - elapsedTime)
    
    // Wait for remaining time + small delay to show 100% before hiding
    await new Promise((resolve) => setTimeout(resolve, remainingTime + 300))
    
    isLoading.value = false
    document.body.style.overflow = ''
  } catch (error) {
    console.error('Error during preload:', error)
    // Still show the experience even if some assets fail
    // Calculate remaining time to meet minimum loading duration
    const elapsedTime = Date.now() - startTime
    const remainingTime = Math.max(0, minLoadingTime - elapsedTime)
    await new Promise((resolve) => setTimeout(resolve, remainingTime + 300))
    isLoading.value = false
    document.body.style.overflow = ''
  }
}

const initScrollTriggers = () => {
  // Global scroll progress trigger - maps scroll to frame progress
  if (experienceRef.value) {
    const globalTrigger = ScrollTrigger.create({
      trigger: experienceRef.value,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5, // Small scrub for smooth but direct response
      onUpdate: (self) => {
        scrollProgress.value = self.progress
      }
    })
    triggers.push(globalTrigger)
  }

  // Section triggers for scene activation
  sections.value.forEach((section, index) => {
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      scrub: false,
      onEnter: () => {
        if (isTransitioning.value) return
        activateScene(index)
      },
      onEnterBack: () => {
        if (isTransitioning.value) return
        activateScene(index)
      }
    })

    triggers.push(trigger)
  })
}

const initLenis = () => {
  if (prefersReducedMotion) return

  lenis = new Lenis({
    lerp: 0.15,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    infinite: false,
    duration: 1.2
  })

  lenis.on('scroll', ScrollTrigger.update)

  const raf = (time) => {
    lenis.raf(time)
    rafId = requestAnimationFrame(raf)
  }

  rafId = requestAnimationFrame(raf)
}

onMounted(async () => {
  await preloadAll()
  initScrollTriggers()
  initLenis()
})

onBeforeUnmount(() => {
  triggers.forEach((trigger) => trigger.kill())

  if (rafId) {
    cancelAnimationFrame(rafId)
  }

  lenis?.destroy()
})

const handleTransitionStart = () => {
  isTransitioning.value = true
  lenis?.stop()
}

const handleTransitionEnd = () => {
  isTransitioning.value = false
  lenis?.start()
}
</script>

<template>
  <main class="home" ref="experienceRef">
    <LoadingOverlay :is-loading="isLoading" :progress="loadingProgress" />
    
    <div class="scene-stage">
      <SceneVideo
        :active-scene-index="activeSceneIndex"
        :scroll-progress="scrollProgress"
        :scenes="VIDEO_SCENES"
        @transition-start="handleTransitionStart"
        @transition-end="handleTransitionEnd"
      />
    </div>

    <section
      v-for="scene in VIDEO_SCENES"
      :key="scene.id"
      class="scene-anchor scene-anchor--hidden"
      :ref="setSectionRef"
    >
      <div class="copy-block" aria-hidden="true" />
    </section>
  </main>
</template>

<style scoped>
.home {
  min-height: 320vh;
  background: radial-gradient(circle at top, #d6ffe4 0%, #ebfff1 30%, #f7fff8 65%, #ffffff 100%);
  color: #0d1f16;
  position: relative;
}

.scene-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
  z-index: 10;
}

.scene-anchor {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 4vw, 5rem);
  position: relative;
  z-index: 0;
  pointer-events: none;
}

.scene-anchor--hidden .copy-block {
  opacity: 0;
  pointer-events: none;
}

.copy-block {
  max-width: 620px;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border-radius: 1.5rem;
  border: 1px solid rgba(13, 31, 22, 0.08);
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(14px);
  text-align: left;
  box-shadow: 0 45px 90px rgba(0, 25, 13, 0.08);
}

.copy-block h1 {
  font-size: clamp(2rem, 5vw, 3.4rem);
  margin-bottom: 0.5rem;
}

.copy-block h2 {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  margin-bottom: 0.5rem;
}

.copy-block p {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(13, 31, 22, 0.85);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.85rem;
  color: rgba(13, 31, 22, 0.65);
  margin-bottom: 0.75rem;
}

code {
  font-size: 0.9em;
  color: #2aa44f;
}
</style>

