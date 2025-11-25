<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import CleenLogo from '../assets/cleen.svg'
import AudioControl from '../assets/audio-control.svg'
import MenuIcon from '../assets/menu-icon.svg'

const props = defineProps({
  scenes: {
    type: Array,
    default: () => []
  },
  activeSceneIndex: {
    type: Number,
    default: 0
  },
  scrollProgress: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['transition-start', 'transition-end'])

const canvasRef = ref(null)
const containerRef = ref(null)
const TOTAL_FRAMES = 846
const brandAsset = CleenLogo
const audioIcon = AudioControl
const menuIcon = MenuIcon
const isMenuOpen = ref(false)

let resizeObserver
let seekTween
let pendingSceneIndex = 0
let currentFrameIndex = 0
let imageCache = new Map()
let loadingImages = new Set()
let frameAspectRatio = null // Store aspect ratio from first loaded frame

const toggleMenu = () => {
  console.log('Toggle menu clicked, current state:', isMenuOpen.value)
  isMenuOpen.value = !isMenuOpen.value
  console.log('New state:', isMenuOpen.value)
}

const closeMenu = () => {
  console.log('Close menu clicked')
  isMenuOpen.value = false
}

// Convert scene time (seconds) to frame index
// Assuming frames are distributed evenly across the sequence
// If scenes are at seconds 2, 7, 14, 19, 23, 32, and we have 846 frames
// We'll map: frameIndex = Math.round((time / 32) * TOTAL_FRAMES)
const timeToFrameIndex = (time) => {
  // Assuming the sequence represents ~32 seconds of content
  const maxTime = 32
  return Math.min(Math.round((time / maxTime) * TOTAL_FRAMES), TOTAL_FRAMES - 1)
}

const frameIndexToTime = (frameIndex) => {
  const maxTime = 32
  return (frameIndex / TOTAL_FRAMES) * maxTime
}

const clearTweens = () => {
  seekTween?.kill()
  seekTween = null
}

const getFramePath = (frameIndex) => {
  const padded = String(frameIndex + 1).padStart(5, '0')
  return `/videos/scroll-frames/frame_${padded}.jpg`
}

const loadImage = async (frameIndex) => {
  if (imageCache.has(frameIndex)) {
    return imageCache.get(frameIndex)
  }

  if (loadingImages.has(frameIndex)) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (imageCache.has(frameIndex)) {
          clearInterval(checkInterval)
          resolve(imageCache.get(frameIndex))
        }
      }, 50)
    })
  }

  loadingImages.add(frameIndex)
  const img = new Image()
  const path = getFramePath(frameIndex)

  return new Promise((resolve, reject) => {
    img.onload = () => {
      imageCache.set(frameIndex, img)
      loadingImages.delete(frameIndex)
      resolve(img)
    }
    img.onerror = () => {
      loadingImages.delete(frameIndex)
      reject(new Error(`Failed to load frame ${frameIndex}`))
    }
    img.src = path
  })
}

const preloadNearbyFrames = async (centerFrameIndex, range = 5) => {
  const promises = []
  for (let i = -range; i <= range; i++) {
    const frameIndex = centerFrameIndex + i
    if (frameIndex >= 0 && frameIndex < TOTAL_FRAMES) {
      promises.push(loadImage(frameIndex).catch(() => null))
    }
  }
  await Promise.all(promises)
}

const drawFrame = async (frameIndex) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  try {
    const img = await loadImage(frameIndex)
    if (!img) return

    // Store aspect ratio from first frame
    if (frameAspectRatio === null) {
      frameAspectRatio = img.width / img.height
    }

    // Get canvas display size (without DPR scaling)
    const displayWidth = canvas.style.width ? parseInt(canvas.style.width) : canvas.width / (window.devicePixelRatio || 1)
    const displayHeight = canvas.style.height ? parseInt(canvas.style.height) : canvas.height / (window.devicePixelRatio || 1)
    
    // Calculate cover dimensions (object-fit: cover)
    const canvasAspect = displayWidth / displayHeight
    let drawWidth, drawHeight, offsetX, offsetY

    if (frameAspectRatio > canvasAspect) {
      // Image is wider - fit to height, crop width
      drawHeight = displayHeight
      drawWidth = drawHeight * frameAspectRatio
      offsetX = (displayWidth - drawWidth) / 2
      offsetY = 0
    } else {
      // Image is taller - fit to width, crop height
      drawWidth = displayWidth
      drawHeight = drawWidth / frameAspectRatio
      offsetX = 0
      offsetY = (displayHeight - drawHeight) / 2
    }

    // Clear and draw with cover behavior
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
    currentFrameIndex = frameIndex

    // Preload nearby frames for smooth scrolling
    preloadNearbyFrames(frameIndex, 3)
  } catch (error) {
    console.warn(`Failed to draw frame ${frameIndex}:`, error)
  }
}

const goToScene = (sceneIndex) => {
  const scene = props.scenes[sceneIndex] ?? props.scenes[props.scenes.length - 1]
  if (!scene) return

  clearTweens()

  const targetFrameIndex = timeToFrameIndex(scene.time ?? 0)

  emit('transition-start', { index: sceneIndex })

  const startFrame = currentFrameIndex
  const distance = Math.abs(targetFrameIndex - startFrame)
  const duration = Math.max(distance * 0.01, 0.6)

  seekTween = gsap.to(
    { frame: startFrame },
    {
      frame: targetFrameIndex,
      duration,
      ease: 'power2.out',
      onUpdate: function () {
        const frame = Math.round(this.targets()[0].frame)
        drawFrame(frame)
      },
      onComplete: () => {
        emit('transition-end', { index: sceneIndex })
      }
    }
  )
}

const observeResize = () => {
  if (!containerRef.value || typeof ResizeObserver === 'undefined') return
  
  const updateCanvasSize = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    const { clientWidth, clientHeight } = containerRef.value
    const dpr = window.devicePixelRatio || 1
    
    // Set canvas internal resolution (high DPI)
    canvas.width = clientWidth * dpr
    canvas.height = clientHeight * dpr
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Scale context to match DPR
      ctx.scale(dpr, dpr)
    }

    // Set canvas display size to match viewport
    canvas.style.width = `${clientWidth}px`
    canvas.style.height = `${clientHeight}px`

    // Redraw current frame at new size with cover behavior
    if (currentFrameIndex >= 0) {
      drawFrame(currentFrameIndex)
    }
  }

  updateCanvasSize()
  
  resizeObserver = new ResizeObserver(updateCanvasSize)
  resizeObserver.observe(containerRef.value)
}

// Update frame based on scroll progress (continuous scrolling)
watch(
  () => props.scrollProgress,
  (progress) => {
    // Only update if not transitioning (transitions are handled by goToScene)
    if (seekTween?.isActive()) return
    
    const targetFrame = Math.round(progress * (TOTAL_FRAMES - 1))
    // Update frame if it's different (avoid unnecessary redraws)
    if (targetFrame !== currentFrameIndex && targetFrame >= 0 && targetFrame < TOTAL_FRAMES) {
      drawFrame(targetFrame)
    }
  },
  { immediate: true }
)

// Handle scene activation (snap to specific scenes)
// Note: Disabled automatic scene transitions to allow direct scroll control
// Uncomment goToScene if you want scene snapping behavior
watch(
  () => props.activeSceneIndex,
  (newIndex) => {
    if (currentFrameIndex === 0 && newIndex >= 0) {
      pendingSceneIndex = newIndex
      const scene = props.scenes[newIndex]
      if (scene) {
        const initialFrame = timeToFrameIndex(scene.time ?? 0)
        drawFrame(initialFrame)
      }
      return
    }
    // Disabled: Let scroll progress control frames directly
    // goToScene(newIndex)
  },
  { immediate: true }
)

onMounted(() => {
  observeResize()
  // Initialize with first frame
  if (props.activeSceneIndex >= 0) {
    const scene = props.scenes[props.activeSceneIndex]
    if (scene) {
      const initialFrame = timeToFrameIndex(scene.time ?? 0)
      drawFrame(initialFrame)
    } else {
      drawFrame(0)
    }
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTweens()
  imageCache.clear()
  loadingImages.clear()
})
</script>

<template>
  <div class="video-scene" ref="containerRef">
    <div class="video-stage">
      <canvas ref="canvasRef" class="video-stage__media"></canvas>

      <div class="video-overlay">
        <header class="brand-cluster">
          <img :src="brandAsset" alt="Cleen logo" class="brand-cluster__logo" />
          <div class="brand-cluster__meta">
            <p>By GUUD®</p>
            <p>All Rights Reserved.</p>
          </div>
        </header>

        <div class="scroll-prompt">
          <div class="scroll-prompt__box">
            <p class="scroll-prompt__text">Scroll down to <br>find your happiness.</p>
          </div>
        </div>

        <div class="center-content">
          <p class="center-content__tagline">
            GUUD is the most effective method for weight and body fat reduction, developed.
          </p>
        </div>

        <div class="bottom-hud">
          <button class="sound-control" type="button" aria-label="Toggle sound">
            <img :src="audioIcon" alt="Audio control" class="sound-control__icon" />
          </button>

          <!-- Menu closed state -->
          <div v-if="!isMenuOpen" class="menu-cluster">
            <button 
              class="menu-square" 
              type="button" 
              aria-label="Open navigation"
              @click="toggleMenu"
            >
              <img :src="menuIcon" alt="Menu icon" class="menu-square__icon" />
            </button>
            <button 
              class="menu-pill" 
              type="button" 
              aria-label="Open menu overlay"
              @click="toggleMenu"
            >
              <span class="menu-pill__text">menu</span>
            </button>
          </div>

          <!-- Menu open state -->
          <div v-else class="nav-menu">
            <button 
              class="nav-close" 
              type="button" 
              aria-label="Close menu"
              @click="closeMenu"
            >
              <span class="nav-close__icon">×</span>
            </button>
            <button class="nav-button" type="button">Benefits</button>
            <button class="nav-button" type="button">about</button>
            <button class="nav-button nav-button--pill" type="button">Download App</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.video-scene {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #1b4544;
  font-family: 'Exo 2', 'Space Grotesk', 'Inter', system-ui, sans-serif;
}

.video-stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.video-stage__media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.04) contrast(1.01);
  display: block;
  pointer-events: none;
}

.video-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: auto;
}

.brand-cluster {
  position: absolute;
  top: 72px;
  left: 96px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.brand-cluster__logo {
  width: 168px;
  height: auto;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.05));
  pointer-events: none;
}

.brand-cluster__meta {
  padding-top: 30px;
  font-size: 14px;
  color: rgba(27, 69, 68, 0.75);
}

.brand-cluster__meta p {
  margin: 0;
  line-height: 1.4;
}

.scroll-prompt {
  position: absolute;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 3;
}

.scroll-prompt__box {
  padding: 12px 24px;
  border: 1px solid #1b4544;
  border-radius: 12px;
  background: transparent;
}

.scroll-prompt__text {
  margin: 0;
  font-size: 16px;
  color: rgba(27, 69, 68, 0.85);
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-align: center;
}

.center-content {
  position: absolute;
  top: 70%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 3;
  text-align: center;
  max-width: 600px;
  padding: 0 24px;
}

.center-content__tagline {
  margin: 0;
  font-size: 18px;
  color: rgba(27, 69, 68, 0.75);
  line-height: 1.6;
  letter-spacing: 0.01em;
}

.bottom-hud {
  position: absolute;
  bottom: 96px;
  left: 96px;
  right: 96px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  pointer-events: auto;
}

.sound-control {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  margin-right: 24px;
  flex-shrink: 0;
}

.sound-control__icon {
  width: 80px;
  height: 80px;
  display: block;
  pointer-events: none;
}

.menu-cluster {
  display: inline-flex;
  align-items: center;
  gap: 0;
  pointer-events: auto;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.menu-square {
  border: none;
  background: transparent;
  width: 80px;
  height: 80px;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  pointer-events: auto;
}

.menu-square__icon {
  width: 80px;
  height: 80px;
  display: block;
  pointer-events: none;
}

.menu-pill {
  height: 80px;
  max-width: 131px;
  width: 131px;
  padding: 0;
  border-radius: 40px;
  border: none;
  background: #1b4544;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  pointer-events: auto;
}

.menu-pill__text {
  max-width: 67px;
  font-size: 20px;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.nav-menu {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-close {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  border: none;
  background: #1b4544;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  pointer-events: auto;
}

.nav-close__icon {
  font-size: 32px;
  line-height: 1;
  font-weight: 300;
  display: block;
  pointer-events: none;
}

.nav-button {
  height: 80px;
  padding: 0 24px;
  border-radius: 20px;
  border: none;
  background: #1b4544;
  color: #ffffff;
  font-size: 20px;
  letter-spacing: 0.05em;
  text-transform: lowercase;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  font-family: 'Exo 2', 'Space Grotesk', 'Inter', system-ui, sans-serif;
  pointer-events: auto;
}

.nav-button--pill {
  border-radius: 40px;
  padding: 0 32px;
}

@media (max-width: 1024px) {
  .video-stage {
    width: 100vw;
    border-radius: 0;
  }

  .brand-cluster {
    top: 40px;
    left: 32px;
  }

  .bottom-hud {
    left: 24px;
    right: 24px;
    bottom: 32px;
  }

  .menu-pill {
    max-width: 131px;
    width: 131px;
  }
  
  .menu-pill__text {
    max-width: 67px;
  }

  .scroll-prompt {
    top: 80px;
  }

  .scroll-prompt__box {
    padding: 10px 20px;
  }

  .scroll-prompt__text {
    font-size: 14px;
  }

  .center-content {
    max-width: 90%;
    padding: 0 16px;
  }

  .center-content__tagline {
    font-size: 16px;
  }
}
</style>

<!--
  Esta escena usa un video como fondo base y expone la prop "progress".
  "progress" debe actualizarse (0 → 1) según el ScrollTrigger del contenedor
  para sincronizar el avance del video con el scroll del usuario.
  Extiende este patrón para otras escenas basadas en video o motion graphics.
-->

