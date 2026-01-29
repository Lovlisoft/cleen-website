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
import PillWithCircle from './PillWithCircle.vue'
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
const isTransitioning = ref(false)
const isSphereInCenter = ref(false)
const currentSceneState = ref('scene1') // 'scene1' | 'scene2' | 'scene3' | 'transitioning'
/** Índice de la escena cuyo contenido debe mostrarse (evita mostrar varias escenas a la vez durante transiciones) */
const displayedSceneIndex = ref(0)
const greenTransitionLayerRef = ref(null) // Layer verde de transición entre escenas

// Menu refs
const isMenuOpen = ref(false)
const menuIconRef = ref(null)
const menuTextRef = ref(null)
const benefitsButtonRef = ref(null)
const aboutButtonRef = ref(null)
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
const pill3DRef = ref(null) // Pastilla central (para transiciones escena 1-2)
const centerPillWithCircleRef = ref(null) // Pastilla central con círculo (escena 3)
const leftPill3DRef = ref(null) // Pastilla izquierda con círculo (escena 3)
const rightPill3DRef = ref(null) // Pastilla derecha con círculo (escena 3)
const scene2ParticleLayerRef = ref(null)
const centerParticleLayerRef = ref(null)
const centerParticleRef = ref(null) // Ref directo al componente CenterParticle
const circularTextLayerRef = ref(null)
const scene2GrabAreaRef = ref(null)
const scene2LeftTextRef = ref(null)
const scene2RightBoxesRef = ref(null)
const sceneViewportRef = ref(null) // Wrapper para animación zoom+blur en transición 2→3
const scene3ContentRef = ref(null)

// Parallax drag state
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragLastPos = ref({ x: 0, y: 0 })
const parallaxOffset = ref({ x: 0, y: 0 })

// Scene 1: bring description text in front while dragging up
const scene1IsDragging = ref(false)
const scene1DragStartY = ref(0)
const scene1DescriptionInFront = ref(false)
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

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const animateMenuOpen = () => {
  if (menuAnimationTween) {
    menuAnimationTween.kill()
  }

  const menuIcon = menuIconRef.value
  const menuText = menuTextRef.value
  const benefitsButton = benefitsButtonRef.value
  const aboutButton = aboutButtonRef.value

  if (!menuIcon || !menuText) return

  menuAnimationTween = gsap.timeline()

  // 1. El icono de menú se oculta y aparece la X
  menuAnimationTween.to(menuIcon, {
    opacity: 0,
    scale: 0.8,
    duration: 0.2,
    ease: 'power2.in'
  }, 0)

  // 2. Mostrar la X después de ocultar el ícono de menú
  menuAnimationTween.set(menuIcon, { 
    innerHTML: '<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="40" fill="#1B4544"/><path d="M28 28L52 52M52 28L28 52" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>'
  }, 0.2)

  menuAnimationTween.to(menuIcon, {
    opacity: 1,
    scale: 1,
    duration: 0.2,
    ease: 'power2.out'
  }, 0.2)

  // 3. El texto "menu" cambia a "Download App"
  menuAnimationTween.to(menuText, {
    opacity: 0,
    duration: 0.15,
    ease: 'power2.in'
  }, 0)

  menuAnimationTween.set(menuText, { 
    textContent: 'Download App'
  }, 0.15)

  menuAnimationTween.to(menuText, {
    opacity: 1,
    duration: 0.15,
    ease: 'power2.out'
  }, 0.15)

  // 4. Botones Benefits y About aparecen expandiéndose desde width 0
  if (benefitsButton && aboutButton) {
    menuAnimationTween.fromTo(benefitsButton,
      {
        width: 0,
        opacity: 0,
        paddingLeft: 0,
        paddingRight: 0
      },
      {
        width: 'auto',
        opacity: 1,
        paddingLeft: '2.5rem',
        paddingRight: '2.5rem',
        duration: 0.4,
        ease: 'power2.out'
      },
      0.2
    )

    menuAnimationTween.fromTo(aboutButton,
      {
        width: 0,
        opacity: 0,
        paddingLeft: 0,
        paddingRight: 0
      },
      {
        width: 'auto',
        opacity: 1,
        paddingLeft: '2rem',
        paddingRight: '2rem',
        duration: 0.4,
        ease: 'power2.out'
      },
      0.35
    )
  }
}

const animateMenuClose = () => {
  if (menuAnimationTween) {
    menuAnimationTween.kill()
  }

  const menuIcon = menuIconRef.value
  const menuText = menuTextRef.value
  const benefitsButton = benefitsButtonRef.value
  const aboutButton = aboutButtonRef.value

  if (!menuIcon || !menuText) return

  menuAnimationTween = gsap.timeline()

  // 1. Ocultar botones Benefits y About colapsando su width
  if (benefitsButton && aboutButton) {
    menuAnimationTween.to(aboutButton, {
      width: 0,
      opacity: 0,
      paddingLeft: 0,
      paddingRight: 0,
      duration: 0.3,
      ease: 'power2.in'
    }, 0)
    
    menuAnimationTween.to(benefitsButton, {
      width: 0,
      opacity: 0,
      paddingLeft: 0,
      paddingRight: 0,
      duration: 0.3,
      ease: 'power2.in'
    }, 0.05)
  }

  // 2. Cambiar "Download App" de vuelta a "menu"
  menuAnimationTween.to(menuText, {
    opacity: 0,
    duration: 0.15,
    ease: 'power2.in'
  }, 0.15)

  menuAnimationTween.set(menuText, { 
    textContent: 'menu'
  }, 0.25)

  menuAnimationTween.to(menuText, {
    opacity: 1,
    duration: 0.15,
    ease: 'power2.out'
  }, 0.25)

  // 3. La X vuelve al ícono de menú
  menuAnimationTween.to(menuIcon, {
    opacity: 0,
    scale: 0.8,
    duration: 0.2,
    ease: 'power2.in'
  }, 0.2)

  menuAnimationTween.call(() => {
    if (menuIcon) {
      menuIcon.innerHTML = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" rx="14" fill="#1B4544"/>
        <rect x="25.5288" y="38.8538" width="28.9422" height="2.31111" rx="1.15556" fill="white"/>
        <rect x="25.5288" y="31.9023" width="28.9422" height="2.31111" rx="1.15556" fill="white"/>
        <rect x="25.5288" y="45.8047" width="28.9422" height="2.29333" rx="1.14667" fill="white"/>
      </svg>`
    }
  }, null, 0.4)

  menuAnimationTween.to(menuIcon, {
    opacity: 1,
    scale: 1,
    duration: 0.2,
    ease: 'power2.out'
  }, 0.4)
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

  // Reset viewport por si venimos de escena 3 (tenía scale + blur)
  if (sceneViewportRef.value) {
    gsap.set(sceneViewportRef.value, { scale: 1, filter: 'blur(0px)' })
  }
  
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
 * Si vamos a escena 3: escena se aleja y desenfoca + layer verde aparece.
 * Si volvemos a escena 1: contenido desaparece, pill central 3D crece, layer verde aparece.
 */
const scene2_exit = async (transitionData = {}) => {
  const { toScene } = transitionData

  // Transición 2 → 3: alejamiento + desenfoque de la escena + layer verde
  if (toScene === 2) {
    const fadePromise = fadeOutUIElements()
    const viewport = sceneViewportRef.value
    const greenLayerPromise = new Promise(resolve => {
      if (greenTransitionLayerRef.value) {
        gsap.to(greenTransitionLayerRef.value, {
          opacity: 1,
          duration: ANIMATION_DURATION * 0.7,
          ease: 'power2.in',
          onComplete: resolve
        })
      } else {
        resolve()
      }
    })
    const viewportPromise = viewport
      ? gsap.to(viewport, {
          scale: 0.85,
          filter: 'blur(20px)',
          duration: ANIMATION_DURATION * 0.7,
          ease: 'power2.in',
          onComplete: () => {}
        })
      : Promise.resolve()
    await Promise.all([fadePromise, greenLayerPromise, viewportPromise])
    return {}
  }

  // Transición 2 → 1: comportamiento original (pill 3D + layer verde)
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

/**
 * ESCENA 3: Animación de entrada
 * Conectada al layer verde de la salida de escena 2:
 * - El layer verde hace fade out
 * - La pastilla 3D hace fade in en super zoom (cubre toda la pantalla)
 * - La pastilla se aleja hasta quedar centrada con rotación flotante pseudo-aleatoria
 * - Cuando la pastilla queda al centro, se considera finalizada la animación de entrada
 */
const scene3_enter = async (transitionData = {}) => {
  const viewport = sceneViewportRef.value
  if (viewport) {
    gsap.set(viewport, { scale: 1, filter: 'blur(0px)' })
  }

  const centerPill = centerPillWithCircleRef.value
  const leftPill = leftPill3DRef.value
  const rightPill = rightPill3DRef.value
  const fadeInDuration = 1
  const toCenterDuration = 2.4

  // Empezar con pantalla verde (la misma con la que cierra la escena 2)
  if (greenTransitionLayerRef.value) {
    gsap.set(greenTransitionLayerRef.value, { opacity: 1 })
  }

  // Pastilla central a pantalla completa e invisible; luego fade in (verde sigue visible)
  if (centerPill) {
    centerPill.setScaleFullScreen()
    centerPill.setOpacity(0)
    centerPill.setTargetPosition(0, -0.20, 0) // Centro bajado 20% hacia abajo
  }

  // Calcular posiciones: más arriba que la central (45% izquierda, 40% derecha)
  // Separación aumentada 30%: -1.2 * 1.3 = -1.56, 1.2 * 1.3 = 1.56
  // Todo el bloque bajado 20% hacia abajo
  const leftOffsetX = -1.56 // A la izquierda (30% más separada)
  const rightOffsetX = 1.56 // A la derecha (30% más separada)
  const centerOffsetY = -0.20 // Centro bajado 20% hacia abajo
  const leftOffsetY = 0.45 + centerOffsetY // 25% más arriba que el centro (45% - 20%)
  const rightOffsetY = 0.40 + centerOffsetY // 20% más arriba que el centro (40% - 20%)

  // Preparar pastillas laterales (configurar pero no animar aún)
  if (leftPill) {
    leftPill.setScaleFullScreen()
    leftPill.setOpacity(0)
    leftPill.setTargetPosition(leftOffsetX, leftOffsetY, 0)
  }
  if (rightPill) {
    rightPill.setScaleFullScreen()
    rightPill.setOpacity(0)
    rightPill.setTargetPosition(rightOffsetX, rightOffsetY, 0)
  }

  // Pastilla central: fade in (inicia inmediatamente)
  const centerFadeInPromise = centerPill ? centerPill.animateFadeIn(fadeInDuration) : Promise.resolve()

  // Pastilla central: zoom out después del fade in (el círculo aparece automáticamente después)
  const pillToCenterPromise = centerFadeInPromise.then(() => {
    return centerPill ? centerPill.animateToCenterWithRotation(toCenterDuration) : Promise.resolve()
  })

  // Conforme la pastilla central hace zoom out, el layer verde hace fade out (en paralelo)
  // El fade out del verde debe empezar cuando empieza el zoom out (después del fade in)
  const greenFadeOutPromise = centerFadeInPromise.then(() => {
    return greenTransitionLayerRef.value
      ? gsap.to(greenTransitionLayerRef.value, {
          opacity: 0,
          duration: toCenterDuration,
          ease: 'power2.out'
        })
      : Promise.resolve()
  })

  // Pastillas laterales empiezan 500ms después de la central
  // y con separación proporcional entre ellas
  const sidePillsDelay = 500 // 500ms después del inicio del fade in de la central
  const sidePillsGap = 195 // Separación proporcional entre las dos laterales
  
  // Pastilla izquierda: empieza 500ms después del INICIO del fade in de la central
  // IMPORTANTE: Iniciar la promesa inmediatamente, pero con delay interno
  const leftPillPromise = leftPill
    ? new Promise((resolve) => {
        // Usar setTimeout para iniciar el delay inmediatamente (no await bloqueante)
        setTimeout(async () => {
          // Fade in primero
          await leftPill.animateFadeIn(fadeInDuration)
          // Luego zoom out (en secuencia, no en paralelo)
          await leftPill.animateToCenterWithRotation(toCenterDuration)
          resolve()
        }, sidePillsDelay)
      })
    : Promise.resolve()

  // Pastilla derecha: empieza 195ms después de la izquierda (695ms desde el inicio)
  const rightPillPromise = rightPill
    ? new Promise((resolve) => {
        // Usar setTimeout para iniciar el delay inmediatamente (no await bloqueante)
        setTimeout(async () => {
          // Fade in primero
          await rightPill.animateFadeIn(fadeInDuration)
          // Luego zoom out (en secuencia, no en paralelo)
          await rightPill.animateToCenterWithRotation(toCenterDuration)
          resolve()
        }, sidePillsDelay + sidePillsGap)
      })
    : Promise.resolve()

  // Ejecutar todo en paralelo: central + verde + laterales (con sus delays desde el inicio)
  // Los círculos de texto ahora están integrados en Pill3D y aparecen automáticamente
  await Promise.all([
    centerFadeInPromise, 
    greenFadeOutPromise, 
    pillToCenterPromise, 
    leftPillPromise, 
    rightPillPromise
  ])

}

/**
 * ESCENA 3: Animación de salida
 * Contenido y pastilla desaparecen, layer verde aparece
 */
const scene3_exit = async (transitionData = {}) => {
  const centerPill = centerPillWithCircleRef.value
  const leftPill = leftPill3DRef.value
  const rightPill = rightPill3DRef.value

  if (centerPill) {
    centerPill.stopFloatingRotation()
    centerPill.setOpacity(0)
    centerPill.reset()
  }
  if (leftPill) {
    leftPill.stopFloatingRotation()
    leftPill.setOpacity(0)
    leftPill.reset()
  }
  if (rightPill) {
    rightPill.stopFloatingRotation()
    rightPill.setOpacity(0)
    rightPill.reset()
  }

  const greenLayerPromise = greenTransitionLayerRef.value
    ? gsap.to(greenTransitionLayerRef.value, {
        opacity: 1,
        duration: ANIMATION_DURATION * 0.4,
        ease: 'power2.in'
      })
    : Promise.resolve()

  await greenLayerPromise
  return {}
}

// ==================== REVERSIBLE HELPERS (rewind = misma animación en sentido opuesto) ====================

/** Escena 2 ENTRADA en reversa: mismo keyframes que scene2_enter pero en sentido opuesto (2→1 rewind) */
const runScene2EnterReversed = async (transitionData = {}) => {
  const pill3D = pill3DRef.value
  if (sceneViewportRef.value) {
    gsap.set(sceneViewportRef.value, { scale: 1, filter: 'blur(0px)' })
  }

  // 1. Salida de textos en orden inverso al de entrada (circular → right → left)
  const circularOut = circularTextLayerRef.value
    ? gsap.to(circularTextLayerRef.value, { opacity: 0, filter: 'blur(20px)', duration: 0.8, ease: 'power2.in' })
    : Promise.resolve()
  await circularOut
  const rightOut = scene2RightBoxesRef.value
    ? gsap.to(scene2RightBoxesRef.value, { opacity: 0, filter: 'blur(20px)', duration: 0.8, ease: 'power2.in' })
    : Promise.resolve()
  await rightOut
  const leftOut = scene2LeftTextRef.value
    ? gsap.to(scene2LeftTextRef.value, { opacity: 0, filter: 'blur(20px)', duration: 0.8, ease: 'power2.in' })
    : Promise.resolve()
  await leftOut

  // 2. Pill 3D crece (inverso de shrink)
  if (pill3D) {
    pill3D.reset()
    await pill3D.animateGrow(ANIMATION_DURATION * 0.8)
  }

  // 3. Verde aparece; particle y center particle zoom-out y desaparecen (inverso de entrada)
  const greenIn = greenTransitionLayerRef.value
    ? gsap.to(greenTransitionLayerRef.value, { opacity: 1, duration: 1.2, ease: 'power2.in' })
    : Promise.resolve()
  const particleOut = scene2ParticleLayerRef.value
    ? gsap.to(scene2ParticleLayerRef.value, { opacity: 0, scale: 1.5, duration: 2.4, ease: 'power2.in' })
    : Promise.resolve()
  const centerOut = centerParticleLayerRef.value
    ? gsap.to(centerParticleLayerRef.value, {
        opacity: 0,
        scale: 10,
        filter: 'blur(50px)',
        duration: 2.4,
        ease: 'power2.in'
      })
    : Promise.resolve()
  await Promise.all([greenIn, particleOut, centerOut])
  return { usePill3D: true }
}

/** Escena 2 SALIDA en reversa: mismo keyframes que scene2_exit (2→1) pero en sentido opuesto (3→2 rewind) */
const runScene2ExitReversed = async () => {
  if (sceneViewportRef.value) {
    gsap.set(sceneViewportRef.value, { scale: 1, filter: 'blur(0px)' })
  }
  const greenOut = greenTransitionLayerRef.value
    ? gsap.to(greenTransitionLayerRef.value, { opacity: 0, duration: 1.2, ease: 'power2.out' })
    : Promise.resolve()
  const particleIn = scene2ParticleLayerRef.value
    ? gsap.fromTo(
        scene2ParticleLayerRef.value,
        { opacity: 0, scale: 1.5 },
        { opacity: 0.8, scale: 1, duration: 2.4, ease: 'power2.out' }
      )
    : Promise.resolve()
  const centerIn = centerParticleLayerRef.value
    ? gsap.fromTo(
        centerParticleLayerRef.value,
        { opacity: 0, scale: 10, filter: 'blur(50px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 2.4, ease: 'power2.out' }
      )
    : Promise.resolve()
  await Promise.all([greenOut, particleIn, centerIn])
  const pill3D = pill3DRef.value
  if (pill3D) {
    await pill3D.animateShrink(0.8)
  }
  const leftIn = scene2LeftTextRef.value
    ? gsap.fromTo(
        scene2LeftTextRef.value,
        { opacity: 0, filter: 'blur(20px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power2.out' }
      )
    : Promise.resolve()
  await leftIn
  const rightIn = scene2RightBoxesRef.value
    ? gsap.fromTo(
        scene2RightBoxesRef.value,
        { opacity: 0, filter: 'blur(20px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power2.out' }
      )
    : Promise.resolve()
  await rightIn
  const circularIn = circularTextLayerRef.value
    ? gsap.fromTo(
        circularTextLayerRef.value,
        { opacity: 0, filter: 'blur(20px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power2.out' }
      )
    : Promise.resolve()
  await circularIn
}

/** Escena 3 SALIDA en reversa: mismo keyframes que scene3_exit pero en sentido opuesto (reveal scene 3) */
const runScene3ExitReversed = async () => {
  const viewport = sceneViewportRef.value
  if (viewport) {
    gsap.set(viewport, { scale: 1, filter: 'blur(0px)' })
  }
  const greenOut = greenTransitionLayerRef.value
    ? gsap.to(greenTransitionLayerRef.value, { opacity: 0, duration: ANIMATION_DURATION * 0.4, ease: 'power2.out' })
    : Promise.resolve()
  await greenOut
}

/** Escena 3 ENTRADA en reversa: mismo keyframes que scene3_enter pero en sentido opuesto */
const runScene3EnterReversed = async () => {
  const centerPill = centerPillWithCircleRef.value
  const leftPill = leftPill3DRef.value
  const rightPill = rightPill3DRef.value
  
  // Ocultar pastillas laterales primero (en orden inverso)
  // Los círculos de texto están integrados en PillWithCircle y desaparecen automáticamente
  if (rightPill) {
    rightPill.stopFloatingRotation()
    rightPill.setOpacity(0)
    rightPill.reset()
  }
  if (leftPill) {
    leftPill.stopFloatingRotation()
    leftPill.setOpacity(0)
    leftPill.reset()
  }
  if (centerPill) {
    centerPill.stopFloatingRotation()
    centerPill.setOpacity(0)
    centerPill.reset()
  }
  
  const greenIn = greenTransitionLayerRef.value
    ? gsap.to(greenTransitionLayerRef.value, { opacity: 1, duration: ANIMATION_DURATION * 0.4, ease: 'power2.in' })
    : Promise.resolve()
  await greenIn
}

// ==================== REVERSED SCENE ANIMATIONS (rewind) ====================
// Contrato: enterReversed = exit en reversa, exitReversed = enter en reversa.

/** Escena 1: entrada en reversa = salida de escena 1 en reversa (reveal scene 1) */
const scene1_enterReversed = async (transitionData = {}) => {
  return scene1_enter({ ...transitionData, reverse: true })
}

/** Escena 1: salida en reversa = entrada de escena 1 en reversa (solo si hubiera escena 0) */
const scene1_exitReversed = async () => {
  return Promise.resolve({})
}

/** Escena 2: entrada en reversa = salida de escena 2 en reversa (usado al volver de escena 3 a 2) */
const scene2_enterReversed = async (transitionData = {}) => {
  return runScene2ExitReversed(transitionData)
}

/** Escena 2: salida en reversa = entrada de escena 2 en reversa (rewind al volver de 2 a 1) */
const scene2_exitReversed = async (transitionData = {}) => {
  return runScene2EnterReversed(transitionData)
}

/** Escena 3: entrada en reversa = salida de escena 3 en reversa (al volver de 3 a 2) */
const scene3_enterReversed = async (transitionData = {}) => {
  return runScene3ExitReversed(transitionData)
}

/** Escena 3: salida en reversa = entrada de escena 3 en reversa */
const scene3_exitReversed = async () => {
  return runScene3EnterReversed()
}

// ==================== SCENE ANIMATION CONFIGURATION ====================

/**
 * PARADIGMA DE TRANSICIONES REVERSIBLES (rewind)
 *
 * Regla: las animaciones entre escenas funcionan igual hacia adelante y en reversa.
 * Cuando el usuario vuelve a la escena anterior (ej: 2 → 1), las animaciones son
 * las mismas que al ir hacia adelante pero en sentido opuesto (rewind).
 *
 * - Al SALIR de una escena yendo hacia atrás: la animación de salida es la de
 *   ENTRADA de esa escena pero en reversa (exitReversed = enter en reversa).
 * - Al ENTRAR en una escena yendo hacia atrás: la animación de entrada es la de
 *   SALIDA de esa escena pero en reversa (enterReversed = exit en reversa).
 *
 * Contrato por escena:
 * - enter(transitionData): animación de entrada (forward).
 * - exit(transitionData): animación de salida (forward).
 * - enterReversed(transitionData): debe ser exactamente exit() en reversa (para entrar yendo atrás).
 * - exitReversed(transitionData): debe ser exactamente enter() en reversa (para salir yendo atrás).
 *
 * Al añadir nuevas escenas, implementar enter/exit y sus reversos (p. ej. con timelines
 * donde exit = enter.reversed()) para respetar este paradigma.
 */
const SCENE_ANIMATIONS = {
  0: { // Escena 1
    enter: scene1_enter,
    exit: scene1_exit,
    enterReversed: scene1_enterReversed,
    exitReversed: scene1_exitReversed
  },
  1: { // Escena 2
    enter: scene2_enter,
    exit: scene2_exit,
    enterReversed: scene2_enterReversed,
    exitReversed: scene2_exitReversed
  },
  2: { // Escena 3
    enter: scene3_enter,
    exit: scene3_exit,
    enterReversed: scene3_enterReversed,
    exitReversed: scene3_exitReversed
  }
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
  displayedSceneIndex.value = fromScene // Mostrar solo contenido de la escena que sale
  
  let transitionData = {}
  
  const isBackward = direction === 'backward'

  try {
    // 1. Animación de SALIDA de la escena actual
    // Backward: salida = entrada en reversa (rewind de la entrada)
    const exitFn = isBackward ? SCENE_ANIMATIONS[fromScene].exitReversed : SCENE_ANIMATIONS[fromScene].exit
    const exitData = await exitFn({
      direction,
      reverse: isBackward,
      toScene
    })

    if (exitData && typeof exitData === 'object') {
      transitionData = { ...transitionData, ...exitData }
    }

    // 2. Cambiar frame del video
    await changeVideoFrame(toScene)
    displayedSceneIndex.value = toScene
    await nextTick()

    // 3. Animación de ENTRADA de la escena nueva
    // Backward: entrada = salida en reversa (rewind de la salida)
    const enterFn = isBackward ? SCENE_ANIMATIONS[toScene].enterReversed : SCENE_ANIMATIONS[toScene].enter
    await enterFn({
      ...transitionData,
      direction,
      reverse: isBackward
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
      displayedSceneIndex.value = newIndex
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

const handleScene1DragStart = (event) => {
  if (displayedSceneIndex.value !== 0) return
  scene1IsDragging.value = true
  scene1DescriptionInFront.value = false

  const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0
  scene1DragStartY.value = clientY
}

const handleScene1DragMove = (event) => {
  if (!scene1IsDragging.value || displayedSceneIndex.value !== 0) return

  const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0
  const deltaY = clientY - scene1DragStartY.value

  // Dragging up => negative deltaY
  if (deltaY < -8) {
    scene1DescriptionInFront.value = true
  } else if (deltaY > 8) {
    scene1DescriptionInFront.value = false
  }
}

const handleScene1DragEnd = () => {
  if (!scene1IsDragging.value) return
  scene1IsDragging.value = false
  scene1DescriptionInFront.value = false
  scene1DragStartY.value = 0
}

const handleScene3PointerDown = (event) => {
  // Solo en escena 3 activa
  if (displayedSceneIndex.value !== 2) return

  const clientX = event.clientX ?? event.touches?.[0]?.clientX
  const clientY = event.clientY ?? event.touches?.[0]?.clientY
  if (clientX == null || clientY == null) return

  // Prioridad: la pastilla que realmente fue clickeada (raycast por instancia)
  const candidates = [
    centerPillWithCircleRef.value,
    leftPill3DRef.value,
    rightPill3DRef.value
  ].filter(Boolean)

  for (const pill of candidates) {
    if (pill?.hitTest?.(clientX, clientY)) {
      // Iniciar drag en esa pastilla y evitar scroll/gestos
      pill.beginDrag?.(clientX, clientY)
      event.preventDefault?.()
      return
    }
  }
}

const handleScene3HoverMove = (event) => {
  if (displayedSceneIndex.value !== 2) {
    document.body.style.cursor = ''
    centerPillWithCircleRef.value?.setHover?.(false)
    leftPill3DRef.value?.setHover?.(false)
    rightPill3DRef.value?.setHover?.(false)
    return
  }

  const clientX = event.clientX
  const clientY = event.clientY
  if (clientX == null || clientY == null) return

  const pills = [
    centerPillWithCircleRef.value,
    leftPill3DRef.value,
    rightPill3DRef.value
  ]

  let hovered = null
  for (const pill of pills) {
    if (pill?.hitTest?.(clientX, clientY)) {
      hovered = pill
      break
    }
  }

  for (const pill of pills) {
    pill?.setHover?.(pill === hovered)
  }

  document.body.style.cursor = hovered ? 'pointer' : ''
}

const handleScene3Click = (event) => {
  if (displayedSceneIndex.value !== 2) return

  const clientX = event.clientX
  const clientY = event.clientY
  if (clientX == null || clientY == null) return

  const pills = [
    centerPillWithCircleRef.value,
    leftPill3DRef.value,
    rightPill3DRef.value
  ].filter(Boolean)

  for (const pill of pills) {
    if (pill?.hitTest?.(clientX, clientY)) {
      // Boost de ~3s, fuerte al inicio y decae
      pill.triggerSpinBoost?.(3, 3.5)
      return
    }
  }
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
  
  // Setup parallax drag listeners
  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
  window.addEventListener('touchmove', handleDragMove)
  window.addEventListener('touchend', handleDragEnd)

  // Scene 1 drag listeners (for z-index behavior)
  window.addEventListener('mousemove', handleScene1DragMove)
  window.addEventListener('mouseup', handleScene1DragEnd)
  window.addEventListener('touchmove', handleScene1DragMove)
  window.addEventListener('touchend', handleScene1DragEnd)

  // Scene 3: global pointerdown for pill hit-test (avoid blocking UI)
  // Hover behavior (scene 3)
  window.addEventListener('mousemove', handleScene3HoverMove)
  window.addEventListener('click', handleScene3Click)
  
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

  // Remove scene 1 drag listeners
  window.removeEventListener('mousemove', handleScene1DragMove)
  window.removeEventListener('mouseup', handleScene1DragEnd)
  window.removeEventListener('touchmove', handleScene1DragMove)
  window.removeEventListener('touchend', handleScene1DragEnd)

  // (pointerdown removed; hover handles interaction now)
  window.removeEventListener('mousemove', handleScene3HoverMove)
  window.removeEventListener('click', handleScene3Click)
})
</script>

<template>
  <div class="video-scene" ref="containerRef">
    <!-- Wrapper para animación de alejamiento + desenfoque en transición 2→3 -->
    <div ref="sceneViewportRef" class="scene-viewport">
      <!-- Video layer (canvas) - separate layer -->
      <div class="video-layer" :class="{ 'video-layer--hidden': hideVideo }">
        <canvas ref="canvasRef" class="video-layer__canvas"></canvas>
      </div>

      <!-- Overlay layer (UI content) - separate layer -->
      <div class="video-overlay">
      <!-- Scene-specific content -->
      <div ref="sceneContentRef" class="scene-content">
        <!-- Escena 1 content - solo visible cuando la escena mostrada es la 1 -->
        <template v-if="displayedSceneIndex === 0">
          <div ref="scene1ContentRef">
            <!-- Floating pills behind logo -->
            <FloatingPills 
              ref="floatingPillsRef"
              :active="displayedSceneIndex === 0" 
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
                @mousedown="handleScene1DragStart"
                @touchstart="handleScene1DragStart"
              >
                <Logo3D 
                  ref="logo3DRef"
                  :is-loading="props.isLoading" 
                  :active="displayedSceneIndex === 0"
                />
        </div>

              <!-- Text below logo -->
              <div class="logo-description" :class="{ 'logo-description--front': scene1DescriptionInFront }">
                <p class="logo-description__text">
                  <strong>GUUD</strong> is the most effective method for weight<br />
                  and body fat reduction, developed.
                </p>
              </div>
            </div>

          </div>
        </template>

        <!-- Escena 2 content - solo visible cuando la escena mostrada es la 2 -->
        <template v-if="displayedSceneIndex === 1">
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
      <div class="menu-cluster">
        <button @click="toggleMenu" class="menu-cluster__button" aria-label="Menu">
          <div ref="menuIconRef" class="menu-cluster__icon" v-html="`<svg width='80' height='80' viewBox='0 0 80 80' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <rect width='80' height='80' rx='14' fill='#1B4544'/>
            <rect x='25.5288' y='38.8538' width='28.9422' height='2.31111' rx='1.15556' fill='white'/>
            <rect x='25.5288' y='31.9023' width='28.9422' height='2.31111' rx='1.15556' fill='white'/>
            <rect x='25.5288' y='45.8047' width='28.9422' height='2.29333' rx='1.14667' fill='white'/>
          </svg>`"></div>
          
          <div ref="benefitsButtonRef" class="menu-cluster__benefits-btn" :class="{ 'menu-cluster__benefits-btn--visible': isMenuOpen }">
            <span>Benefits</span>
          </div>
          
          <div ref="aboutButtonRef" class="menu-cluster__about-btn" :class="{ 'menu-cluster__about-btn--visible': isMenuOpen }">
            <span>about</span>
          </div>
          
          <div class="menu-cluster__pill">
            <span ref="menuTextRef" class="menu-cluster__text">menu</span>
          </div>
        </button>
      </div>
      
      <!-- Bottom HUD - always visible (audio control + sphere control for Scene 1) -->
      <div class="bottom-hud">
        <!-- Audio control - always visible -->
        <button class="audio-control" aria-label="Toggle audio">
          <img :src="audioIcon" alt="Audio control" />
        </button>
        
        <!-- Sphere control - only visible in Scene 1 -->
        <button 
          v-if="displayedSceneIndex === 0"
          @click="swapPositions"
          ref="sphereControlRef"
          class="sphere-control"
          :class="{ 'sphere-control--swapped': isSphereInCenter }"
          aria-label="Toggle 3D model"
        >
          <Sphere3D :active="true" />
        </button>
      </div>
      
      <!-- Bottom right menu controls -->
    </div>
    
    <!-- Scene 2 particle background layer - solo visible en escena 2 -->
    <div 
      v-if="displayedSceneIndex === 1" 
      ref="scene2ParticleLayerRef"
      class="scene2-particle-layer"
    >
      <ParticleBackground :active="displayedSceneIndex === 1" />
    </div>
    
    <!-- Center particle animation - solo visible en escena 2 -->
    <div 
      v-if="displayedSceneIndex === 1" 
      ref="centerParticleLayerRef"
      class="center-particle-layer"
    >
      <CenterParticle 
        ref="centerParticleRef"
        :active="displayedSceneIndex === 1" 
      />
        </div>

    <!-- Circular text - solo visible en escena 2 -->
    <div 
      v-if="displayedSceneIndex === 1" 
      ref="circularTextLayerRef"
      class="circular-text-layer"
    >
      <CircularText text="supports Healthy Fat Metabolism" />
        </div>
    </div>
    <!-- /scene-viewport -->
    
    <!-- Green transition layer - appears during scene transitions -->
    <div ref="greenTransitionLayerRef" class="green-transition-layer"></div>
    
    <!-- Center Pill 3D for transitions - always mounted -->
    <Pill3D 
      v-if="displayedSceneIndex !== 2"
      ref="pill3DRef" 
      :interactive="false"
      pill-id="center"
    />
    <!-- Center Pill with Circle for scene 3 -->
    <PillWithCircle 
      v-if="displayedSceneIndex === 2 || currentSceneState === 'transitioning'"
      :key="'scene3-center'"
      ref="centerPillWithCircleRef"
      :interactive="displayedSceneIndex === 2"
      :active="displayedSceneIndex === 2"
      pill-id="center"
      circular-text="Wellness Ecosystem"
    />
    
    <!-- Side Pills 3D for scene 3 - only visible in scene 3 -->
    <PillWithCircle 
      v-if="displayedSceneIndex === 2 || currentSceneState === 'transitioning'" 
      :key="'scene3-left'"
      ref="leftPill3DRef"
      :interactive="displayedSceneIndex === 2"
      :active="displayedSceneIndex === 2"
      pill-id="left"
      circular-text="About Us"
    />
    <PillWithCircle 
      v-if="displayedSceneIndex === 2 || currentSceneState === 'transitioning'" 
      :key="'scene3-right'"
      ref="rightPill3DRef"
      :interactive="displayedSceneIndex === 2"
      :active="displayedSceneIndex === 2"
      pill-id="right"
      circular-text="Studies"
    />
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

/* Wrapper para animación zoom + blur en transición 2→3 */
.scene-viewport {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform-origin: center center;
  will-change: transform, filter;
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
  top: 5rem;
  left: 5rem;
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
  margin-top: 1.25rem;
}

.brand-cluster__meta p {
  font-size: 0.875rem;
  color: #1B4544;
  margin: 0;
  line-height: 1.3;
  font-weight: 400;
  font-family: 'Exo 2', sans-serif;
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
  left: 8rem;
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
  right: 8rem;
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
    left: 4rem;
    font-size: 0.75rem;
    max-width: 200px;
  }
  
  .scene2-right-boxes {
    right: 4rem;
  }
  
  .benefit-box {
    font-size: 0.75rem;
    padding: 0.75rem 1rem;
  }
}

@media (max-width: 480px) {
  .scene2-left-text {
    left: 2rem;
    font-size: 0.625rem;
    max-width: 150px;
  }
  
  .scene2-right-boxes {
    right: 2rem;
    gap: 0.5rem;
  }
  
  .benefit-box {
    font-size: 0.625rem;
    padding: 0.5rem 0.75rem;
  }
  
  .brand-cluster {
    top: 2rem;
    left: 2rem;
  }
  
  .brand-cluster__logo {
    width: 80px;
  }
  
  .scroll-prompt {
    top: 2rem;
    padding: 0.875rem 2rem;
    border-radius: 24px;
  }
  
  .scroll-prompt__text {
    font-size: 0.875rem;
  }
  
  .logo-description {
    transform: translate(-50%, calc(50% + 1.5rem));
  }
  
  .logo-description__text {
    font-size: 0.875rem;
  }
  
  .bottom-hud {
    bottom: 2rem;
    left: 2rem;
  }
  
  .sphere-control {
    width: 82px;
    height: 82px;
  }
  
  .audio-control {
    width: 62px;
    height: 62px;
  }
  
  .audio-control img {
    width: 24px;
    height: 22px;
  }
  
  .menu-cluster {
    bottom: 2rem;
  }
  
  .menu-cluster__button {
    height: 62px;
    gap: 0;
  }
  
  .menu-cluster__icon {
    width: 62px;
    height: 62px;
  }
  
  .menu-cluster__benefits-btn {
    height: 62px;
    border-radius: 17px;
  }
  
  .menu-cluster__benefits-btn span {
    font-size: 1.125rem;
  }
  
  .menu-cluster__about-btn {
    height: 62px;
    border-radius: 17px;
  }
  
  .menu-cluster__about-btn span {
    font-size: 1.125rem;
  }
  
  .menu-cluster__pill {
    height: 62px;
    padding: 0 2rem 0 2rem;
    border-radius: 31px;
  }
  
  .menu-cluster__text {
    font-size: 1rem;
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
  border: 1.5px solid rgba(27, 69, 68, 0.8);
  border-radius: 15px;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

.scroll-prompt__text {
  font-size: 1.15rem;
  font-weight: 400;
  color: #1B4544;
  text-align: center;
  margin: 0;
  line-height: 1.25rem;
  letter-spacing: -0.01em;
}

/* Logo description text */
.logo-description {
  position: absolute;
  top: 55%;
  left: 50%;
  transform: translate(-50%, calc(50% + 3rem));
  z-index: 4;
  text-align: center;
  max-width: 90%;
}

.logo-description--front {
  z-index: 6; /* above .logo-3d-container (z-index: 5) */
}

.logo-description__text {
  font-size: 1.45rem;
  font-weight: 500;
  color: #0d1f16;
  text-align: center;
  margin: 0;
  line-height: 1.4;
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
  left: 5rem;
  bottom: 5rem;
  transform: translate(0, 0) scale(0.15);
  width: 400px;
  height: 400px;
}

/* Bottom HUD */
.bottom-hud {
  position: absolute;
  bottom: 5rem;
  left: 5rem;
  z-index: 20;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.25rem;
}

.bottom-hud > * {
  pointer-events: auto;
}

.sphere-control {
  width: 140px;
  height: 140px;
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
  bottom: 5rem;
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
  height: 73px;
  transition: transform 0.2s ease;
}

.menu-cluster__button:hover {
  transform: scale(1.02);
}

.menu-cluster__icon {
  width: 73px;
  height: 73px;
  z-index: 2;
  transition: all 0.3s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-cluster__benefits-btn {
  position: relative;
  height: 73px;
  background: #1B4544;
  border-radius: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  width: 0;
  overflow: hidden;
  pointer-events: none;
  flex-shrink: 0;
}

.menu-cluster__benefits-btn--visible {
  pointer-events: auto;
}

.menu-cluster__benefits-btn span {
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.menu-cluster__about-btn {
  position: relative;
  height: 73px;
  background: #1B4544;
  border-radius: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  width: 0;
  overflow: hidden;
  pointer-events: none;
  flex-shrink: 0;
}

.menu-cluster__about-btn--visible {
  pointer-events: auto;
}

.menu-cluster__about-btn span {
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.menu-cluster__pill {
  position: relative;
  height: 73px;
  background: #1B4544;
  border-radius: 36.5px;
  padding: 0 2.5rem 0 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.menu-cluster__text {
  color: #ffffff;
  font-size: 1.25rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* Audio control */
.audio-control {
  width: 73px;
  height: 73px;
  border: 2px solid #1B4544;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.audio-control:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.05);
}

.audio-control img {
  width: 30px;
  height: 28px;
}

@media (max-width: 768px) {
  .brand-cluster {
    top: 3rem;
    left: 3rem;
    gap: 0.5rem;
  }
  
  .brand-cluster__logo {
    width: 100px;
  }
  
  .brand-cluster__meta p {
    font-size: 0.75rem;
  }

  .menu-cluster {
    bottom: 3rem;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .menu-cluster__button {
    height: 62px;
    gap: 0;
  }
  
  .menu-cluster__icon {
    width: 62px;
    height: 62px;
  }
  
  .menu-cluster__benefits-btn {
    height: 62px;
    border-radius: 17px;
  }
  
  .menu-cluster__benefits-btn span {
    font-size: 1.25rem;
  }
  
  .menu-cluster__about-btn {
    height: 62px;
    border-radius: 17px;
  }
  
  .menu-cluster__about-btn span {
    font-size: 1.25rem;
  }
  
  .menu-cluster__pill {
    height: 62px;
    padding: 0 2rem 0 2rem;
    border-radius: 31px;
  }
  
  .menu-cluster__text {
    font-size: 1.125rem;
  }
  
  .audio-control {
    width: 62px;
    height: 62px;
  }

  .scroll-prompt {
    top: 3rem;
    padding: 1rem 2.25rem;
    border-radius: 28px;
  }
  
  .scroll-prompt__text {
    font-size: 1rem;
  }

  .logo-description {
    transform: translate(-50%, calc(50% + 2rem));
  }

  .logo-description__text {
    font-size: 1rem;
  }

  .bottom-hud {
    bottom: 3rem;
    left: 3rem;
  }

  .sphere-control {
    width: 95px;
    height: 95px;
  }
}
</style>
