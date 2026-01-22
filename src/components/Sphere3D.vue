<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import gsap from 'gsap'

const props = defineProps({
  active: {
    type: Boolean,
    default: true
  }
})

const canvasRef = ref(null)
const containerRef = ref(null)

let scene
let camera
let renderer
let animationFrameId
let sphereMesh
let rotationTimeline
let isRendering = false

const initThree = () => {
  const container = containerRef.value
  const { clientWidth, clientHeight } = container

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 100)
  camera.position.set(0, 0, 2)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(clientWidth, clientHeight)
  renderer.setClearColor(0x000000, 0)

  // Iluminación similar al logo
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
  const textureLoader = new THREE.TextureLoader()
  
  // Cargar textura
  textureLoader.load(
    '/images/texture.png', // Ruta de la textura - ajustar según donde esté la imagen
    (texture) => {
      // Configurar propiedades de la textura
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(1, 1)
      
      // Cargar modelo OBJ
      const loader = new OBJLoader()
      loader.load(
        '/models/esfera.obj',
        (object) => {
          // Calcular el centro del modelo para centrarlo
          const box = new THREE.Box3().setFromObject(object)
          const center = box.getCenter(new THREE.Vector3())
          object.position.sub(center)

          // Calcular el tamaño para escalar apropiadamente (ajustar al tamaño del botón)
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          let baseScale = 1.5 / maxDim
          
          // Guardar el tamaño original
          object.userData.originalSize = size.clone()
          object.userData.targetScale = baseScale

          // Aplicar material al modelo con textura
          object.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                map: texture, // Aplicar textura
                color: 0x07E400, // Verde principal #07E400
                metalness: 0.1,
                roughness: 0.65,
                emissive: 0x07E400,
                emissiveIntensity: 0.1
              })
            }
          })

          sphereMesh = object
          scene.add(sphereMesh)
          
          // Aplicar escala
          sphereMesh.scale.setScalar(baseScale)
          
          setupAnimation()
        },
        undefined,
        (error) => {
          console.error('Error loading esfera.obj:', error)
        }
      )
    },
    undefined,
    (error) => {
      // Silenciar el error - el fallback cargará el modelo sin textura
      // console.error('Error loading texture:', error)
      // Fallback: cargar modelo sin textura si falla la carga
      const loader = new OBJLoader()
      loader.load(
        '/models/esfera.obj',
        (object) => {
          const box = new THREE.Box3().setFromObject(object)
          const center = box.getCenter(new THREE.Vector3())
          object.position.sub(center)

          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          let baseScale = 1.5 / maxDim

          object.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x07E400, // Verde principal #07E400
                metalness: 0.1,
                roughness: 0.65,
                emissive: 0x07E400,
                emissiveIntensity: 0.1
              })
            }
          })

          sphereMesh = object
          scene.add(sphereMesh)
          sphereMesh.scale.setScalar(baseScale)
          setupAnimation()
        }
      )
    }
  )
}

const setupAnimation = () => {
  if (!sphereMesh) return

  rotationTimeline?.kill()
  
  // Rotación continua suave
  rotationTimeline = gsap.timeline({
    repeat: -1,
    paused: !props.active
  })

  // Rotación en eje Y (eje vertical)
  rotationTimeline.to(sphereMesh.rotation, {
    y: `+=${Math.PI * 2}`,
    duration: 8,
    ease: 'none'
  }, 0)
  
  // Rotación sutil en eje X
  rotationTimeline.to(sphereMesh.rotation, {
    x: `+=${Math.PI * 0.5}`,
    duration: 6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1
  }, 0)

  if (props.active) {
    rotationTimeline.play()
  }
}

const renderLoop = () => {
  animationFrameId = requestAnimationFrame(renderLoop)
  renderer?.render(scene, camera)
}

const startRendering = () => {
  if (isRendering) return
  isRendering = true
  renderLoop()
}

const stopRendering = () => {
  if (!isRendering) return
  cancelAnimationFrame(animationFrameId)
  animationFrameId = null
  isRendering = false
}

const handleResize = () => {
  if (!renderer || !camera) return
  const { clientWidth, clientHeight } = containerRef.value
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(clientWidth, clientHeight)
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      rotationTimeline?.play()
      startRendering()
    } else {
      rotationTimeline?.pause()
      stopRendering()
    }
  },
  { immediate: true }
)

onMounted(() => {
  initThree()
  if (props.active) {
    startRendering()
    rotationTimeline?.play()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopRendering()
  renderer?.dispose()
  rotationTimeline?.kill()
  scene?.clear()
})
</script>

<template>
  <div class="sphere-3d" ref="containerRef">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.sphere-3d {
  width: 100%;
  height: 100%;
  position: relative;
  pointer-events: none;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
