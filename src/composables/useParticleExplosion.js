import gsap from 'gsap'

/**
 * Sistema estandarizado para explosiones de partículas
 * Puede reutilizarse en cualquier parte de la aplicación
 */

export class ParticleExplosion {
  constructor(config = {}) {
    // Configuración por defecto
    this.config = {
      // Punto de origen
      originX: config.originX || 50, // % del contenedor
      originY: config.originY || 50, // % del contenedor
      
      // Cantidad de partículas
      particleCount: config.particleCount || 9,
      
      // Tamaños
      initialSize: config.initialSize || 5, // px - todas empiezan del mismo tamaño
      finalSizeMin: config.finalSizeMin || 80, // px
      finalSizeMax: config.finalSizeMax || 140, // px
      
      // Opacidad
      initialOpacity: config.initialOpacity || 0.3,
      finalOpacity: config.finalOpacity || 1,
      
      // Distancia
      distanceMin: config.distanceMin || 50, // % desde el centro
      distanceMax: config.distanceMax || 100, // % desde el centro
      
      // Velocidad
      durationMin: config.durationMin || 1.5, // segundos
      durationMax: config.durationMax || 2.5, // segundos
      accelerationFactor: config.accelerationFactor || 1, // Factor de aceleración global
      
      // Blur
      blurEnabled: config.blurEnabled !== undefined ? config.blurEnabled : true,
      blurMin: config.blurMin || 0,
      blurMax: config.blurMax || 15,
      blurCurve: config.blurCurve || 'linear', // 'linear', 'ease-in', 'ease-out'
      
      // Easing
      ease: config.ease || 'power2.in',
      
      // Contenedor
      container: config.container || null,
      
      // Z-index
      zIndex: config.zIndex || 2,
      
      // Imágenes/contenido de las partículas
      particleImages: config.particleImages || [],
      particleColor: config.particleColor || '#07E400',
      
      // Callbacks
      onParticleCreate: config.onParticleCreate || null,
      onParticleUpdate: config.onParticleUpdate || null,
      onComplete: config.onComplete || null
    }
    
    this.particles = []
    this.isActive = false
  }
  
  /**
   * Calcular blur dinámico basado en la posición/progreso
   */
  calculateBlur(progress, particleIndex) {
    if (!this.config.blurEnabled) return 0
    
    const { blurMin, blurMax, blurCurve } = this.config
    let blurProgress = progress
    
    // Aplicar curva de blur
    switch (blurCurve) {
      case 'ease-in':
        blurProgress = progress * progress
        break
      case 'ease-out':
        blurProgress = 1 - Math.pow(1 - progress, 2)
        break
      case 'ease-in-out':
        blurProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2
        break
      default: // linear
        blurProgress = progress
    }
    
    return blurMin + (blurMax - blurMin) * blurProgress
  }
  
  /**
   * Calcular opacidad dinámica
   */
  calculateOpacity(progress) {
    const { initialOpacity, finalOpacity } = this.config
    return initialOpacity + (finalOpacity - initialOpacity) * progress
  }
  
  /**
   * Calcular tamaño dinámico
   */
  calculateSize(progress, finalSize) {
    const { initialSize } = this.config
    return initialSize + (finalSize - initialSize) * progress
  }
  
  /**
   * Crear una partícula
   */
  createParticle(index) {
    const particle = document.createElement('div')
    particle.className = 'explosion-particle'
    
    // Calcular parámetros únicos para esta partícula
    // Ángulo con más variación aleatoria para sensación de explosión caótica
    const baseAngle = (index / this.config.particleCount) * Math.PI * 2
    const angleVariation = (Math.random() - 0.5) * 1.2 // Mayor variación en ángulo
    const angle = baseAngle + angleVariation
    
    // Distancia también aleatoria para más caos
    const distance = this.config.distanceMin + Math.random() * (this.config.distanceMax - this.config.distanceMin)
    
    // Variación ALEATORIA de tamaño - algunas crecen mucho, otras poco
    // Usar distribución aleatoria no uniforme para más variedad
    const sizeVariation = Math.random()
    const finalSize = sizeVariation < 0.3 
      ? this.config.finalSizeMin * 0.5 // 30% son muy pequeñas (solo se alejan)
      : sizeVariation < 0.7
      ? this.config.finalSizeMin + Math.random() * (this.config.finalSizeMax - this.config.finalSizeMin) // 40% tamaño medio
      : this.config.finalSizeMax * (1 + Math.random() * 0.5) // 30% son muy grandes (crecen mucho)
    
    // Velocidad variable - algunas van más lentas
    const speedVariation = 0.7 + Math.random() * 0.6 // Entre 0.7x y 1.3x
    const baseDuration = this.config.durationMin + Math.random() * (this.config.durationMax - this.config.durationMin)
    const duration = (baseDuration * speedVariation) / this.config.accelerationFactor
    
    const finalX = this.config.originX + Math.cos(angle) * distance
    const finalY = this.config.originY + Math.sin(angle) * distance
    
    // Estilos iniciales
    particle.style.cssText = `
      position: fixed;
      left: ${this.config.originX}%;
      top: ${this.config.originY}%;
      width: ${this.config.initialSize}px;
      height: ${this.config.initialSize}px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      overflow: hidden;
      opacity: ${this.config.initialOpacity};
      z-index: ${this.config.zIndex};
      pointer-events: none;
    `
    
    // Agregar contenido (imagen o color)
    if (this.config.particleImages.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.config.particleImages.length)
      const img = document.createElement('img')
      img.src = this.config.particleImages[randomIndex]
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; filter: blur(0px);'
      particle.appendChild(img)
    } else {
      particle.style.background = this.config.particleColor
    }
    
    // Callback de creación personalizada
    if (this.config.onParticleCreate) {
      this.config.onParticleCreate(particle, index)
    }
    
    return {
      element: particle,
      finalX,
      finalY,
      finalSize,
      duration,
      index
    }
  }
  
  /**
   * Animar una partícula
   */
  animateParticle(particleData) {
    return new Promise((resolve) => {
      const { element, finalX, finalY, finalSize, duration, index } = particleData
      
      // Guardar referencia a this para usar en el callback
      const self = this
      
      gsap.to(element, {
        left: `${finalX}%`,
        top: `${finalY}%`,
        width: `${finalSize}px`,
        height: `${finalSize}px`,
        duration,
        ease: this.config.ease,
        onUpdate: function() {
          // 'this' aquí es el contexto de GSAP
          const progress = this.progress()
          
          // Usar 'self' para acceder a los métodos de la clase
          const currentOpacity = self.calculateOpacity(progress)
          element.style.opacity = currentOpacity
          
          // Actualizar blur
          if (self.config.blurEnabled) {
            const currentBlur = self.calculateBlur(progress, index)
            const img = element.querySelector('img')
            if (img) {
              img.style.filter = `blur(${currentBlur}px)`
            }
          }
          
          // Callback de actualización personalizada
          if (self.config.onParticleUpdate) {
            self.config.onParticleUpdate(element, progress, index)
          }
        },
        onComplete: () => {
          element.remove()
          resolve()
        }
      })
    })
  }
  
  /**
   * Ejecutar la explosión
   */
  async explode() {
    if (!this.config.container) {
      console.error('ParticleExplosion: No container specified')
      return
    }
    
    this.isActive = true
    this.particles = []
    
    // Crear todas las partículas
    for (let i = 0; i < this.config.particleCount; i++) {
      const particleData = this.createParticle(i)
      this.config.container.appendChild(particleData.element)
      this.particles.push(particleData)
    }
    
    // Animar todas las partículas en paralelo
    const animationPromises = this.particles.map(particle => this.animateParticle(particle))
    
    await Promise.all(animationPromises)
    
    this.isActive = false
    
    // Callback de finalización
    if (this.config.onComplete) {
      this.config.onComplete()
    }
  }
  
  /**
   * Detener y limpiar la explosión
   */
  stop() {
    this.particles.forEach(particle => {
      gsap.killTweensOf(particle.element)
      particle.element.remove()
    })
    this.particles = []
    this.isActive = false
  }
}

/**
 * Composable para Vue
 */
export function useParticleExplosion(config) {
  const explosion = new ParticleExplosion(config)
  
  const explode = () => explosion.explode()
  const stop = () => explosion.stop()
  const updateConfig = (newConfig) => {
    explosion.config = { ...explosion.config, ...newConfig }
  }
  
  return {
    explode,
    stop,
    updateConfig,
    isActive: () => explosion.isActive
  }
}
