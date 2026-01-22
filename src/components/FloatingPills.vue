<script setup>
import { onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { ParticleExplosion } from '../composables/useParticleExplosion.js'

const props = defineProps({
  active: {
    type: Boolean,
    default: true
  },
  isLoading: {
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
const DEPTH_LEVELS = 9 // Total de imágenes
const MIN_SIZE = 40 // Tamaño mínimo en px (más cerca del centro)
const MAX_SIZE = 200 // Tamaño máximo en px (más lejos del centro)
const MIN_BLUR = 0 // Blur mínimo (sin blur - para tamaño máximo)
const MAX_BLUR = 8 // Blur máximo (muy borroso - para tamaño mínimo)

// Área central mínima a evitar (solo el centro exacto donde está el logo)
const CENTER_EXCLUSION_RADIUS = 0.08 // 8% del viewport desde el centro (muy pequeño)
const QUADRANT_ELEMENTS = Math.ceil(DEPTH_LEVELS / 4) // Elementos por cuadrante (redondeado hacia arriba)
const MIN_DISTANCE = 0.15 // Distancia mínima entre elementos (15% del viewport - aumentado para más separación)

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
  const maxRadius = 0.60 // Radio máximo (reducido para menos separación)
  
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
  
  // Permitir que las posiciones se salgan del borde (sin clamp)
  return { 
    x: x, 
    y: y,
    distance: distance
  }
}

// Función para generar tamaño basado en distancia al centro (más cerca = más pequeño)
const getSizeFromDistance = (distance, index) => {
  // Normalizar distancia: CENTER_EXCLUSION_RADIUS = 0, maxRadius = 1
  const maxRadius = 0.60
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
      opacity: 1, // Opacidad siempre al 100%
      scaleX: scaleX,
      scaleY: scaleY,
      rotation: initialRotation
    })
  }
  
  pills.value = generatedPills
}

// Animar entrada de las pills con efecto explosión desde el centro
const animatePills = () => {
  if (!containerRef.value) return
  
  const pillElements = containerRef.value.querySelectorAll('.floating-pill')
  const centerX = 50 // Centro horizontal (porcentaje)
  const centerY = 50 // Centro vertical (porcentaje)
  
  // Ordenar pills por tamaño (menor a mayor) para animación
  // Las más pequeñas aparecen primero
  const sortedPills = pills.value
    .map((pill, index) => ({ pill, index, element: pillElements[index] }))
    .filter(item => item.element)
    .sort((a, b) => a.pill.size - b.pill.size)
  
  sortedPills.forEach((item, sortedIndex) => {
    const pill = item.element
    const pillData = item.pill
    
    // Posición final del pill (en porcentajes)
    const finalX = pillData.x
    const finalY = pillData.y
    
    // Configurar propiedades iniciales: todas en el centro, invisibles y pequeñas
    gsap.set(pill, {
      left: `${centerX}%`,
      top: `${centerY}%`,
      opacity: 0,
      scale: 0,
      scaleX: pillData.scaleX,
      scaleY: pillData.scaleY,
      rotation: pillData.rotation
    })
    
    // Animación de explosión súbita: todas llegan al mismo tiempo
    const explosionDuration = 0.4 // Más rápida y explosiva
    const bounceDuration = 0.3
    
    // Timeline para explosión + rebote (sin delay - todas al mismo tiempo)
    const tl = gsap.timeline()
    
    // Fase 1: Explosión súbita desde el centro hacia la posición final
    tl.to(pill, {
      left: `${finalX}%`,
      top: `${finalY}%`,
      opacity: 1,
      scale: 1.2, // Más grande para efecto más explosivo
      duration: explosionDuration,
      ease: 'power3.out' // Más agresivo que power2
    })
    // Fase 2: Rebote (escala más pequeña)
    .to(pill, {
      scale: 0.85, // Rebotar más dramático
      duration: bounceDuration * 0.4,
      ease: 'power2.in'
    })
    // Fase 3: Volver al tamaño final con rebote
    .to(pill, {
      scale: 1, // Volver al tamaño final
      duration: bounceDuration * 0.6,
      ease: 'back.out(3)' // Rebote más fuerte
    })
    
    // Animación de flotación continua (solo si está activo, después de la explosión)
    if (props.active) {
      const floatDuration = 3 + Math.random() * 2 // Entre 3 y 5 segundos
      const floatDistance = 20 + Math.random() * 20 // Entre 20 y 40px
      
      // Rotación continua en dirección aleatoria
      const rotationDirection = Math.random() > 0.5 ? 1 : -1
      const rotationAmount = (10 + Math.random() * 20) * rotationDirection
      
      // Iniciar flotación después de la explosión
      gsap.to(pill, {
        y: `+=${floatDistance}`,
        x: `+=${floatDistance * (Math.random() > 0.5 ? 1 : -1)}`,
        rotation: `+=${rotationAmount}`,
        duration: floatDuration,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: explosionDuration + bounceDuration // Esperar a que termine la explosión
      })
    }
  })
}

// Watch para ejecutar animación cuando termine el loading
watch(
  () => props.isLoading,
  (loading) => {
    if (!loading && props.active) {
      // Esperar un pequeño delay después del loading para sincronizar con el logo
      setTimeout(() => {
        animatePills()
      }, 200)
    }
  },
  { immediate: true }
)

// Exponer métodos para animación de salida
const animateExit = (duration = 2) => {
  console.log('💊 FloatingPills.animateExit called', { duration, container: !!containerRef.value })
  
  if (!containerRef.value) {
    console.error('❌ FloatingPills: container not available')
    return Promise.resolve()
  }
  
  const pillElements = containerRef.value.querySelectorAll('.floating-pill:not(.floating-pill--center)')
  console.log('💊 FloatingPills: found', pillElements.length, 'pills')
  const promises = []
  
  pillElements.forEach((pill) => {
    const pillData = pills.value[Array.from(pillElements).indexOf(pill)]
    if (!pillData) return
    
    // Calcular dirección desde el centro hacia la posición actual
    const centerX = 50
    const centerY = 50
    const dx = pillData.x - centerX
    const dy = pillData.y - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Normalizar dirección
    const dirX = dx / distance
    const dirY = dy / distance
    
    // Continuar el movimiento en la misma línea, aumentando la distancia
    const exitDistance = distance * 3 // Multiplicar por 3 para que se alejen mucho
    const finalX = pillData.x + dirX * exitDistance
    const finalY = pillData.y + dirY * exitDistance
    
    promises.push(
      new Promise((resolve) => {
        gsap.to(pill, {
          left: `${finalX}%`,
          top: `${finalY}%`,
          scale: 0.3, // Reducir tamaño mientras se alejan
          opacity: 0,
          duration,
          ease: 'power2.out',
          onComplete: resolve
        })
      })
    )
  })
  
  console.log('💊 FloatingPills: starting', promises.length, 'pill animations')
  return Promise.all(promises).then(() => {
    console.log('✅ FloatingPills: all animations completed')
  })
}

const createCenterPill = () => {
  if (!containerRef.value) {
    console.error('❌ createCenterPill: containerRef not available')
    return null
  }
  
  const centerPill = document.createElement('div')
  centerPill.className = 'floating-pill floating-pill--center'
  centerPill.style.cssText = `
    position: fixed;
    left: 50%;
    top: 50%;
    width: 5px;
    height: 5px;
    opacity: 1;
    transform: translate(-50%, -50%);
    z-index: 10;
    pointer-events: none;
    border-radius: 50%;
    overflow: hidden;
  `
  
  const img = document.createElement('img')
  img.src = availableImages[0]
  img.className = 'floating-pill__image'
  img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; opacity: 1;'
  
  centerPill.appendChild(img)
  containerRef.value.appendChild(centerPill)
  
  return centerPill
}

const animateCenterPill = (pillElement, duration = 2) => {
  if (!pillElement) return Promise.resolve()
  
  // Calcular tamaño que REBASE COMPLETAMENTE el viewport - el DOBLE
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const diagonal = Math.sqrt(viewportWidth * viewportWidth + viewportHeight * viewportHeight)
  const finalSize = diagonal * 3 // 300% de la diagonal para dar sensación de zoom total y rebasar completamente
  
  return new Promise((resolve) => {
    // Crecer con opacidad siempre en 100%
    // Easing circ.in: Inicio muy lento (circular), luego aceleración exponencial dramática
    gsap.to(pillElement, {
      width: `${finalSize}px`,
      height: `${finalSize}px`,
      opacity: 1,
      duration,
      ease: 'circ.in', // Empieza muy lento, luego super aceleración al final
      onComplete: resolve
    })
  })
}

/**
 * Animación de explosión de pastillas usando el sistema estandarizado
 */
const animateExplosion = (duration = 2) => {
  if (!containerRef.value) return Promise.resolve()
  
  // Configurar la explosión usando el sistema estandarizado
  const explosion = new ParticleExplosion({
    // Origen
    originX: 50,
    originY: 50,
    
    // Más partículas para efecto explosivo
    particleCount: 15,
    
    // Tamaños - todas empiezan del mismo tamaño pequeño
    initialSize: 8,
    finalSizeMin: 60,  // Algunas quedan pequeñas (solo se alejan)
    finalSizeMax: 180, // Otras crecen mucho (se acercan a la cámara)
    
    // Opacidad
    initialOpacity: 0.4,
    finalOpacity: 1,
    
    // Distancia - mayor variación
    distanceMin: 40,
    distanceMax: 120,
    
    // Velocidad - mucha más variación
    durationMin: duration * 0.6,
    durationMax: duration * 1.4,
    accelerationFactor: 1,
    
    // Blur incremental
    blurEnabled: true,
    blurMin: 0,
    blurMax: 20,
    blurCurve: 'linear',
    
    // Easing con más impacto
    ease: 'power2.out',
    
    // Contenedor
    container: containerRef.value,
    
    // Z-index
    zIndex: 2,
    
    // Imágenes
    particleImages: availableImages
  })
  
  return explosion.explode()
}

defineExpose({
  animateExit,
  createCenterPill,
  animateCenterPill,
  animateExplosion,
  pills: () => pills.value,
  containerRef // Exponer containerRef para poder acceder a la pastilla central
})

onMounted(() => {
  generatePills()
  
  // Si el loading ya terminó, animar inmediatamente
  if (!props.isLoading && props.active) {
    setTimeout(() => {
      animatePills()
    }, 200)
  }
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
        opacity: 1
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
  opacity: 1;
}
</style>
