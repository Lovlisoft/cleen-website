<script setup>
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import gsap from 'gsap'
import CleenLogo from '../assets/cleen.svg'
import AudioControl from '../assets/audio-control.svg'
import MenuIcon from '../assets/menu-icon.svg'
import Logo3D from './Logo3D.vue'
import FloatingPills from './FloatingPills.vue'
import Sphere3D from './Sphere3D.vue'
import Pill3D from './Pill3D.vue'
import ParticleBackground from './ParticleBackground.vue'
import CenterParticle from './CenterParticle.vue'
import CircularText from './CircularText.vue'

const props = defineProps({
  scenes: {
    type: Array,
    default: () => []
  },
  activeSceneIndex: {
    type: Number,
    default: 0
  },
  navigationDirection: {
    type: String,
    default: 'forward' // 'forward' o 'backward'
  },
  hideVideo: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['transition-start', 'transition-end'])

// Configuration
const TOTAL_FRAMES = 846
const TRANSITION_SPEED_FACTOR = 1.0 // Factor de aceleración (1.0 = velocidad normal, 2.0 = doble velocidad)
const BASE_ANIMATION_DURATION = 2.5 // Duración base en segundos
const ANIMATION_DURATION = BASE_ANIMATION_DURATION / TRANSITION_SPEED_FACTOR

// Assets
const brandAsset = CleenLogo
const audioIcon = AudioControl
const menuIcon = MenuIcon

// Refs
const canvasRef = ref(null)
const containerRef = ref(null)
const isMenuOpen = ref(false)
const isTransitioning = ref(false)
const isSphereInCenter = ref(false)
const currentSceneState = ref('scene1') // 'scene1' | 'scene2' | 'transitioning'
const greenTransitionLayerRef = ref(null) // Layer verde de transición entre escenas

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
const scene2ContentRef = ref(null)
let sceneContentTween = null

// Swap refs
const logo3DContainerRef = ref(null)
const sphereControlRef = ref(null)

// Component refs for animations
const logo3DRef = ref(null)
const floatingPillsRef = ref(null)
const pill3DRef = ref(null)
const scene2ParticleLayerRef = ref(null)
const centerParticleLayerRef = ref(null)
const centerParticleRef = ref(null) // Ref directo al componente CenterParticle
const circularTextLayerRef = ref(null)
const scene2GrabAreaRef = ref(null)
const scene2LeftTextRef = ref(null)
const scene2RightBoxesRef = ref(null)

// Parallax drag state
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragLastPos = ref({ x: 0, y: 0 })
const parallaxOffset = ref({ x: 0, y: 0 })
const currentParallaxPos = ref({ x: 0, y: 0 })

// Video/canvas state
let resizeObserver
let seekTween
let pendingSceneIndex = 0
let currentFrameIndex = 0
let imageCache = new Map()
let loadingImages = new Set()
let frameAspectRatio = null

// ==================== MENU ANIMATIONS ====================
const animateMenuOpen = () => {
  if (menuAnimationTween) {
    menuAnimationTween.kill()
  }

  const square = menuSquareRef.value
  const pill = menuPillRef.value
  const navClose = navCloseRef.value
  const navButtons = navButtonsRef.value
  const menuCluster = menuClusterRef.value

  if (!square || !pill || !menuCluster) return

  menuAnimationTween = gsap.timeline()

  // Animate square shrinking
  menuAnimationTween.to(
    square,
    {
      width: 20,
      height: 20,
    duration: 0.3,
      ease: 'power2.inOut'
    },
    0
  )

  // Animate pill growing
  menuAnimationTween.to(
    pill,
    {
      width: 400,
      height: 400,
      duration: 0.5,
    ease: 'power2.out'
    },
    0.1
  )

  // Show nav menu
  if (navClose) {
    menuAnimationTween.to(
      navClose,
      {
        opacity: 1,
    duration: 0.3,
        ease: 'power2.out'
      },
      0.3
    )
  }

  // Animate nav buttons
  if (navButtons && navButtons.length > 0) {
    menuAnimationTween.to(
      navButtons,
      {
      opacity: 1,
        y: 0,
        duration: 0.4,
    stagger: 0.1,
        ease: 'power2.out'
      },
      0.4
    )
  }
}

const animateMenuClose = () => {
  if (menuAnimationTween) {
    menuAnimationTween.kill()
  }

  const square = menuSquareRef.value
  const pill = menuPillRef.value
  const navClose = navCloseRef.value
  const navButtons = navButtonsRef.value

  if (!square || !pill) return

  menuAnimationTween = gsap.timeline()

  // Hide nav buttons first
  if (navButtons && navButtons.length > 0) {
    menuAnimationTween.to(
      navButtons,
      {
    opacity: 0,
        y: 20,
        duration: 0.2,
    stagger: 0.05,
    ease: 'power2.in'
      },
      0
    )
  }

  // Hide close button
  if (navClose) {
    menuAnimationTween.to(
      navClose,
      {
    opacity: 0,
        duration: 0.2,
    ease: 'power2.in'
      },
      0
    )
  }

  // Shrink pill
  menuAnimationTween.to(
    pill,
    {
      width: 56,
      height: 56,
    duration: 0.3,
      ease: 'power2.inOut'
    },
    0.2
  )

  // Grow square
  menuAnimationTween.to(
    square,
    {
      width: 56,
      height: 56,
    duration: 0.3,
      ease: 'power2.inOut'
    },
    0.3
  )
}

const setNavButtonRef = (el) => {
  if (el && !navButtonsRef.value.includes(el)) {
    navButtonsRef.value.push(el)
  }
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

// ==================== SCENE CONTENT ANIMATIONS ====================

/**
 * Oculta solo elementos de UI (scroll prompt, texto, etc) pero NO los elementos 3D
 * Los elementos 3D se animan por separado
 */
const fadeOutUIElements = () => {
  if (sceneContentTween) {
    sceneContentTween.kill()
  }

  return new Promise((resolve) => {
    // Solo ocultar elementos de UI específicos (scroll prompt, etc)
    const scene1Content = scene1ContentRef.value
    const scene2Content = scene2ContentRef.value
    
    const elementsToFade = []
    
    if (scene1Content) {
      const scrollPrompt = scene1Content.querySelector('.scroll-prompt')
      const logoDescription = scene1Content.querySelector('.logo-description')
      if (scrollPrompt) elementsToFade.push(scrollPrompt)
      if (logoDescription) elementsToFade.push(logoDescription)
    }
    
    if (scene2Content) {
      elementsToFade.push(scene2Content)
    }

    if (elementsToFade.length === 0) {
      resolve()
      return
    }

    sceneContentTween = gsap.to(elementsToFade, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: resolve
    })
  })
}

/**
 * Muestra todo el contenido de la escena
 */
const fadeInSceneContent = () => {
  if (sceneContentTween) {
    sceneContentTween.kill()
  }

  return new Promise((resolve) => {
    const content = sceneContentRef.value
    if (!content) {
      resolve()
      return
    }

    gsap.set(content, { opacity: 0 })
    sceneContentTween = gsap.to(content, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.in',
      delay: 0.2,
      onComplete: resolve
    })
  })
}

// ==================== SWAP ANIMATIONS ====================
const swapPositions = () => {
  if (isTransitioning.value) return
  
  isTransitioning.value = true
  isSphereInCenter.value = !isSphereInCenter.value

  setTimeout(() => {
    isTransitioning.value = false
  }, 600)
}

// ==================== SCENE TRANSITION ANIMATIONS ====================

/**
 * ESCENA 1: Animación de entrada
 * Layer verde se desvanece, logo y pills aparecen desde el centro (o vuelven a su posición normal)
 */
const scene1_enter = async (transitionData = {}) => {
  const { usePill3D, reverse } = transitionData
  
  const logo3D = logo3DRef.value
  const floatingPills = floatingPillsRef.value
  const pill3D = pill3DRef.value
  
  if (!logo3D || !floatingPills) {
    console.error('❌ Logo3D or FloatingPills ref not available')
    return
  }
  
  // Si venimos en reversa, resetear elementos de escena 2 a sus valores originales
  if (reverse) {
    // Reset particle background
    if (scene2ParticleLayerRef.value) {
      gsap.set(scene2ParticleLayerRef.value, {
        opacity: 0,
        scale: 1,
        filter: 'none'
      })
    }
    
    // Reset center particle
    if (centerParticleLayerRef.value) {
      gsap.set(centerParticleLayerRef.value, {
        opacity: 0,
        scale: 1,
        filter: 'none'
      })
    }
    
    // Reset circular text
    if (circularTextLayerRef.value) {
      gsap.set(circularTextLayerRef.value, {
        opacity: 0,
        filter: 'none'
      })
    }
    
    // Reset left text
    if (scene2LeftTextRef.value) {
      gsap.set(scene2LeftTextRef.value, {
        opacity: 0,
        filter: 'none'
      })
    }
    
    // Reset right boxes
    if (scene2RightBoxesRef.value) {
      gsap.set(scene2RightBoxesRef.value, {
        opacity: 0,
        filter: 'none'
      })
    }
  }
  
  // Layer verde se desvanece primero para revelar la escena 1
  if (reverse && greenTransitionLayerRef.value) {
    await gsap.to(greenTransitionLayerRef.value, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out'
    })
  }
  
  // Si venimos en reversa y usamos pill 3D, contraerla
  if (reverse && usePill3D && pill3D) {
    await pill3D.animateShrink(ANIMATION_DURATION * 0.3)
  }
  
  // Logo vuelve a su tamaño normal usando el nuevo método animateEnter
  if (reverse) {
    await logo3D.animateEnter(ANIMATION_DURATION)
  }
  
  await fadeInSceneContent()
}

/**
 * ESCENA 1: Animación de salida
 * Logo crece enormemente, pills se dispersan, pill central crece
 */
const scene1_exit = async (transitionData = {}) => {
  // Ocultar solo elementos de UI (scroll prompt), NO los elementos 3D
  const uiFadePromise = fadeOutUIElements()
  
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const logo3D = logo3DRef.value
  const floatingPills = floatingPillsRef.value
  const pill3D = pill3DRef.value
  
  if (!logo3D || !floatingPills || !pill3D) {
    console.error('❌ Logo3D, FloatingPills or Pill3D ref not available')
    return { usePill3D: false }
  }
  
  const currentScale = logo3D.getCurrentScale()
  // Reducir el scale para que las letras sean visibles mientras las atravesamos
  // El efecto de atravesar viene del movimiento de cámara, no del scale
  const targetScale = Math.max(currentScale * 8, 10) // Scale moderado (8x-10x)
  
  // Ejecutar animaciones 3D en paralelo
  const logoPromise = logo3D.animateExit(targetScale, ANIMATION_DURATION).catch(err => {
    console.error('❌ Logo animation error:', err)
  })
  const pillsPromise = floatingPills.animateExit(ANIMATION_DURATION).catch(err => {
    console.error('❌ Pills animation error:', err)
  })
  
  // NUEVA SECUENCIA: Píldora central 3D sale PRIMERO
  // La píldora central sale al 25% del tiempo total, antes del fadeout de las letras
  // y mucho antes de las píldoras periféricas
  
  // Esperar al 25% del tiempo total (0.625 segundos con ANIMATION_DURATION = 2.5)
  await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION * 1000 * 0.25))
  
  // Píldora central 3D empieza con easing que arranca lento y luego super acelera
  // Dura más tiempo (0.8 * ANIMATION_DURATION = 2 segundos) para tener ese efecto de aceleración gradual
  const centerPillPromise = pill3D.animateGrow(ANIMATION_DURATION * 0.8).catch(err => {
    console.error('❌ Center pill 3D animation error:', err)
  })
  
  // Calcular cuándo detonar la explosión de píldoras periféricas
  // El zoom del logo toma 0.5 * ANIMATION_DURATION
  // Las letras ahora permanecen visibles hasta el 95% del zoom
  // Detonar la explosión al 40% del tiempo total para que coincida con el momento dramático
  // Pero ya esperamos 0.25, entonces esperamos 0.40 - 0.25 = 0.15 más
  
  await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION * 1000 * 0.15))
  
  // Explosión se detona al 40% del tiempo total (las letras aún son completamente visibles)
  const explosionPromise = floatingPills.animateExplosion(ANIMATION_DURATION * 0.7).catch(err => {
    console.error('❌ Explosion animation error:', err)
  })
  
  // Layer verde de transición aparece con overlap durante el crecimiento de la píldora
  // Empieza a aparecer al 35% del tiempo total para hacer overlap con el fade de la píldora
  // Ya estamos en el 40%, entonces no esperamos más y empezamos inmediatamente
  const greenLayerPromise = new Promise(resolve => {
    // Empezar inmediatamente (estamos en el 40% del tiempo)
    if (greenTransitionLayerRef.value) {
      gsap.to(greenTransitionLayerRef.value, {
        opacity: 1,
        duration: ANIMATION_DURATION * 0.6, // Dura 60% del tiempo para overlap significativo
        ease: 'power2.in', // Aceleración que complementa el crecimiento de la píldora
        onComplete: resolve
      })
    } else {
      resolve()
    }
  })
  
  // Esperar a que terminen todas las animaciones (UI, 3D y green layer)
  await Promise.all([uiFadePromise, logoPromise, pillsPromise, centerPillPromise, explosionPromise, greenLayerPromise])
  
  return { usePill3D: true }
}

/**
 * ESCENA 2: Animación de entrada
 * Layer verde se desvanece revelando la escena 2, pill central 3D se desvanece, contenido aparece
 */
const scene2_enter = async (transitionData = {}) => {
  const { usePill3D } = transitionData
  const pill3D = pill3DRef.value
  
  // Layer verde se desvanece (1.2s)
  const greenLayerPromise = greenTransitionLayerRef.value 
    ? gsap.to(greenTransitionLayerRef.value, {
        opacity: 0,
        duration: 1.2, // Desaparece en 1.2s
        ease: 'power2.out'
      })
    : Promise.resolve()
  
  // Particle background aparece con zoom-in dramático (2.4s - doble duración)
  // Inicia al mismo tiempo que el verde se desvanece, creando overlap
  const particleLayerPromise = scene2ParticleLayerRef.value
    ? gsap.fromTo(scene2ParticleLayerRef.value, 
        {
          opacity: 0,
          scale: 1.5 // Empieza 1.5x más grande
        },
        {
          opacity: 0.8, // Opacidad final del componente ParticleBackground
          scale: 1, // Tamaño normal
          duration: 2.4, // Doble duración
          ease: 'power2.out'
        }
      )
    : Promise.resolve()
  
  // Center particle aparece con zoom dramático extremo y blur alto (2.4s - doble duración)
  // También inicia simultáneamente con el verde, creando overlap
  const centerParticlePromise = centerParticleLayerRef.value
    ? gsap.fromTo(centerParticleLayerRef.value,
        {
          opacity: 0,
          scale: 10, // 10x más grande - zoom extremo
          filter: 'blur(50px)' // Blur muy alto al inicio
        },
        {
          opacity: 1,
          scale: 1, // Tamaño normal
          filter: 'blur(0px)', // Sin blur al final
          duration: 2.4, // Doble duración
          ease: 'power2.out'
        }
      )
    : Promise.resolve()
  
  // Esperar a que TODAS las animaciones terminen (incluyendo las más largas de 2.4s)
  await Promise.all([greenLayerPromise, particleLayerPromise, centerParticlePromise])
  
  // Desvanecer pill central 3D si está activa
  if (usePill3D && pill3D) {
    await pill3D.animateShrink(0.8)
  }
  
  // Animaciones secuenciales de textos con blur
  // 1. Texto izquierdo aparece primero
  const leftTextPromise = scene2LeftTextRef.value
    ? gsap.fromTo(scene2LeftTextRef.value,
        {
          opacity: 0,
          filter: 'blur(20px)' // Blur absoluto al inicio
        },
        {
          opacity: 1,
          filter: 'blur(0px)', // Sin blur al final
          duration: 0.8,
          ease: 'power2.out'
        }
      )
    : Promise.resolve()
  
  await leftTextPromise
  
  // 2. Cajas de la derecha aparecen después
  const rightBoxesPromise = scene2RightBoxesRef.value
    ? gsap.fromTo(scene2RightBoxesRef.value,
        {
          opacity: 0,
          filter: 'blur(20px)' // Blur absoluto al inicio
        },
        {
          opacity: 1,
          filter: 'blur(0px)', // Sin blur al final
          duration: 0.8,
          ease: 'power2.out'
        }
      )
    : Promise.resolve()
  
  await rightBoxesPromise
  
  // 3. Texto circular aparece al final
  const circularTextPromise = circularTextLayerRef.value
    ? gsap.fromTo(circularTextLayerRef.value,
        {
          opacity: 0,
          filter: 'blur(20px)' // Blur absoluto al inicio
        },
        {
          opacity: 1,
          filter: 'blur(0px)', // Sin blur al final
          duration: 0.8,
          ease: 'power2.out'
        }
      )
    : Promise.resolve()
  
  await circularTextPromise
}

/**
 * ESCENA 2: Animación de salida
 * Contenido desaparece, pill central 3D crece, layer verde aparece
 */
const scene2_exit = async (transitionData = {}) => {
  // Para escena 2, sí queremos ocultar el contenido
  const fadePromise = fadeOutUIElements()
  
  // Texto circular desaparece primero, antes de las otras animaciones
  const circularTextPromise = circularTextLayerRef.value
    ? gsap.to(circularTextLayerRef.value, {
        opacity: 0,
          duration: 0.4,
        ease: 'power2.in'
      })
    : Promise.resolve()
  
  await circularTextPromise
  
  const pill3D = pill3DRef.value
  if (!pill3D) {
    console.error('❌ Pill3D ref not available')
    await fadePromise
    return { usePill3D: false }
  }
  
  // Reiniciar la pill 3D a su estado inicial (invisible)
  pill3D.reset()
  
  // Animar pill central 3D que servirá de transición
  const pillPromise = pill3D.animateGrow(ANIMATION_DURATION * 0.8)
  
  // Layer verde de transición aparece Y particle background desaparece simultáneamente
  const greenLayerPromise = new Promise(resolve => {
    setTimeout(() => {
      if (greenTransitionLayerRef.value) {
        gsap.to(greenTransitionLayerRef.value, {
          opacity: 1,
          duration: ANIMATION_DURATION * 0.3,
          ease: 'power2.inOut',
          onComplete: resolve
        })
      } else {
        resolve()
      }
    }, ANIMATION_DURATION * 1000 * 0.5)
  })
  
  // Ocultar particle backgrounds con zoom-out (inverso a la entrada)
  const particleLayerPromise = new Promise(resolve => {
    setTimeout(() => {
      if (scene2ParticleLayerRef.value) {
        gsap.to(scene2ParticleLayerRef.value, {
          opacity: 0,
          scale: 1.5, // Se agranda mientras desaparece
          duration: ANIMATION_DURATION * 0.3,
          ease: 'power2.inOut',
          onComplete: resolve
        })
      } else {
        resolve()
      }
    }, ANIMATION_DURATION * 1000 * 0.5)
  })
  
  // Ocultar center particle con zoom-out extremo y blur alto (inverso a la entrada)
  const centerParticlePromise = new Promise(resolve => {
    setTimeout(() => {
      if (centerParticleLayerRef.value) {
        gsap.to(centerParticleLayerRef.value, {
          opacity: 0,
          scale: 10, // Se agranda 10x mientras desaparece
          filter: 'blur(50px)', // Blur alto al desaparecer
          duration: ANIMATION_DURATION * 0.3,
          ease: 'power2.inOut',
          onComplete: resolve
        })
      } else {
        resolve()
      }
    }, ANIMATION_DURATION * 1000 * 0.5)
  })
  
  await Promise.all([fadePromise, pillPromise, greenLayerPromise, particleLayerPromise, centerParticlePromise])
  
  return { usePill3D: true }
}

// ==================== SCENE ANIMATION CONFIGURATION ====================

/**
 * Configuración de animaciones por escena
 * Cada escena tiene una animación de entrada (enter) y salida (exit)
 * Esto permite escalar fácilmente a más escenas
 */
const SCENE_ANIMATIONS = {
  0: { // Escena 1
    enter: scene1_enter,
    exit: scene1_exit
  },
  1: { // Escena 2
    enter: scene2_enter,
    exit: scene2_exit
  }
  // Futuro: Agregar más escenas aquí
  // 2: { // Escena 3
  //   enter: scene3_enter,
  //   exit: scene3_exit
  // }
}

// ==================== SCENE ORCHESTRATION ====================

/**
 * Ejecuta la transición entre dos escenas de forma genérica
 * Funciona para cualquier número de escenas
 */
const executeTransition = async (fromScene, toScene, direction) => {
  // Validar que las escenas existen en la configuración
  if (!SCENE_ANIMATIONS[fromScene] || !SCENE_ANIMATIONS[toScene]) {
    console.error(`❌ Animation not configured for scene ${fromScene} or ${toScene}`)
    return
  }
  
  emit('transition-start', { from: fromScene, to: toScene, direction })
    isTransitioning.value = true
  currentSceneState.value = 'transitioning'
  
  let transitionData = {}
  
  try {
    // 1. Ejecutar animación de SALIDA de la escena actual
    const exitData = await SCENE_ANIMATIONS[fromScene].exit({ 
      direction, 
      reverse: direction === 'backward' 
    })
    
    // Guardar datos de transición (ej: centerPillElement)
    if (exitData) {
      transitionData = { ...transitionData, ...exitData }
    }
    
    // 2. Cambiar frame del video
    await changeVideoFrame(toScene)
    
    // 3. Ejecutar animación de ENTRADA de la escena nueva
    await SCENE_ANIMATIONS[toScene].enter({ 
      ...transitionData, 
      direction, 
      reverse: direction === 'backward' 
    })
    
  } catch (error) {
    console.error('❌ Transition error:', error)
  }
  
  // Actualizar estado de la escena
  currentSceneState.value = `scene${toScene + 1}`
  isTransitioning.value = false
  emit('transition-end', { from: fromScene, to: toScene, direction })
}

const changeVideoFrame = (sceneIndex) => {
  return new Promise((resolve) => {
    const scene = props.scenes[sceneIndex]
    if (!scene) {
      resolve()
      return
    }
    
    const targetFrameIndex = timeToFrameIndex(scene.time ?? 0)
    const startFrame = currentFrameIndex
    const duration = 0.5
    
    if (seekTween) {
      seekTween.kill()
    }

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
        onComplete: resolve
      }
    )
  })
}

// ==================== VIDEO/CANVAS RENDERING ====================
const timeToFrameIndex = (time) => {
  const maxTime = 32
  return Math.min(Math.round((time / maxTime) * TOTAL_FRAMES), TOTAL_FRAMES - 1)
}

const getFramePath = (frameIndex) => {
  const padded = String(frameIndex + 1).padStart(5, '0')
  return `/videos/scroll-frames/frame_${padded}.jpg`
}

const loadFrame = async (frameIndex) => {
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
      }, 10)
    })
  }

  loadingImages.add(frameIndex)
  const framePath = getFramePath(frameIndex)

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = framePath
    })

    imageCache.set(frameIndex, img)
    loadingImages.delete(frameIndex)

    if (!frameAspectRatio && img.width && img.height) {
      frameAspectRatio = img.width / img.height
    }

    return img
  } catch (error) {
    console.debug(`Frame ${frameIndex} not available (expected if using video instead of frames)`)
    loadingImages.delete(frameIndex)
    return null
  }
}

const drawFrame = async (frameIndex) => {
  if (frameIndex < 0 || frameIndex >= TOTAL_FRAMES) return

  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = await loadFrame(frameIndex)
  if (!img) return

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

  currentFrameIndex = frameIndex
}

const observeResize = () => {
  if (!containerRef.value || typeof ResizeObserver === 'undefined') return
  
  const updateCanvasSize = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    const { clientWidth, clientHeight } = containerRef.value
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = clientWidth * dpr
    canvas.height = clientHeight * dpr

    canvas.style.width = `${clientWidth}px`
    canvas.style.height = `${clientHeight}px`
    
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
    }

      drawFrame(currentFrameIndex)
  }
  
  resizeObserver = new ResizeObserver(updateCanvasSize)
  resizeObserver.observe(containerRef.value)
  updateCanvasSize()
}

const clearTweens = () => {
  if (seekTween) {
    seekTween.kill()
    seekTween = null
  }
}

// ==================== WATCHERS ====================
watch(
  () => [props.activeSceneIndex, props.navigationDirection],
  ([newIndex, newDirection], oldValue) => {
    // Desestructurar de forma segura el valor anterior
    const oldIndex = oldValue ? oldValue[0] : undefined
    
    // Inicialización
    if (oldIndex === undefined) {
      const scene = props.scenes[newIndex]
      if (scene) {
        const initialFrame = timeToFrameIndex(scene.time ?? 0)
        drawFrame(initialFrame)
      }
      return
    }
    
    // Si el índice cambió, ejecutar transición
    if (newIndex !== oldIndex) {
      executeTransition(oldIndex, newIndex, newDirection)
    }
  },
  { immediate: true }
)

watch(
  () => isMenuOpen.value,
  (isOpen) => {
    nextTick(() => {
      if (isOpen) {
        animateMenuOpen()
      } else {
        animateMenuClose()
      }
    })
  }
)

// ==================== PARALLAX DRAG FUNCTIONALITY ====================

/**
 * Maneja el inicio del arrastre
 */
const handleDragStart = (event) => {
  if (currentSceneState.value !== 'scene2') return
  
  isDragging.value = true
  const clientX = event.clientX || event.touches?.[0].clientX
  const clientY = event.clientY || event.touches?.[0].clientY
  
  dragStartPos.value = { x: clientX, y: clientY }
  dragLastPos.value = { x: clientX, y: clientY }
  
  // Pausar la animación automática de la partícula
  if (centerParticleRef.value) {
    centerParticleRef.value.pause()
  }
  
  // Cambiar cursor a grabbing
  if (scene2GrabAreaRef.value) {
    scene2GrabAreaRef.value.style.cursor = 'grabbing'
  }
}

/**
 * Maneja el movimiento del arrastre
 */
const handleDragMove = (event) => {
  if (!isDragging.value || currentSceneState.value !== 'scene2') return
  
  const currentX = event.clientX || event.touches?.[0].clientX
  const currentY = event.clientY || event.touches?.[0].clientY
  
  // Calcular diferencia desde el inicio del arrastre (para el parallax)
  const deltaXFromStart = currentX - dragStartPos.value.x
  const deltaYFromStart = currentY - dragStartPos.value.y
  
  // Calcular diferencia desde el último frame (para controlar la animación)
  const deltaXFromLast = currentX - dragLastPos.value.x
  const deltaYFromLast = currentY - dragLastPos.value.y
  
  // Actualizar última posición
  dragLastPos.value = { x: currentX, y: currentY }
  
  // Multiplicador para el efecto parallax (más alto = movimiento más agresivo)
  const parallaxStrength = 0.8 // Aumentado significativamente para movimiento agresivo
  
  // Calcular nueva posición del fondo (dirección contraria)
  const newX = -deltaXFromStart * parallaxStrength
  const newY = -deltaYFromStart * parallaxStrength
  
  // Límite ampliado para permitir llegar a los bordes del fondo expandido (140%)
  const maxOffset = 150 // Aumentado para permitir alcanzar los bordes del fondo
  parallaxOffset.value = {
    x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
    y: Math.max(-maxOffset, Math.min(maxOffset, newY))
  }
  
  // Aplicar transformación más rápida y directa al fondo
  if (scene2ParticleLayerRef.value) {
    gsap.to(scene2ParticleLayerRef.value, {
      x: parallaxOffset.value.x,
      y: parallaxOffset.value.y,
      duration: 0.1, // Reducido para respuesta más rápida y agresiva
      ease: 'power1.out' // Ease más directo
    })
  }
  
  // Mover y hacer zoom a la partícula central (movimiento más sutil, misma dirección que el mouse)
  if (centerParticleLayerRef.value) {
    const centerMovement = {
      x: deltaXFromStart * 0.15, // 15% del movimiento del mouse (misma dirección)
      y: deltaYFromStart * 0.15
    }
    const zoomFactor = 1 + (Math.abs(deltaXFromStart) + Math.abs(deltaYFromStart)) * 0.0003 // Zoom sutil
    
    gsap.to(centerParticleLayerRef.value, {
      x: centerMovement.x,
      y: centerMovement.y,
      scale: zoomFactor,
      duration: 0.1,
      ease: 'power1.out'
    })
  }
  
  // Mover y hacer zoom al texto circular (similar a la partícula)
  if (circularTextLayerRef.value) {
    const textMovement = {
      x: deltaXFromStart * 0.15,
      y: deltaYFromStart * 0.15
    }
    const textZoom = 1 + (Math.abs(deltaXFromStart) + Math.abs(deltaYFromStart)) * 0.0003
    
    gsap.to(circularTextLayerRef.value, {
      x: textMovement.x,
      y: textMovement.y,
      scale: textZoom,
      duration: 0.1,
      ease: 'power1.out'
    })
  }
  
  // Controlar frames de la partícula central basado en movimiento horizontal Y vertical
  if (centerParticleRef.value) {
    // Combinar movimiento horizontal y vertical
    // Horizontal: derecha (+) = adelante, izquierda (-) = atrás
    // Vertical: arriba (-) = adelante (simula derecha), abajo (+) = atrás (simula izquierda)
    const horizontalMovement = deltaXFromLast
    const verticalMovement = -deltaYFromLast // Invertir para que arriba sea positivo
    
    // Combinar ambos movimientos
    const combinedMovement = horizontalMovement + verticalMovement
    const movementMagnitude = Math.abs(combinedMovement)
    
    // Si hay movimiento significativo, avanzar/retroceder frames
    if (movementMagnitude > 2) { // Umbral de sensibilidad
      // Calcular cuántos frames avanzar (basado en velocidad del arrastre)
      const frameStep = Math.ceil(movementMagnitude / 10) // Ajustar divisor para sensibilidad
      
      // Dirección: positivo = adelante, negativo = atrás
      const direction = combinedMovement > 0 ? 1 : -1
      
      centerParticleRef.value.advanceFrame(direction * frameStep)
    }
  }
}

/**
 * Maneja el fin del arrastre
 */
const handleDragEnd = () => {
  if (!isDragging.value) return
  
  isDragging.value = false
  
  // Restaurar cursor
  if (scene2GrabAreaRef.value) {
    scene2GrabAreaRef.value.style.cursor = 'grab'
  }
  
  // Animar de vuelta a la posición original con rebote
  if (scene2ParticleLayerRef.value) {
    gsap.to(scene2ParticleLayerRef.value, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: 'elastic.out(0.7, 0.5)' // Rebote reducido 30%
    })
  }
  
  // Rebotar la partícula central a su posición original con zoom
  if (centerParticleLayerRef.value) {
    gsap.to(centerParticleLayerRef.value, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: 'elastic.out(0.7, 0.3)' // Rebote reducido 30%
    })
  }
  
  // Rebotar el texto circular
  if (circularTextLayerRef.value) {
    gsap.to(circularTextLayerRef.value, {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: 'elastic.out(0.7, 0.3)' // Rebote reducido 30%
    })
  }
  
  // Reanudar la animación automática de la partícula
  if (centerParticleRef.value) {
    centerParticleRef.value.play()
  }
  
  // Resetear offset
  parallaxOffset.value = { x: 0, y: 0 }
}

onMounted(() => {
  observeResize()
  
  // Initialize with first frame
  if (props.activeSceneIndex >= 0) {
    const scene = props.scenes[props.activeSceneIndex]
    if (scene) {
      const initialFrame = timeToFrameIndex(scene.time ?? 0)
      drawFrame(initialFrame)
    }
  }
  
  // Initialize menu state
  nextTick(() => {
    const navClose = navCloseRef.value
    const navButtons = navButtonsRef.value
    
    if (navClose) gsap.set(navClose, { opacity: 0 })
    if (navButtons) gsap.set(navButtons, { opacity: 0, y: 20 })
  })
  
  // Setup parallax drag listeners
  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
  window.addEventListener('touchmove', handleDragMove)
  window.addEventListener('touchend', handleDragEnd)
  
  console.log('✅ SceneVideo mounted')
})

// Scene 2 particle background is now controlled by ParticleBackground component
// via the :active prop

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearTweens()
  menuAnimationTween?.kill()
  imageCache.clear()
  loadingImages.clear()
  
  // Remove parallax drag listeners
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
  window.removeEventListener('touchmove', handleDragMove)
  window.removeEventListener('touchend', handleDragEnd)
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
      <!-- Scene-specific content -->
      <div ref="sceneContentRef" class="scene-content">
        <!-- Escena 1 content -->
        <template v-if="props.activeSceneIndex === 0 || currentSceneState === 'scene1' || currentSceneState === 'transitioning'">
          <div ref="scene1ContentRef">
            <!-- Floating pills behind logo -->
            <FloatingPills 
              ref="floatingPillsRef"
              :active="props.activeSceneIndex === 0 || currentSceneState === 'transitioning'" 
              :is-loading="props.isLoading" 
            />
            
            <div class="scroll-prompt">
              <p class="scroll-prompt__text">
                Scroll down to find<br />your happiness.
              </p>
          </div>

            <!-- 3D Logo -->
            <div class="center-content">
              <div 
                ref="logo3DContainerRef"
                class="logo-3d-container"
                :class="{ 'logo-3d-container--swapped': isSphereInCenter }"
              >
                <Logo3D 
                  ref="logo3DRef"
                  :is-loading="props.isLoading" 
                  :active="props.activeSceneIndex === 0 || currentSceneState === 'transitioning'"
                />
        </div>

              <!-- Text below logo -->
              <div class="logo-description">
                <p class="logo-description__text">
                  GUUD is the most effective method for weight<br />
                  and body fat reduction, developed.
                </p>
              </div>
            </div>

            <!-- Bottom HUD with swap control and audio -->
            <div class="bottom-hud">
              <button 
                @click="swapPositions"
                ref="sphereControlRef"
                class="sphere-control"
                :class="{ 'sphere-control--swapped': isSphereInCenter }"
                aria-label="Toggle 3D model"
              >
                <Sphere3D :active="true" />
              </button>
              
              <!-- Audio control below sphere -->
              <button class="audio-control" aria-label="Toggle audio">
                <img :src="audioIcon" alt="Audio control" />
              </button>
            </div>
          </div>
        </template>

        <!-- Escena 2 content -->
        <template v-if="props.activeSceneIndex === 1 || currentSceneState === 'scene2' || currentSceneState === 'transitioning'">
          <div ref="scene2ContentRef" class="scene2-container">
            <!-- Invisible circular grab area -->
            <div 
              ref="scene2GrabAreaRef"
              class="scene2-grab-area"
              @mousedown="handleDragStart"
              @touchstart="handleDragStart"
            ></div>
            
            <!-- Left side text -->
            <div ref="scene2LeftTextRef" class="scene2-left-text">
              <p>
                It combines numerous<br />
                components, which work<br />
                synergistically to improve<br />
                healthy fat metabolism and<br />
                mitochondrial function.
              </p>
            </div>
            
            <!-- Right side benefit boxes -->
            <div ref="scene2RightBoxesRef" class="scene2-right-boxes">
              <div class="benefit-box">
                <span>Benefits</span>
              </div>
              <div class="benefit-box">
                <span>Science-Backed Weight Loss</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Global header - always visible -->
      <header class="brand-cluster">
        <img :src="brandAsset" alt="Cleen logo" class="brand-cluster__logo" />
        <div class="brand-cluster__meta">
          <p>By GUUD®</p>
          <p>All Right Reserved.</p>
          </div>
      </header>

      <!-- Menu controls - always visible -->
      <div class="menu-cluster" ref="menuClusterRef">
        <button @click="toggleMenu" class="menu-cluster__button" aria-label="Toggle menu">
          <div class="menu-cluster__square" ref="menuSquareRef">
            <img :src="menuIcon" alt="Menu" class="menu-cluster__icon" />
        </div>
          <div class="menu-cluster__pill" ref="menuPillRef">
            <span class="menu-cluster__text">menu</span>
      </div>
        </button>

        <!-- Nav menu -->
        <nav class="nav-menu" ref="navMenuRef">
          <button @click="toggleMenu" class="nav-menu__close" ref="navCloseRef" aria-label="Close menu">
            <span>×</span>
        </button>
          <ul class="nav-menu__list">
            <li><a href="#" :ref="setNavButtonRef" class="nav-menu__link">Home</a></li>
            <li><a href="#" :ref="setNavButtonRef" class="nav-menu__link">About</a></li>
            <li><a href="#" :ref="setNavButtonRef" class="nav-menu__link">Products</a></li>
            <li><a href="#" :ref="setNavButtonRef" class="nav-menu__link">Contact</a></li>
          </ul>
        </nav>
      </div>
      
      <!-- Bottom right menu controls -->
    </div>
    
    <!-- Scene 2 particle background layer - frame-by-frame animation with transparency -->
    <div 
      v-if="props.activeSceneIndex === 1 || currentSceneState === 'scene2'" 
      ref="scene2ParticleLayerRef"
      class="scene2-particle-layer"
    >
      <ParticleBackground :active="props.activeSceneIndex === 1 || currentSceneState === 'scene2'" />
    </div>
    
    <!-- Center particle animation - appears in Scene 2 above background -->
    <div 
      v-if="props.activeSceneIndex === 1 || currentSceneState === 'scene2'" 
      ref="centerParticleLayerRef"
      class="center-particle-layer"
    >
      <CenterParticle 
        ref="centerParticleRef"
        :active="props.activeSceneIndex === 1 || currentSceneState === 'scene2'" 
      />
        </div>

    <!-- Circular text - appears in Scene 2 around center -->
    <div 
      v-if="props.activeSceneIndex === 1 || currentSceneState === 'scene2'" 
      ref="circularTextLayerRef"
      class="circular-text-layer"
    >
      <CircularText text="supports Healthy Fat Metabolism" />
        </div>
    
    <!-- Green transition layer - appears during scene transitions -->
    <div ref="greenTransitionLayerRef" class="green-transition-layer"></div>
    
    <!-- Center Pill 3D for transitions - always mounted -->
    <Pill3D ref="pill3DRef" />
  </div>
</template>

<style scoped>
.video-scene {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  user-select: none; /* Evitar selección de texto */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-touch-callout: none; /* Evitar menú contextual en iOS */
}

/* Evitar arrastre de imágenes */
.video-scene img {
  pointer-events: none;
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
}

/* Restaurar pointer-events para botones */
.video-scene button,
.video-scene button img {
  pointer-events: auto;
}

.video-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.video-layer--hidden {
  display: none;
}

.video-layer__canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10; /* Por encima de todo para el contenido */
  pointer-events: none;
}

.video-overlay > * {
  pointer-events: auto;
}

/* Brand header */
.brand-cluster {
  position: absolute;
  top: 2.5rem;
  left: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  z-index: 100;
}

.brand-cluster__logo {
  width: 140px;
  height: auto;
}

.brand-cluster__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.brand-cluster__meta p {
  font-size: 0.875rem;
  color: #1B4544;
  margin: 0;
  line-height: 1.3;
  font-weight: 400;
}

/* Scene content */
.scene-content {
  position: relative;
  width: 100%;
  height: 100%;
  transition: opacity 0.3s ease;
}

/* Scene 2 container and background video */
.scene2-container {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Scene 2 - Invisible circular grab area */
.scene2-grab-area {
  position: absolute;
  top: calc(50% - 20px); /* Centrado con la partícula (misma posición) */
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px; /* Diámetro: 2 * radio (74) * 2 para área generosa */
  height: 300px;
  border-radius: 50%;
  z-index: 8; /* Por encima de partículas (6) pero debajo del texto circular (7) y UI (10) */
  cursor: grab; /* Cursor de manita abierta */
  pointer-events: auto;
}

.scene2-grab-area:active {
  cursor: grabbing; /* Cursor de manita cerrada cuando se hace clic */
}

/* Scene 2 - Left side text */
.scene2-left-text {
  position: absolute;
  left: 4rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  color: #1B4544;
  font-size: 0.875rem;
  line-height: 1.6;
  font-weight: 400;
  max-width: 280px;
  opacity: 0; /* Inicialmente invisible para animación */
}

.scene2-left-text p {
  margin: 0;
}

/* Scene 2 - Right side benefit boxes */
.scene2-right-boxes {
  position: absolute;
  right: 4rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end; /* Alineadas a la derecha */
  opacity: 0; /* Inicialmente invisible para animación */
}

.benefit-box {
  background-color: #1B4544;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: right; /* Texto alineado a la derecha */
  width: fit-content; /* Ajustado al contenido */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  white-space: nowrap; /* Evita que el texto se rompa en múltiples líneas */
}

.benefit-box span {
  display: block;
}

/* Responsive adjustments for Scene 2 */
@media (max-width: 768px) {
  .scene2-left-text {
    left: 2rem;
    font-size: 0.75rem;
    max-width: 200px;
  }
  
  .scene2-right-boxes {
    right: 2rem;
  }
  
  .benefit-box {
    font-size: 0.75rem;
    padding: 0.75rem 1rem;
  }
}

@media (max-width: 480px) {
  .scene2-left-text {
    left: 1rem;
    font-size: 0.625rem;
    max-width: 150px;
  }
  
  .scene2-right-boxes {
    right: 1rem;
    gap: 0.5rem;
  }
  
  .benefit-box {
    font-size: 0.625rem;
    padding: 0.5rem 0.75rem;
  }
}

.scene2-particle-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5; /* Por encima del fondo general (z-index: 1) pero debajo del contenido (z-index: 10) */
  pointer-events: none;
  opacity: 0; /* Inicialmente invisible, se anima en scene2_enter */
}

/* Center particle animation layer - Scene 2 */
.center-particle-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 6; /* Por encima del particle background (z-index: 5) */
  pointer-events: none;
  opacity: 0; /* Inicialmente invisible, se anima en scene2_enter */
}

/* Circular text layer - Scene 2 */
.circular-text-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 7; /* Por encima de la partícula central (z-index: 6) */
  pointer-events: none;
  opacity: 0; /* Inicialmente invisible, se anima en scene2_enter */
}

/* Green transition layer - covers entire screen during scene transitions */
.green-transition-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #00FF88; /* Verde brillante GUUD */
  opacity: 0; /* Invisible por defecto */
  z-index: 15; /* Por encima de todo el contenido (z-index: 10) pero debajo de la Pill3D (z-index: 10 en su canvas) */
  pointer-events: none; /* No interfiere con interacciones */
}

/* Scroll prompt */
.scroll-prompt {
  position: absolute;
  top: 5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  border: 2px solid rgba(0, 0, 0, 1);
  border-radius: 20px;
  padding: 0.75rem 1.75rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
}

.scroll-prompt__text {
  font-size: 1rem;
  font-weight: 400;
  color: #000;
  text-align: center;
  margin: 0;
  line-height: 1.4;
}

/* Logo description text */
.logo-description {
  position: absolute;
  bottom: 15vh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  text-align: center;
  max-width: 90%;
}

.logo-description__text {
  font-size: 1.125rem;
  font-weight: 400;
  color: #0d1f16;
  text-align: center;
  margin: 0;
  line-height: 1.6;
}

/* Center content with 3D elements */
.center-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.logo-3d-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
  z-index: 5;
}

.logo-3d-container--swapped {
  top: auto;
  left: 2.5rem;
  bottom: 2.5rem;
  transform: translate(0, 0) scale(0.15);
  width: 400px;
  height: 400px;
}

/* Bottom HUD */
.bottom-hud {
  position: absolute;
  bottom: 2.5rem;
  left: 2.5rem;
  z-index: 20;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.bottom-hud > * {
  pointer-events: auto;
}

.sphere-control {
  width: 120px;
  height: 120px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 20;
  position: relative;
}

.sphere-control--swapped {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(5);
  width: 400px;
  height: 400px;
}

/* Scene 2 content styles - por definir */

/* Menu cluster */
.menu-cluster {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
}

.menu-cluster__button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  height: 56px;
  transition: transform 0.2s ease;
}

.menu-cluster__button:hover {
  transform: scale(1.02);
}

.menu-cluster__square {
  position: relative;
  width: 56px;
  height: 56px;
  background: #1B4544;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.menu-cluster__button:hover .menu-cluster__square {
  background: #24615f;
}

.menu-cluster__icon {
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1); /* Hacer el ícono blanco */
}

.menu-cluster__pill {
  position: relative;
  height: 56px;
  background: #1B4544;
  border-radius: 28px;
  padding: 0 2rem 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -8px;
  z-index: 1;
  transition: all 0.3s ease;
}

.menu-cluster__button:hover .menu-cluster__pill {
  background: #24615f;
}

.menu-cluster__text {
  color: #ffffff;
  font-size: 1.125rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* Nav menu */
.nav-menu {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.nav-menu__close {
  position: absolute;
  top: -180px;
  right: -180px;
  width: 40px;
  height: 40px;
  border: none;
  background: #07E400;
  border-radius: 50%;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: auto;
}

.nav-menu__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nav-menu__link {
  color: #0d1f16;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: 600;
  opacity: 0;
  pointer-events: auto;
  transition: color 0.2s ease;
}

.nav-menu__link:hover {
  color: #07E400;
}

/* Audio control */
.audio-control {
  width: 56px;
  height: 56px;
  border: 2px solid #1B4544;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.audio-control:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 1);
}

.audio-control img {
  width: 30px;
  height: 28px;
}

@media (max-width: 768px) {
  .brand-cluster {
    top: 1.5rem;
    left: 1.5rem;
    gap: 0.5rem;
  }
  
  .brand-cluster__logo {
    width: 100px;
  }
  
  .brand-cluster__meta p {
    font-size: 0.75rem;
  }

  .menu-cluster {
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .menu-cluster__square {
    width: 48px;
    height: 48px;
    border-radius: 10px;
  }
  
  .menu-cluster__pill {
    height: 48px;
    padding: 0 1.5rem 0 1.25rem;
    border-radius: 24px;
  }
  
  .menu-cluster__text {
    font-size: 1rem;
  }
  
  .menu-cluster__icon {
    width: 20px;
    height: 20px;
  }

  .scroll-prompt {
    right: 1.5rem;
  }

  .scroll-prompt {
    top: 3rem;
    font-size: 0.875rem;
  }

  .logo-description {
    bottom: 12vh;
  }

  .logo-description__text {
    font-size: 1rem;
  }

  .bottom-hud {
    bottom: 1.5rem;
    left: 1.5rem;
  }

  .sphere-control {
    width: 80px;
    height: 80px;
  }
}
</style>
