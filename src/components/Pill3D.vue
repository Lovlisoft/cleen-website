<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import gsap from 'gsap'

const props = defineProps({
  interactive: {
    type: Boolean,
    default: false // Solo interactiva cuando está en escena 3
  },
  pillId: {
    type: String,
    default: 'center' // 'center', 'left', 'right' - para identificar qué pastilla es
  }
})

const canvasRef = ref(null)
const containerRef = ref(null)

let scene
let camera
let renderer
let animationFrameId
let pillMesh
let isRendering = false
let floatingRotationActive = false
let floatingRotationTime = 0
const FULL_SCREEN_SCALE_MULTIPLIER = 200 // escala "pantalla completa" respecto a centerScale

// Hover state (scene 3)
let ambientLight
let directionalLight
let directionalLight2
let isHovered = false
let lastHoverBaseScale = null
let hoverScaleTween = null
let hoverLightTween = null

// Rotación tipo "arrojada al vacío": velocidad angular continua en todos los ejes
let currentRotation = { x: 0, y: 0, z: 0 }
const BASE_SPEED = 1.2 // rad/s base (reducido 50% desde 2.4); sensación de tumble moderada
const WOBBLE_AMOUNT = 0.6 // variación de velocidad para que no sea uniforme
let rotationSpeedMultiplier = 1.0 // Multiplicador de velocidad (1.0 = normal, 1.5 = 50% más rápido)
let rotationBoostMultiplier = 1.0 // Boost temporal por click

// Mouse drag controls (similar a Logo3D)
let isDragging = false
let previousMousePosition = { x: 0, y: 0 }

const initThree = () => {
  const container = containerRef.value
  if (!container) return
  
  const { clientWidth, clientHeight } = container

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 100)
  camera.position.set(0, 0, 4)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(clientWidth, clientHeight)
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true

  // Iluminación desde arriba para generar sombras en caras inferiores
  ambientLight = new THREE.AmbientLight(0xffffff, 0.4) // Reducida para que las sombras sean más visibles
  
  // Luz principal desde arriba (justo arriba de las pastillas)
  directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
  directionalLight.position.set(0, 5, 2) // Justo arriba
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 50
  directionalLight.shadow.camera.left = -5
  directionalLight.shadow.camera.right = 5
  directionalLight.shadow.camera.top = 5
  directionalLight.shadow.camera.bottom = -5
  
  // Luz de relleno suave desde el frente (más tenue)
  directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
  directionalLight2.position.set(0, 1, 4)

  scene.add(ambientLight, directionalLight, directionalLight2)

  loadModel()
  window.addEventListener('resize', handleResize)
}

const setHover = (hovered) => {
  if (!pillMesh) return
  if (isHovered === hovered) return
  isHovered = hovered

  // Scale +15% on hover (relative to current scale when hover starts)
  // Detener cualquier tween activo que pueda estar modificando el scale
  if (hoverScaleTween) hoverScaleTween.kill()
  
  // Obtener el scale actual (después de detener tweens, debería ser el scale real)
  const currentScaleX = pillMesh.scale.x
  const currentScaleY = pillMesh.scale.y
  const currentScaleZ = pillMesh.scale.z
  
  // Si el scale actual es muy diferente del centerScale esperado (más del 20% de diferencia),
  // usar centerScale como referencia para evitar escalas exageradas
  const centerScale = pillMesh.userData.centerScale
  const scaleDiff = centerScale ? Math.abs(currentScaleX - centerScale) / centerScale : 0
  const baseScale = (centerScale && scaleDiff > 0.2) ? centerScale : currentScaleX
  
  if (hovered) {
    // Guardar el scale base actual para poder restaurarlo después
    lastHoverBaseScale = {
      x: baseScale,
      y: baseScale,
      z: baseScale
    }
    hoverScaleTween = gsap.to(pillMesh.scale, {
      x: baseScale * 1.15,
      y: baseScale * 1.15,
      z: baseScale * 1.15,
      duration: 0.25,
      ease: 'power2.out'
    })
  } else if (lastHoverBaseScale) {
    hoverScaleTween = gsap.to(pillMesh.scale, {
      x: lastHoverBaseScale.x,
      y: lastHoverBaseScale.y,
      z: lastHoverBaseScale.z,
      duration: 0.25,
      ease: 'power2.out'
    })
  }

  // Lighting: move emphasis to front on hover
  if (hoverLightTween) hoverLightTween.kill()
  const tl = gsap.timeline()
  hoverLightTween = tl
  if (directionalLight2 && directionalLight) {
    if (hovered) {
      tl.to(directionalLight2, { intensity: 1.1, duration: 0.25, ease: 'power2.out' }, 0)
      tl.to(directionalLight2.position, { x: 0, y: 0.6, z: 5, duration: 0.25, ease: 'power2.out' }, 0)
      tl.to(directionalLight, { intensity: 0.6, duration: 0.25, ease: 'power2.out' }, 0)
      if (ambientLight) tl.to(ambientLight, { intensity: 0.55, duration: 0.25, ease: 'power2.out' }, 0)
    } else {
      tl.to(directionalLight2, { intensity: 0.3, duration: 0.25, ease: 'power2.out' }, 0)
      tl.to(directionalLight2.position, { x: 0, y: 1, z: 4, duration: 0.25, ease: 'power2.out' }, 0)
      tl.to(directionalLight, { intensity: 1.2, duration: 0.25, ease: 'power2.out' }, 0)
      if (ambientLight) tl.to(ambientLight, { intensity: 0.4, duration: 0.25, ease: 'power2.out' }, 0)
    }
  }
}

const loadModel = () => {
  const loader = new OBJLoader()
  loader.load(
    '/models/pastilla.obj',
    (object) => {
      // Calcular el centro del modelo para centrarlo
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      object.position.sub(center)

      // Calcular el tamaño para escalar apropiadamente (reducido 30% + 15% = 59.5% del tamaño original)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const baseScale = (1.5 / maxDim) * 0.7 * 0.85 // Reducir 30% (0.7) + 15% adicional (0.85) = 0.595
      object.userData.centerScale = baseScale

      object.userData.originalSize = size.clone()
      object.scale.set(baseScale, baseScale, baseScale)

      // Aplicar material tipo pastilla con reflejo moderado (no tan opaco)
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x00FF88,
            metalness: 0.25, // Ligera metalicidad para reflejos sutiles
            roughness: 0.65, // Menos mate, más reflectante (pero no brillante)
            emissive: 0x00FF88,
            emissiveIntensity: 0.1, // Emisión moderada
            transparent: true,
            opacity: 1
          })
          child.castShadow = true // La pastilla proyecta sombras
          child.receiveShadow = true // La pastilla recibe sombras
        }
      })

      pillMesh = object
      // Iniciar invisible y pequeño
      pillMesh.scale.multiplyScalar(0.01)
      scene.add(pillMesh)

      // Añadir plano invisible debajo para recibir sombras (opcional, ayuda a visualizar sombras)
      // Comentado por ahora - las sombras se verán en las caras inferiores de las pastillas al girar
      // const shadowPlane = new THREE.PlaneGeometry(10, 10)
      // const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.2 })
      // const shadowMesh = new THREE.Mesh(shadowPlane, shadowMaterial)
      // shadowMesh.rotation.x = -Math.PI / 2
      // shadowMesh.position.y = -2
      // shadowMesh.receiveShadow = true
      // scene.add(shadowMesh)

      startRendering()
      setupMouseControls()
    },
    undefined,
    (error) => {
      console.error('Error loading pill model:', error)
    }
  )
}

const startRendering = () => {
  if (isRendering) return
  isRendering = true
  renderLoop()
}

const stopRendering = () => {
  isRendering = false
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

let lastTime = 0
const renderLoop = (time = 0) => {
  if (!isRendering) return
  animationFrameId = requestAnimationFrame(renderLoop)
  const delta = lastTime ? (time - lastTime) / 1000 : 0
  lastTime = time
  floatingRotationTime += delta
  if (floatingRotationActive && pillMesh) {
    updateFloatingRotation(delta)
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

/**
 * Rotación como si la pastilla fuera arrojada al vacío: gira en todos los sentidos
 * con velocidad angular continua (tumble). Velocidades distintas por eje + wobble.
 * Si el usuario está arrastrando, no aplica rotación automática.
 */
const updateFloatingRotation = (delta) => {
  if (isDragging || !pillMesh) return

  const t = floatingRotationTime
  const dt = Math.min(delta, 0.05)

  const wobbleX = Math.sin(t * 1.2) * WOBBLE_AMOUNT + Math.cos(t * 0.7) * WOBBLE_AMOUNT * 0.5
  const wobbleY = Math.sin(t * 0.9) * WOBBLE_AMOUNT + Math.cos(t * 1.4) * WOBBLE_AMOUNT * 0.5
  const wobbleZ = Math.sin(t * 1.5) * WOBBLE_AMOUNT + Math.cos(t * 0.8) * WOBBLE_AMOUNT * 0.5

  const speedBase = BASE_SPEED * rotationSpeedMultiplier * rotationBoostMultiplier
  const speedX = (speedBase * 0.9 + wobbleX) * dt
  const speedY = (speedBase * 1.1 + wobbleY) * dt
  const speedZ = (speedBase * 0.85 + wobbleZ) * dt

  currentRotation.x += speedX
  currentRotation.y += speedY
  currentRotation.z += speedZ

  pillMesh.rotation.x = currentRotation.x
  pillMesh.rotation.y = currentRotation.y
  pillMesh.rotation.z = currentRotation.z
}

const triggerSpinBoost = (durationSeconds = 3, peakMultiplier = 3.5) => {
  // Boost fuerte al inicio y decae a 1.0
  gsap.killTweensOf({ m: rotationBoostMultiplier })
  const proxy = { m: rotationBoostMultiplier }
  proxy.m = peakMultiplier
  rotationBoostMultiplier = peakMultiplier

  gsap.to(proxy, {
    m: 1.0,
    duration: durationSeconds,
    ease: 'power2.out',
    onUpdate: () => {
      rotationBoostMultiplier = proxy.m
    },
    onComplete: () => {
      rotationBoostMultiplier = 1.0
    }
  })
}

const handleResize = () => {
  if (!containerRef.value || !camera || !renderer) return

  const { clientWidth, clientHeight } = containerRef.value
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(clientWidth, clientHeight)
}

/**
 * Anima la aparición y crecimiento de la pastilla central
 * Con rotación durante el zoom in (50% más rápida que escena 3)
 * @param {number} duration - Duración de la animación en segundos
 * @returns {Promise}
 */
const animateGrow = (duration = 2) => {
  return new Promise((resolve) => {
    if (!pillMesh) {
      console.warn('⚠️ Pill mesh not loaded yet')
      resolve()
      return
    }

    // Iniciar rotación con velocidad 50% más rápida (1.5x) para escena 1
    rotationSpeedMultiplier = 1.5
    startFloatingRotation()

    const currentScale = pillMesh.scale.x
    // Escala masiva para llenar toda la pantalla
    const targetScale = currentScale * 20000
    
    gsap.to(pillMesh.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: duration,
      ease: 'power4.in', // Aceleración gradual
      onComplete: () => {
        // Mantener rotación después del zoom (para escena 1, la rotación continúa)
        resolve()
      }
    })
  })
}

/**
 * Anima la desaparición de la pastilla
 * @param {number} duration - Duración de la animación en segundos
 * @returns {Promise}
 */
const animateShrink = (duration = 0.8) => {
  return new Promise((resolve) => {
    if (!pillMesh) {
      resolve()
      return
    }

    // Detener rotación al empezar a desaparecer
    stopFloatingRotation()

    gsap.to(pillMesh.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: duration,
      ease: 'power2.in',
      onComplete: resolve
    })
  })
}

/**
 * Reinicia la escala de la pastilla a su estado inicial (invisible)
 */
const reset = () => {
  if (pillMesh) {
    gsap.set(pillMesh.scale, { x: 0.01, y: 0.01, z: 0.01 })
    gsap.set(pillMesh.position, { x: 0, y: 0, z: 0 })
    pillMesh.userData.targetPosition = { x: 0, y: 0, z: 0 }
  }
  stopFloatingRotation()
}

/** Obtener todos los materiales del mesh (para opacity) */
const getPillMaterials = () => {
  const mats = []
  if (pillMesh) {
    pillMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const m = child.material
        mats.push(Array.isArray(m) ? m : [m])
      }
    })
  }
  return mats.flat()
}

/**
 * Escena 3: coloca la pastilla a escala "pantalla completa" (super zoom)
 */
const setScaleFullScreen = () => {
  if (!pillMesh || pillMesh.userData.centerScale == null) return
  const centerScale = pillMesh.userData.centerScale
  const fullScale = centerScale * FULL_SCREEN_SCALE_MULTIPLIER
  gsap.set(pillMesh.scale, { x: fullScale, y: fullScale, z: fullScale })
}

/**
 * Escena 3: establecer opacidad del material (0 = invisible, 1 = visible)
 */
const setOpacity = (value) => {
  getPillMaterials().forEach((m) => {
    m.transparent = true
    m.opacity = value
  })
}

/**
 * Escena 3: fade in de la pastilla (mientras el layer verde hace fade out)
 */
const animateFadeIn = (duration = 1.2) => {
  return new Promise((resolve) => {
    const materials = getPillMaterials()
    if (!materials.length) {
      resolve()
      return
    }
    materials.forEach((m) => { m.transparent = true })
    const proxy = { opacity: 0 }
    gsap.to(proxy, {
      opacity: 1,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        materials.forEach((m) => { m.opacity = proxy.opacity })
      },
      onComplete: resolve
    })
  })
}

const startFloatingRotation = (speedMultiplier = 1.0) => {
  floatingRotationActive = true
  floatingRotationTime = 0
  rotationSpeedMultiplier = speedMultiplier
  // No resetear currentRotation - continuar desde donde está (puede tener rotación del usuario)
}

/**
 * Configurar controles de mouse para manipular la pastilla (similar a Logo3D)
 * Solo se activa cuando la pastilla es interactiva (escena 3)
 */
const hitTest = (clientX, clientY) => {
  if (!pillMesh || !camera || !containerRef.value) return false
  if (!props.interactive) return false

  const rect = containerRef.value.getBoundingClientRect()
  const mouse = new THREE.Vector2()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(pillMesh, true)
  return intersects.length > 0
}

const beginDrag = (clientX, clientY) => {
  if (!pillMesh || !floatingRotationActive || !props.interactive) return false
  isDragging = true
  previousMousePosition = { x: clientX, y: clientY }
  return true
}

const setupMouseControls = () => {
  if (!containerRef.value) return

  const onMouseMove = (event) => {
    if (!isDragging || !pillMesh) return

    const deltaX = event.clientX - previousMousePosition.x
    const deltaY = event.clientY - previousMousePosition.y

    // Convertir movimiento del mouse a rotación (similar a Logo3D)
    // Actualizar directamente la rotación del mesh y también currentRotation
    // para que cuando se suelte continúe desde ahí
    currentRotation.y += deltaX * 0.01
    currentRotation.x += deltaY * 0.01

    pillMesh.rotation.x = currentRotation.x
    pillMesh.rotation.y = currentRotation.y
    pillMesh.rotation.z = currentRotation.z

    previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    }
  }

  const onMouseUp = () => {
    if (!isDragging) return
    
    isDragging = false
    
    // Al soltar, la rotación automática continúa desde donde quedó
    // currentRotation ya tiene la rotación actual, así que updateFloatingRotation
    // continuará sumando desde ahí
  }

  const onMouseLeave = () => {
    if (isDragging) {
      isDragging = false
    }
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  containerRef.value.addEventListener('mouseleave', onMouseLeave)

  // Guardar funciones para limpiar
  containerRef.value._cleanupPillMouseControls = () => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('mouseleave', onMouseLeave)
    }
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
}

const stopFloatingRotation = () => {
  floatingRotationActive = false
  rotationSpeedMultiplier = 1.0 // Resetear a velocidad normal
}

/**
 * Establecer posición objetivo de la pastilla (en coordenadas 3D)
 */
const setTargetPosition = (x = 0, y = 0, z = 0) => {
  if (pillMesh) {
    pillMesh.userData.targetPosition = { x, y, z }
  }
}

/**
 * Escena 3: animar pastilla desde pantalla completa al centro (o posición objetivo) con rotación flotante.
 * La pastilla se aleja (zoom out) hasta quedar centrada; la rotación flotante es continua.
 */
const animateToCenterWithRotation = (duration = 2.2) => {
  return new Promise((resolve) => {
    if (!pillMesh || pillMesh.userData.centerScale == null) {
      resolve()
      return
    }
    const centerScale = pillMesh.userData.centerScale
    const targetPos = pillMesh.userData.targetPosition || { x: 0, y: 0, z: 0 }
    
    startFloatingRotation(1.0) // Velocidad normal para escena 3
    
    gsap.to(pillMesh.scale, {
      x: centerScale,
      y: centerScale,
      z: centerScale,
      duration,
      ease: 'power2.out'
    })
    
    gsap.to(pillMesh.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration,
      ease: 'power2.out',
      onComplete: () => {
        resolve()
      }
    })
  })
}

// Obtener la posición 3D actual de la pastilla proyectada a coordenadas de pantalla
const getScreenPosition = () => {
  if (!pillMesh || !camera) return null
  
  const worldPosition = new THREE.Vector3()
  pillMesh.getWorldPosition(worldPosition)
  
  // Proyectar coordenadas 3D a coordenadas de pantalla normalizadas (-1 a 1)
  const vector = worldPosition.project(camera)
  
  return {
    x: (vector.x * 0.5 + 0.5) * 100, // Convertir a porcentaje
    y: (vector.y * -0.5 + 0.5) * 100 // Invertir Y y convertir a porcentaje
  }
}

// Exponer métodos al padre
defineExpose({
  animateGrow,
  animateShrink,
  reset,
  setScaleFullScreen,
  setOpacity,
  animateFadeIn,
  animateToCenterWithRotation,
  setTargetPosition,
  startFloatingRotation,
  stopFloatingRotation,
  hitTest,
  beginDrag,
  setHover,
  triggerSpinBoost,
  getScreenPosition
})

onMounted(() => {
  initThree()
})

onBeforeUnmount(() => {
  stopRendering()
  window.removeEventListener('resize', handleResize)
  
  // Limpiar controles de mouse
  if (containerRef.value?._cleanupPillMouseControls) {
    containerRef.value._cleanupPillMouseControls()
  }
  
  if (renderer) {
    renderer.dispose()
  }
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose())
        } else {
          object.material.dispose()
        }
      }
    })
  }
})
</script>

<template>
  <div ref="containerRef" class="pill-3d" :class="{ interactive: props.interactive }">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.pill-3d {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none; /* Nunca bloquear UI; el drag se inicia por hit-test global */
  cursor: default;
}

.pill-3d canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
