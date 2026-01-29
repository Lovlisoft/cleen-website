<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import SceneVideo from '../components/SceneVideo.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import BackgroundVideo from '../components/BackgroundVideo.vue'
import CleenLogo from '../assets/cleen.svg'
import AudioControl from '../assets/audio-control.svg'
import MenuIcon from '../assets/menu-icon.svg'

gsap.registerPlugin(ScrollTrigger)

const VIDEO_SCENES = [
  { id: 'scene-1', label: 'Intro', time: 2, window: 2 },
  { id: 'scene-2', label: 'Scene 2', time: 7, window: 2 },
  { id: 'scene-3', label: 'Scene 3', time: 12, window: 2 }
]

const TOTAL_FRAMES = 846
const SCROLL_THRESHOLD = 150 // Pixels de scroll necesarios para cambiar de escena

const experienceRef = ref(null)
const activeSceneIndex = ref(0) // Empezamos en escena 1 (índice 0)
const isTransitioning = ref(false)
const isLoading = ref(true)
const loadingProgress = ref(0)
const navigationDirection = ref('forward') // 'forward' o 'backward'

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

let lenis
let rafId
let lastScrollY = 0
let scrollTriggerInstance = null

// Activar escena con dirección de navegación
const activateScene = (index, direction = 'forward') => {
  // Si ya estamos en esta escena, no hacer nada
  if (index === activeSceneIndex.value) {
    return
  }
  
  // Si estamos en transición, ignorar
  if (isTransitioning.value) {
    return
  }
  
  navigationDirection.value = direction
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
  
  // Precargar frames críticos de cada escena
  VIDEO_SCENES.forEach((scene) => {
    const frameIndex = timeToFrameIndex(scene.time ?? 0)
    criticalFrames.push(frameIndex)
  })
  
  // Precargar frames adicionales alrededor de cada frame crítico
  const framesToLoad = new Set()
  criticalFrames.forEach((frame) => {
    for (let i = -5; i <= 5; i++) {
      const targetFrame = frame + i
      if (targetFrame >= 0 && targetFrame < TOTAL_FRAMES) {
        framesToLoad.add(targetFrame)
      }
    }
  })
  
  const promises = Array.from(framesToLoad).map((frameIndex) => {
    const framePath = getFramePath(frameIndex)
    return loadImage(framePath).catch(() => null)
  })
  
  const totalFrames = promises.length
  let loadedFrames = 0
  
  const results = await Promise.allSettled(
    promises.map((promise) =>
      promise.then((result) => {
        loadedFrames++
        loadingProgress.value = Math.min(loadedFrames / totalFrames, 0.9)
        return result
      })
    )
  )
  
  return results
}

const preloadAssets = async () => {
  const assets = [
    '/models/logo.obj',
    '/models/esfera.obj',
    '/textures/texture.jpg'
  ]
  
  const promises = assets.map((asset) =>
    fetch(asset)
      .then((response) => response.blob())
      .catch(() => null)
  )
  
  await Promise.all(promises)
}

const preloadAll = async () => {
  try {
    loadingProgress.value = 0
    
    // Block scroll during loading
    document.body.style.overflow = 'hidden'
    
    // Preload frames and assets in parallel
    await Promise.all([preloadCriticalFrames(), preloadAssets()])
    
    loadingProgress.value = 1
    
    // Small delay to show 100% before hiding
    await new Promise((resolve) => setTimeout(resolve, 300))
    
    isLoading.value = false
    document.body.style.overflow = ''
  } catch (error) {
    console.error('Error during preload:', error)
    // Still show the experience even if some assets fail
    await new Promise((resolve) => setTimeout(resolve, 300))
    isLoading.value = false
    document.body.style.overflow = ''
  }
}

const initScrollTrigger = () => {
  // Crear un trigger global que detecte la dirección y posición del scroll
  scrollTriggerInstance = ScrollTrigger.create({
    trigger: experienceRef.value,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      // Si estamos en transición, bloquear detección
      if (isTransitioning.value) {
        return
      }
      
      const currentScrollY = self.scroll()
      const scrollDelta = currentScrollY - lastScrollY
      
      // Detectar dirección del scroll
      const isScrollingDown = scrollDelta > 0
      const isScrollingUp = scrollDelta < 0
      
      // ESCENA 1 → ESCENA 2 (scroll hacia abajo)
      if (activeSceneIndex.value === 0 && isScrollingDown && currentScrollY > SCROLL_THRESHOLD) {
        activateScene(1, 'forward')
      }
      
      // ESCENA 2 → ESCENA 3 (scroll hacia abajo)
      if (activeSceneIndex.value === 1 && isScrollingDown && currentScrollY > SCROLL_THRESHOLD * 2) {
        activateScene(2, 'forward')
      }
      
      // ESCENA 2 → ESCENA 1 (scroll hacia arriba)
      if (activeSceneIndex.value === 1 && isScrollingUp && currentScrollY < SCROLL_THRESHOLD) {
        activateScene(0, 'backward')
      }
      
      // ESCENA 3 → ESCENA 2 (scroll hacia arriba)
      if (activeSceneIndex.value === 2 && isScrollingUp && currentScrollY < SCROLL_THRESHOLD * 2) {
        activateScene(1, 'backward')
      }
      
      lastScrollY = currentScrollY
    }
  })
}

const initLenis = () => {
  if (prefersReducedMotion) return

  lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    wheelMultiplier: 1.5,
    touchMultiplier: 1.5,
    infinite: false,
    duration: 0.8
  })

  lenis.on('scroll', () => {
    ScrollTrigger.update()
  })

  const raf = (time) => {
    lenis.raf(time)
    rafId = requestAnimationFrame(raf)
  }

  rafId = requestAnimationFrame(raf)
}

onMounted(async () => {
  await preloadAll()
  initScrollTrigger()
  initLenis()
  
  console.log(`✅ HomeView mounted - Escena 1 active by default`)
})

onBeforeUnmount(() => {
  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill()
  }

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
    <!-- Loading overlay -->
    <LoadingOverlay :is-loading="isLoading" :progress="loadingProgress" />
    
    <!-- Background video layer - fixed, behind everything -->
    <BackgroundVideo />
    
    <!-- Scene stage with video and overlay in separate layers -->
    <div class="scene-stage">
      <SceneVideo
        :active-scene-index="activeSceneIndex"
        :navigation-direction="navigationDirection"
        :scenes="VIDEO_SCENES"
        :hide-video="true"
        :is-loading="isLoading"
        @transition-start="handleTransitionStart"
        @transition-end="handleTransitionEnd"
      />
    </div>

    <!-- Spacer sections for scroll detection -->
    <div class="scroll-spacer scene-1-spacer"></div>
    <div class="scroll-spacer scene-2-spacer"></div>
    <div class="scroll-spacer scene-3-spacer"></div>
  </main>
</template>

<style scoped>
.home {
  min-height: 200vh;
  background: transparent;
  color: #0d1f16;
  position: relative;
  z-index: 1;
}

.scene-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
  z-index: 10;
  pointer-events: none;
}

.scene-stage > * {
  pointer-events: auto;
}

.scroll-spacer {
  height: 100vh;
  width: 100%;
  pointer-events: none;
}

.scene-1-spacer {
  /* Primera sección - Escena 1 */
}

.scene-2-spacer {
  /* Segunda sección - Escena 2 */
}
</style>
