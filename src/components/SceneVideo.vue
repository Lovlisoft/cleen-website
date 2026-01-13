<script setup>
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import gsap from 'gsap'
import CleenLogo from '../assets/cleen.svg'
import AudioControl from '../assets/audio-control.svg'
import MenuIcon from '../assets/menu-icon.svg'
import Logo3D from './Logo3D.vue'
import FloatingPills from './FloatingPills.vue'

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
  },
  hideVideo: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['transition-start', 'transition-end', 'cooldown-start', 'cooldown-end'])

const canvasRef = ref(null)
const containerRef = ref(null)
const TOTAL_FRAMES = 846
const PLAYBACK_SPEED = 0.7 // Reducir velocidad en 30% (70% de la velocidad original)
const brandAsset = CleenLogo
const audioIcon = AudioControl
const menuIcon = MenuIcon
const isMenuOpen = ref(false)
const isTransitioning = ref(false)

// Menu animation refs
const menuSquareRef = ref(null)
const menuPillRef = ref(null)
const navCloseRef = ref(null)
const navButtonsRef = ref([])
const menuClusterRef = ref(null)
const navMenuRef = ref(null)
let menuAnimationTween = null

// Scene content animation refs
const sceneContentRef = ref(null)
const scene1ContentRef = ref(null)
const sceneIndicatorRef = ref(null)
let sceneContentTween = null

let resizeObserver
let seekTween
let autoPlayTween
let pendingSceneIndex = 0
let currentFrameIndex = 0
let imageCache = new Map()
let loadingImages = new Set()
let frameAspectRatio = null // Store aspect ratio from first loaded frame
let isPlayingForward = true // Direction for ping-pong effect
let isInCooldown = false
let cooldownTimer = null
const TRANSITION_DURATION = 1 // 1 segundo para todas las transiciones
const COOLDOWN_DURATION = 3000 // 3 segundos de cooldown después de cada transición

const animateMenuOpen = () => {
  if (menuAnimationTween) {
    menuAnimationTween.kill()
  }

  const menuSquare = menuSquareRef.value
  const menuPill = menuPillRef.value
  const navClose = navCloseRef.value
  const navButtons = navButtonsRef.value.filter(Boolean)
  const menuCluster = menuClusterRef.value
  const navMenu = navMenuRef.value

  if (!menuSquare || !menuPill || !navClose || !navMenu) return

  // Set initial states - ensure nav menu is visible but elements are hidden
  gsap.set(navMenu, { display: 'flex', opacity: 1, pointerEvents: 'auto' })
  gsap.set(navClose, { 
    scale: 0, 
    rotation: -180,
    opacity: 0
  })
  gsap.set(navButtons, { 
    x: 0, 
    y: 0, 
    scale: 0, 
    opacity: 0 
  })

  // Create timeline for menu opening
  const tl = gsap.timeline()

  // Step 1: Hide menu pill and transform square to circle
  tl.to(menuPill, {
    scale: 0,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in'
  })
  .to(menuSquare, {
    borderRadius: '50%',
    backgroundColor: '#1b4544',
    duration: 0.4,
    ease: 'power2.out'
  }, '-=0.2')
  .to(menuSquare.querySelector('.menu-square__icon'), {
    opacity: 0,
    scale: 0,
    duration: 0.2,
    ease: 'power2.in'
  }, '-=0.3')
  // Step 2: Transform square to close button
  .to(menuSquare, {
    scale: 1,
    rotation: 0,
    duration: 0.3,
    ease: 'back.out(1.7)',
    onComplete: () => {
      // Hide menu cluster
      if (menuCluster) {
        gsap.set(menuCluster, { display: 'none' })
      }
    }
  })
  .fromTo(navClose, 
    {
      scale: 0,
      rotation: -180,
      opacity: 0
    },
    {
      scale: 1,
      rotation: 0,
      opacity: 1,
      duration: 0.4,
      ease: 'back.out(1.7)'
    }, '-=0.2')
  // Step 3: Animate nav buttons appearing from the close button
  .to(navButtons, {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    duration: 0.5,
    stagger: 0.1,
    ease: 'back.out(1.4)',
    onStart: () => {
      // Set initial positions relative to close button
      navButtons.forEach((button, index) => {
        if (button) {
          const closeRect = navClose.getBoundingClientRect()
          const buttonRect = button.getBoundingClientRect()
          const startX = closeRect.left + closeRect.width / 2 - (buttonRect.left + buttonRect.width / 2)
          gsap.set(button, { x: startX, y: 0, scale: 0, opacity: 0 })
        }
      })
    }
  }, '-=0.2')

  menuAnimationTween = tl
}

const animateMenuClose = () => {
  if (menuAnimationTween) {
    menuAnimationTween.kill()
  }

  const menuSquare = menuSquareRef.value
  const menuPill = menuPillRef.value
  const navClose = navCloseRef.value
  const navButtons = navButtonsRef.value.filter(Boolean)
  const menuCluster = menuClusterRef.value
  const navMenu = navMenuRef.value

  if (!menuSquare || !menuPill || !navClose || !navMenu) return

  // Show menu cluster first (hidden but ready)
  if (menuCluster) {
    gsap.set(menuCluster, { display: 'flex' })
  }

  // Create timeline for menu closing (reverse animation)
  const tl = gsap.timeline({
    onComplete: () => {
      // Hide nav menu
      if (navMenu) {
        gsap.set(navMenu, { display: 'none' })
      }
      // Reset states
      gsap.set(menuSquare, {
        borderRadius: '0px',
        backgroundColor: 'transparent',
        scale: 1,
        rotation: 0
      })
      gsap.set(menuSquare.querySelector('.menu-square__icon'), {
        opacity: 1,
        scale: 1
      })
      gsap.set(menuPill, {
        scale: 1,
        opacity: 1
      })
    }
  })

  // Step 1: Animate nav buttons back to close button
  tl.to(navButtons, {
    x: 0,
    y: 0,
    scale: 0,
    opacity: 0,
    duration: 0.4,
    stagger: 0.05,
    ease: 'power2.in'
  })
  // Step 2: Hide close button
  .to(navClose, {
    scale: 0,
    rotation: -180,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in'
  }, '-=0.2')
  // Step 3: Transform close button back to square
  .to(menuSquare, {
    borderRadius: '0px',
    backgroundColor: 'transparent',
    duration: 0.4,
    ease: 'power2.out'
  }, '-=0.1')
  .to(menuSquare.querySelector('.menu-square__icon'), {
    opacity: 1,
    scale: 1,
    duration: 0.3,
    ease: 'power2.out'
  }, '-=0.3')
  // Step 4: Show menu pill
  .to(menuPill, {
    scale: 1,
    opacity: 1,
    duration: 0.3,
    ease: 'back.out(1.4)'
  }, '-=0.2')

  menuAnimationTween = tl
}

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
  autoPlayTween?.kill()
  autoPlayTween = null
  sceneContentTween?.kill()
  sceneContentTween = null
}

const startPingPongAnimation = () => {
  clearTweens()
  
  const startFrame = currentFrameIndex
  const targetFrame = isPlayingForward ? TOTAL_FRAMES - 1 : 0
  const distance = Math.abs(targetFrame - startFrame)
  const duration = Math.max(distance * 0.01 / PLAYBACK_SPEED, 0.6 / PLAYBACK_SPEED)
  
  autoPlayTween = gsap.to(
    { frame: startFrame },
    {
      frame: targetFrame,
      duration,
      ease: 'none',
      onUpdate: function () {
        const frame = Math.round(this.targets()[0].frame)
        drawFrame(frame)
      },
      onComplete: () => {
        // Cambiar dirección cuando llegue a un extremo
        isPlayingForward = !isPlayingForward
        // Reiniciar la animación en la nueva dirección
        startPingPongAnimation()
      }
    }
  )
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

const fadeOutSceneContent = () => {
  return new Promise((resolve) => {
    const scene1Content = scene1ContentRef.value
    const sceneIndicator = sceneIndicatorRef.value
    
    const elementsToFade = []
    if (scene1Content) {
      const scrollPrompt = scene1Content.querySelector('.scroll-prompt')
      const centerContent = scene1Content.querySelector('.center-content')
      if (scrollPrompt) elementsToFade.push(scrollPrompt)
      if (centerContent) elementsToFade.push(centerContent)
    }
    if (sceneIndicator) {
      elementsToFade.push(sceneIndicator)
    }
    
    if (elementsToFade.length > 0) {
      sceneContentTween = gsap.to(elementsToFade, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: resolve
      })
    } else {
      resolve()
    }
  })
}

const fadeInSceneContent = () => {
  return new Promise((resolve) => {
    nextTick(() => {
      const scene1Content = scene1ContentRef.value
      const sceneIndicator = sceneIndicatorRef.value
      
      const elementsToFade = []
      if (props.activeSceneIndex === 0 && scene1Content) {
        const scrollPrompt = scene1Content.querySelector('.scroll-prompt')
        const centerContent = scene1Content.querySelector('.center-content')
        if (scrollPrompt) {
          gsap.set(scrollPrompt, { opacity: 0 })
          elementsToFade.push(scrollPrompt)
        }
        if (centerContent) {
          gsap.set(centerContent, { opacity: 0 })
          elementsToFade.push(centerContent)
        }
      } else if (sceneIndicator) {
        gsap.set(sceneIndicator, { opacity: 0 })
        elementsToFade.push(sceneIndicator)
      }
      
      if (elementsToFade.length > 0) {
        sceneContentTween = gsap.to(elementsToFade, {
          opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
          onComplete: resolve
        })
      } else {
        resolve()
      }
    })
  })
}

const goToScene = (sceneIndex) => {
  const scene = props.scenes[sceneIndex] ?? props.scenes[props.scenes.length - 1]
  if (!scene) return

  // Si estamos en transición o cooldown, no hacer nada
  if (seekTween?.isActive() || isInCooldown) return

  clearTweens()
  clearCooldown()

  const targetFrameIndex = timeToFrameIndex(scene.time ?? 0)

  // Fade out contenido actual
  const fadeOutTween = fadeOutSceneContent()
  
  // Activar estado de transición después del fade out
  fadeOutTween.then(() => {
    isTransitioning.value = true
    emit('transition-start', { index: sceneIndex })

    const startFrame = currentFrameIndex
    // Usar duración fija de 1 segundo para todas las transiciones
    const duration = TRANSITION_DURATION

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
          // Desactivar estado de transición
          isTransitioning.value = false
          emit('transition-end', { index: sceneIndex })
          
          // Fade in nuevo contenido
          fadeInSceneContent().then(() => {
            // Iniciar cooldown después de la transición
            startCooldown()
          })
        }
      }
    )
  })
}

const clearCooldown = () => {
  if (cooldownTimer) {
    clearTimeout(cooldownTimer)
    cooldownTimer = null
  }
  isInCooldown = false
}

const startCooldown = () => {
  clearCooldown()
  isInCooldown = true
  emit('cooldown-start')
  
  cooldownTimer = setTimeout(() => {
    isInCooldown = false
    emit('cooldown-end')
    cooldownTimer = null
  }, COOLDOWN_DURATION)
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

// Update frame based on scroll progress (disabled for controlled transitions)
// Scroll progress is now handled through controlled scene transitions
// watch(
//   () => props.scrollProgress,
//   (progress) => {
//     // Only update if not transitioning (transitions are handled by goToScene)
//     if (seekTween?.isActive() || isInCooldown) return
//     
//     const targetFrame = Math.round(progress * (TOTAL_FRAMES - 1))
//     // Update frame if it's different (avoid unnecessary redraws)
//     if (targetFrame !== currentFrameIndex && targetFrame >= 0 && targetFrame < TOTAL_FRAMES) {
//       drawFrame(targetFrame)
//       
//       // Si llegamos al último frame, iniciar ping-pong en reversa
//       if (targetFrame === TOTAL_FRAMES - 1 && !autoPlayTween?.isActive()) {
//         isPlayingForward = false
//         startPingPongAnimation()
//       }
//       // Si llegamos al primer frame, iniciar ping-pong hacia adelante
//       else if (targetFrame === 0 && !autoPlayTween?.isActive()) {
//         isPlayingForward = true
//         startPingPongAnimation()
//       }
//       // Si el usuario está haciendo scroll manualmente, detener el auto-play
//       else if (autoPlayTween?.isActive() && targetFrame !== currentFrameIndex) {
//         autoPlayTween?.kill()
//         autoPlayTween = null
//       }
//     }
//   },
//   { immediate: true }
// )

// Handle scene activation with controlled transitions
watch(
  () => props.activeSceneIndex,
  (newIndex, oldIndex) => {
    // Inicialización en el primer frame
    if (currentFrameIndex === 0 && newIndex >= 0 && oldIndex === undefined) {
      pendingSceneIndex = newIndex
      const scene = props.scenes[newIndex]
      if (scene) {
        const initialFrame = timeToFrameIndex(scene.time ?? 0)
        drawFrame(initialFrame)
      }
      return
    }
    
    // Si el índice cambió y no estamos en transición/cooldown, iniciar transición
    if (newIndex !== oldIndex && oldIndex !== undefined) {
      goToScene(newIndex)
    }
  },
  { immediate: true }
)

// Watch menu state and animate
watch(
  () => isMenuOpen.value,
  (isOpen) => {
    // Wait for next tick to ensure DOM is updated
    nextTick(() => {
      if (isOpen) {
        animateMenuOpen()
      } else {
        animateMenuClose()
      }
    })
  }
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
  
  // Initialize menu state - hide nav menu initially
  nextTick(() => {
    const navMenu = navMenuRef.value
    const menuCluster = menuClusterRef.value
    if (navMenu) {
      gsap.set(navMenu, { display: 'none' })
    }
    if (menuCluster) {
      gsap.set(menuCluster, { display: 'flex' })
    }
    
    // Initialize scene content opacity
    const scene1Content = scene1ContentRef.value
    const sceneIndicator = sceneIndicatorRef.value
    if (props.activeSceneIndex === 0 && scene1Content) {
      const scrollPrompt = scene1Content.querySelector('.scroll-prompt')
      const centerContent = scene1Content.querySelector('.center-content')
      if (scrollPrompt) gsap.set(scrollPrompt, { opacity: 1 })
      if (centerContent) gsap.set(centerContent, { opacity: 1 })
    } else if (sceneIndicator) {
      gsap.set(sceneIndicator, { opacity: 1 })
    }
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTweens()
  clearCooldown()
  menuAnimationTween?.kill()
  imageCache.clear()
  loadingImages.clear()
})
</script>

<template>
  <div class="video-scene" ref="containerRef">
    <!-- Video layer (canvas) - separate layer -->
    <div class="video-layer" :class="{ 'video-layer--hidden': hideVideo }">
      <canvas ref="canvasRef" class="video-layer__canvas"></canvas>
    </div>

    <!-- Overlay layer (UI content) - separate layer -->
    <div class="video-overlay">
      <!-- Global header - always visible -->
      <header class="brand-cluster">
        <img :src="brandAsset" alt="Cleen logo" class="brand-cluster__logo" />
        <div class="brand-cluster__meta">
          <p>By GUUD®</p>
          <p>All Rights Reserved.</p>
        </div>
      </header>

      <!-- Scene-specific content -->
      <div ref="sceneContentRef" class="scene-content">
        <!-- Transition indicator - shown during transitions -->
        <div v-if="isTransitioning" class="transition-indicator">
          <div class="transition-indicator__box">
            <div class="transition-indicator__spinner"></div>
            <p class="transition-indicator__text">Transición...</p>
          </div>
        </div>

        <!-- Scene 1 content - original content -->
        <template v-else-if="props.activeSceneIndex === 0">
          <div ref="scene1ContentRef">
            <!-- Floating pills behind logo -->
            <FloatingPills :active="props.activeSceneIndex === 0" />
            
            <div class="scroll-prompt">
              <div class="scroll-prompt__box">
                <p class="scroll-prompt__text">Scroll down to <br>find your happiness.</p>
              </div>
            </div>

            <!-- 3D Logo in center -->
            <div class="logo-3d-container">
              <Logo3D :active="props.activeSceneIndex === 0" />
            </div>

            <div class="center-content">
              <p class="center-content__tagline">
                GUUD is the most effective method for weight and body fat reduction, developed.
              </p>
            </div>
          </div>
        </template>

        <!-- Scene content for other scenes - hidden during transitions -->
        <div v-else ref="sceneIndicatorRef" class="scene-indicator">
          <div class="scene-indicator__box">
            <h2 class="scene-indicator__title">
              Escena {{ props.activeSceneIndex + 1 }}
            </h2>
          </div>
        </div>
      </div>

      <!-- Global bottom HUD - always visible -->
      <div class="bottom-hud">
        <button class="sound-control" type="button" aria-label="Toggle sound">
          <img :src="audioIcon" alt="Audio control" class="sound-control__icon" />
        </button>

        <!-- Menu closed state -->
        <div ref="menuClusterRef" class="menu-cluster">
          <button 
            ref="menuSquareRef"
            class="menu-square" 
            type="button" 
            aria-label="Open navigation"
            @click="toggleMenu"
          >
            <img :src="menuIcon" alt="Menu icon" class="menu-square__icon" />
          </button>
          <button 
            ref="menuPillRef"
            class="menu-pill" 
            type="button" 
            aria-label="Open menu overlay"
            @click="toggleMenu"
          >
            <span class="menu-pill__text">menu</span>
          </button>
        </div>

        <!-- Menu open state -->
        <div ref="navMenuRef" class="nav-menu">
          <button 
            ref="navCloseRef"
            class="nav-close" 
            type="button" 
            aria-label="Close menu"
            @click="closeMenu"
          >
            <span class="nav-close__icon">×</span>
          </button>
          <button 
            :ref="el => navButtonsRef[0] = el"
            class="nav-button" 
            type="button"
          >
            Benefits
          </button>
          <button 
            :ref="el => navButtonsRef[1] = el"
            class="nav-button" 
            type="button"
          >
            about
          </button>
          <button 
            :ref="el => navButtonsRef[2] = el"
            class="nav-button nav-button--pill" 
            type="button"
          >
            Download App
          </button>
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

.video-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  overflow: hidden;
  opacity: 0.5;
}

.video-layer--hidden {
  display: none;
}

.video-layer__canvas {
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
  z-index: 20;
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

.logo-3d-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  max-width: 90vw;
  max-height: 90vh;
  pointer-events: none;
  z-index: 2;
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

.scene-content {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.scene-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 3;
  text-align: center;
  max-width: 600px;
  padding: 0 24px;
}

.scene-indicator__box {
  padding: 32px 48px;
  border: 1px solid rgba(27, 69, 68, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.scene-indicator__title {
  margin: 0;
  font-size: 32px;
  color: #1b4544;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.transition-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 4;
  text-align: center;
  max-width: 600px;
  padding: 0 24px;
}

.transition-indicator__box {
  padding: 32px 48px;
  border: 1px solid rgba(27, 69, 68, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.transition-indicator__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(27, 69, 68, 0.2);
  border-top-color: #1b4544;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.transition-indicator__text {
  margin: 0;
  font-size: 18px;
  color: #1b4544;
  font-weight: 500;
  letter-spacing: 0.02em;
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
  display: none;
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

