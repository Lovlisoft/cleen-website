<script setup>
import { onMounted, ref } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  active: {
    type: Boolean,
    default: true
  }
})

const containerRef = ref(null)
const pills = ref([])

// Lista de imágenes disponibles (se puede expandir cuando haya más)
const availableImages = [
  '/images/pills/A.webp'
  // Agregar más imágenes aquí cuando estén disponibles
  // '/images/pills/B.webp',
  // '/images/pills/C.webp',
  // etc.
]

// Configuración de profundidad
const DEPTH_LEVELS = 12 // Total de imágenes
const MIN_SIZE = 40 // Tamaño mínimo en px (más cerca del centro)
const MAX_SIZE = 200 // Tamaño máximo en px (más lejos del centro)
const MIN_BLUR = 0 // Blur mínimo (sin blur - para tamaño máximo)
const MAX_BLUR = 8 // Blur máximo (muy borroso - para tamaño mínimo)

// Área central mínima a evitar (solo el centro exacto donde está el logo)
const CENTER_EXCLUSION_RADIUS = 0.08 // 8% del viewport desde el centro (muy pequeño)
const QUADRANT_ELEMENTS = DEPTH_LEVELS / 4 // 3 elementos por cuadrante
const MIN_DISTANCE = 0.12 // Distancia mínima entre elementos (12% del viewport)

// Función para verificar si una posición está demasiado cerca de otras
const isTooClose = (x, y, existingPositions, minDistance) => {
  for (const pos of existingPositions) {
    const dx = (x - pos.x) / 100
    const dy = (y - pos.y) / 100
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < minDistance) {
      return true
    }
  }
  return false
}

// Función para generar posición distribuida uniformemente evitando aglomeraciones
const getUniformPosition = (index, total, existingPositions) => {
  const centerX = 50
  const centerY = 50
  const margin = 0.03 // Margen del borde (3%)
  const maxRadius = 0.47 // Radio máximo (hasta casi el borde)
  
  // Determinar cuadrante (0-3): top-right, top-left, bottom-left, bottom-right
  const quadrant = Math.floor(index / QUADRANT_ELEMENTS)
  const positionInQuadrant = index % QUADRANT_ELEMENTS
  
  // Ángulo base para cada cuadrante
  const quadrantAngles = [
    Math.PI * 0.25,    // Cuadrante 0: 45° (top-right)
    Math.PI * 0.75,    // Cuadrante 1: 135° (top-left)
    Math.PI * 1.25,    // Cuadrante 2: 225° (bottom-left)
    Math.PI * 1.75     // Cuadrante 3: 315° (bottom-right)
  ]
  
  // Radio basado en la posición en el cuadrante: distribuir uniformemente en el espacio disponible
  const radiusFactor = (positionInQuadrant + 0.5) / QUADRANT_ELEMENTS // Distribuir uniformemente
  const baseRadius = CENTER_EXCLUSION_RADIUS + 0.05 + (maxRadius - CENTER_EXCLUSION_RADIUS - 0.05) * radiusFactor
  
  let attempts = 0
  let x, y, distance
  const maxAttempts = 50
  
  // Intentar encontrar una posición que no esté demasiado cerca de otras
  do {
    // Ángulo base del cuadrante + variación dentro del cuadrante
    const angleVariation = (Math.random() - 0.5) * (Math.PI / 2) * 0.8 // Variación dentro del cuadrante
    const angle = quadrantAngles[quadrant] + angleVariation
    
    // Radio con pequeña variación
    const radiusVariation = (Math.random() - 0.5) * 0.15
    const finalRadius = Math.max(CENTER_EXCLUSION_RADIUS + 0.02, Math.min(maxRadius, baseRadius + radiusVariation))
    
    // Convertir coordenadas polares a cartesianas
    x = centerX + finalRadius * 100 * Math.cos(angle)
    y = centerY + finalRadius * 100 * Math.sin(angle)
    
    // Verificar distancia desde el centro
    const dx = (x - centerX) / 100
    const dy = (y - centerY) / 100
    distance = Math.sqrt(dx * dx + dy * dy)
    
    attempts++
    
    // Si después de muchos intentos, usar la posición base pero ajustada
    if (attempts > maxAttempts) {
      // Usar posición más conservadora dentro del cuadrante
      const conservativeAngle = quadrantAngles[quadrant] + (positionInQuadrant / QUADRANT_ELEMENTS) * (Math.PI / 2)
      x = centerX + baseRadius * 100 * Math.cos(conservativeAngle)
      y = centerY + baseRadius * 100 * Math.sin(conservativeAngle)
      break
    }
  } while (distance < CENTER_EXCLUSION_RADIUS || isTooClose(x, y, existingPositions, MIN_DISTANCE))
  
  return { 
    x: Math.max(margin * 100, Math.min(100 - margin * 100, x)), 
    y: Math.max(margin * 100, Math.min(100 - margin * 100, y)),
    distance: distance
  }
}

// Función para generar tamaño basado en distancia al centro (más cerca = más pequeño)
const getSizeFromDistance = (distance, index) => {
  // Normalizar distancia: CENTER_EXCLUSION_RADIUS = 0, maxRadius = 1
  const maxRadius = 0.47
  const normalizedDistance = (distance - CENTER_EXCLUSION_RADIUS) / (maxRadius - CENTER_EXCLUSION_RADIUS)
  
  // Mapear distancia a tamaño: distancia pequeña (0) = tamaño pequeño, distancia grande (1) = tamaño grande
  // Usar una curva para más variación: elementos cerca del centro son más pequeños
  const sizeFactor = Math.max(0, Math.min(1, normalizedDistance))
  
  // Agregar pequeña variación aleatoria para más naturalidad
  const variation = (Math.random() - 0.5) * 0.15 // ±15% de variación
  const finalFactor = Math.max(0, Math.min(1, sizeFactor + variation))
  
  const size = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * finalFactor
  return Math.round(size)
}

// Función para calcular blur según tamaño (más pequeño = más blur, 150px = 0 blur)
const getBlurFromSize = (size) => {
  // Mapear tamaño a blur: más pequeño = más blur, 150px (MAX_SIZE) = 0 blur
  const sizeRange = MAX_SIZE - MIN_SIZE
  const relativeSize = (size - MIN_SIZE) / sizeRange
  // Invertir: tamaño pequeño (0) = blur máximo, tamaño grande (1) = blur mínimo (0)
  const blur = MIN_BLUR + (MAX_BLUR - MIN_BLUR) * (1 - relativeSize)
  return Math.max(0, blur) // Asegurar que no sea negativo
}

// Función para seleccionar imagen aleatoria (cuando haya más de una)
const getRandomImage = () => {
  if (availableImages.length === 0) return null
  // Por ahora solo hay una imagen, cuando haya más usar Math.random()
  return availableImages[0]
  // Cuando haya más: return availableImages[Math.floor(Math.random() * availableImages.length)]
}

// Generar configuración de pills
const generatePills = () => {
  const generatedPills = []
  const existingPositions = []
  
  for (let i = 0; i < DEPTH_LEVELS; i++) {
    const image = getRandomImage()
    if (!image) continue
    
    const position = getUniformPosition(i, DEPTH_LEVELS, existingPositions)
    
    // Agregar posición a la lista de existentes para evitar solapamientos
    existingPositions.push({ x: position.x, y: position.y })
    
    // Usar la distancia al centro para determinar el tamaño (más cerca = más pequeño)
    const size = getSizeFromDistance(position.distance, i)
    const blur = getBlurFromSize(size)
    
    // Espejado horizontal y/o vertical aleatorio
    const flipHorizontal = Math.random() > 0.5 // 50% de probabilidad
    const flipVertical = Math.random() > 0.5 // 50% de probabilidad
    const scaleX = flipHorizontal ? -1 : 1
    const scaleY = flipVertical ? -1 : 1
    
    // Rotación aleatoria inicial (0-360 grados)
    const initialRotation = Math.random() * 360
    
    generatedPills.push({
      id: i,
      src: image,
      x: position.x,
      y: position.y,
      size: size,
      blur: blur,
      opacity: 0.7 + Math.random() * 0.3, // Opacidad entre 0.7 y 1.0
      scaleX: scaleX,
      scaleY: scaleY,
      rotation: initialRotation
    })
  }
  
  pills.value = generatedPills
}

// Animar entrada de las pills
const animatePills = () => {
  if (!containerRef.value) return
  
  const pillElements = containerRef.value.querySelectorAll('.floating-pill')
  
  pillElements.forEach((pill, index) => {
    const pillData = pills.value[index]
    
    // Configurar propiedades iniciales incluyendo espejado
    gsap.set(pill, {
      opacity: 0,
      scale: 0,
      scaleX: pillData.scaleX,
      scaleY: pillData.scaleY,
      rotation: pillData.rotation
    })
    
    // Animar entrada con delay escalonado
    gsap.to(pill, {
      opacity: pillData.opacity,
      scale: 1,
      duration: 1,
      delay: index * 0.1,
      ease: 'back.out(1.7)'
    })
    
    // Animación de flotación continua (solo si está activo)
    if (props.active) {
      const floatDuration = 3 + Math.random() * 2 // Entre 3 y 5 segundos
      const floatDistance = 20 + Math.random() * 20 // Entre 20 y 40px
      
      // Rotación continua en dirección aleatoria (algunos en un sentido, otros en otro)
      const rotationDirection = Math.random() > 0.5 ? 1 : -1
      const rotationAmount = (10 + Math.random() * 20) * rotationDirection
      
      // Animar posición y rotación continua
      gsap.to(pill, {
        y: `+=${floatDistance}`,
        x: `+=${floatDistance * (Math.random() > 0.5 ? 1 : -1)}`,
        rotation: `+=${rotationAmount}`,
        duration: floatDuration,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      })
    }
  })
}

onMounted(() => {
  generatePills()
  
  // Esperar a que se rendericen las imágenes
  setTimeout(() => {
    if (props.active) {
      animatePills()
    }
  }, 100)
})
</script>

<template>
  <div class="floating-pills" ref="containerRef">
    <div
      v-for="pill in pills"
      :key="pill.id"
      class="floating-pill"
      :style="{
        left: `${pill.x}%`,
        top: `${pill.y}%`,
        width: `${pill.size}px`,
        height: `${pill.size}px`,
        filter: `blur(${pill.blur}px)`,
        transform: `translate(-50%, -50%)`,
        opacity: pill.opacity
      }"
    >
      <img
        :src="pill.src"
        :alt="`Floating pill ${pill.id + 1}`"
        class="floating-pill__image"
      />
    </div>
  </div>
</template>

<style scoped>
.floating-pills {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.floating-pill {
  position: absolute;
  pointer-events: none;
  will-change: transform;
  transform-origin: center center;
}

.floating-pill__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
