<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import gsap from 'gsap'

const canvasRef = ref(null)
const containerRef = ref(null)

let scene
let camera
let renderer
let animationFrameId
let pillMesh
let isRendering = false

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
    alpha: true
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(clientWidth, clientHeight)
  renderer.setClearColor(0x000000, 0)

  // Iluminación brillante para la pastilla
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(2, 3, 4)
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight2.position.set(-2, -1, 2)
  
  const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.6)
  directionalLight3.position.set(0, 0, 5)

  scene.add(ambientLight, directionalLight, directionalLight2, directionalLight3)

  loadModel()
  window.addEventListener('resize', handleResize)
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

      // Calcular el tamaño para escalar apropiadamente
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const baseScale = 1.5 / maxDim
      
      object.userData.originalSize = size.clone()
      object.scale.set(baseScale, baseScale, baseScale)

      // Aplicar material con color vibrante (similar a las pastillas flotantes)
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x00FF88, // Verde brillante
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0x00FF88,
            emissiveIntensity: 0.2
          })
        }
      })

      pillMesh = object
      // Iniciar invisible y pequeño
      pillMesh.scale.multiplyScalar(0.01)
      scene.add(pillMesh)

      startRendering()
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

const renderLoop = () => {
  if (!isRendering) return
  animationFrameId = requestAnimationFrame(renderLoop)
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
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

    const currentScale = pillMesh.scale.x
    // Escala masiva para llenar toda la pantalla
    const targetScale = currentScale * 20000
    
    gsap.to(pillMesh.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: duration,
      ease: 'power4.in', // Aceleración gradual
      onComplete: resolve
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
  }
}

// Exponer métodos al padre
defineExpose({
  animateGrow,
  animateShrink,
  reset
})

onMounted(() => {
  initThree()
})

onBeforeUnmount(() => {
  stopRendering()
  window.removeEventListener('resize', handleResize)
  
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
  <div ref="containerRef" class="pill-3d">
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
  pointer-events: none;
}

.pill-3d canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
