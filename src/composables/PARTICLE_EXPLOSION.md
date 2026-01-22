# Sistema de Explosión de Partículas

Sistema estandarizado y reutilizable para crear efectos de explosión de partículas con control total sobre el comportamiento.

## Características

✅ **Todas las partículas surgen del mismo punto** (configurable)
✅ **Tamaño inicial uniforme** para todas las partículas
✅ **Crecimiento progresivo** conforme se alejan del centro
✅ **Opacidad dinámica** que aumenta con el crecimiento
✅ **Velocidades variables** - algunas partículas más lentas que otras
✅ **Factor de aceleración global** controlable
✅ **Blur individual** manipulable por partícula

## Uso Básico

```javascript
import { ParticleExplosion } from '@/composables/useParticleExplosion'

// Crear una explosión
const explosion = new ParticleExplosion({
  container: document.querySelector('#mi-contenedor'),
  particleCount: 12,
  particleImages: ['/img/particle1.png', '/img/particle2.png']
})

// Ejecutar
await explosion.explode()
```

## Uso con Vue Composable

```vue
<script setup>
import { useParticleExplosion } from '@/composables/useParticleExplosion'
import { ref } from 'vue'

const container = ref(null)

const { explode, stop, updateConfig } = useParticleExplosion({
  container: container.value,
  particleCount: 9,
  accelerationFactor: 1.5
})

const handleClick = () => {
  explode()
}
</script>

<template>
  <div ref="container" @click="handleClick">
    Click para explotar
  </div>
</template>
```

## Configuración Completa

### Origen
```javascript
{
  originX: 50,  // % del contenedor (50 = centro)
  originY: 50   // % del contenedor (50 = centro)
}
```

### Partículas
```javascript
{
  particleCount: 9,           // Cantidad de partículas
  initialSize: 5,             // Tamaño inicial en px (todas iguales)
  finalSizeMin: 80,           // Tamaño final mínimo
  finalSizeMax: 140           // Tamaño final máximo
}
```

### Opacidad
```javascript
{
  initialOpacity: 0.3,        // Opacidad inicial (más pequeñas)
  finalOpacity: 1             // Opacidad final (más grandes)
}
```

### Distancia
```javascript
{
  distanceMin: 50,            // % mínimo desde el centro
  distanceMax: 100            // % máximo desde el centro
}
```

### Velocidad
```javascript
{
  durationMin: 1.5,           // Duración mínima en segundos
  durationMax: 2.5,           // Duración máxima en segundos
  accelerationFactor: 1       // Factor de aceleración global (1 = normal, 2 = doble velocidad)
}
```

### Blur
```javascript
{
  blurEnabled: true,          // Activar/desactivar blur
  blurMin: 0,                 // Blur inicial (px)
  blurMax: 15,                // Blur final (px)
  blurCurve: 'linear'         // 'linear', 'ease-in', 'ease-out', 'ease-in-out'
}
```

### Easing
```javascript
{
  ease: 'power2.in'           // Cualquier easing de GSAP
}
```

### Contenido
```javascript
{
  particleImages: [           // Array de imágenes (opcional)
    '/img/particle1.png',
    '/img/particle2.png'
  ],
  particleColor: '#07E400'    // Color si no hay imágenes
}
```

### Callbacks Personalizados
```javascript
{
  onParticleCreate: (element, index) => {
    // Personalizar cada partícula al crearla
    console.log('Partícula creada:', index)
  },
  
  onParticleUpdate: (element, progress, index) => {
    // Ejecutar en cada frame de la animación
    // progress va de 0 a 1
    console.log('Progreso:', progress)
  },
  
  onComplete: () => {
    // Cuando termina la explosión
    console.log('Explosión completada')
  }
}
```

## Ejemplos

### Explosión Rápida
```javascript
const explosion = new ParticleExplosion({
  container: myContainer,
  particleCount: 15,
  accelerationFactor: 2,  // Doble de velocidad
  durationMin: 0.5,
  durationMax: 1
})
```

### Explosión con Mucho Blur
```javascript
const explosion = new ParticleExplosion({
  container: myContainer,
  blurEnabled: true,
  blurMin: 0,
  blurMax: 30,
  blurCurve: 'ease-in'  // Blur acelerado al final
})
```

### Explosión desde una Esquina
```javascript
const explosion = new ParticleExplosion({
  container: myContainer,
  originX: 10,  // Esquina inferior izquierda
  originY: 90
})
```

### Explosión con Callback Personalizado
```javascript
const explosion = new ParticleExplosion({
  container: myContainer,
  onParticleUpdate: (element, progress) => {
    // Rotar cada partícula mientras viaja
    element.style.transform = `
      translate(-50%, -50%)
      rotate(${progress * 360}deg)
    `
  }
})
```

## Métodos

### `explode()`
Ejecuta la explosión. Retorna una Promise que se resuelve cuando termina.

```javascript
await explosion.explode()
console.log('Terminó')
```

### `stop()`
Detiene y limpia la explosión inmediatamente.

```javascript
explosion.stop()
```

## Curvas de Blur

- **`linear`**: Blur aumenta uniformemente
- **`ease-in`**: Blur aumenta lentamente al inicio, rápido al final
- **`ease-out`**: Blur aumenta rápido al inicio, lento al final
- **`ease-in-out`**: Blur aumenta lento al inicio y final, rápido en medio

## Notas Importantes

1. Las partículas son elementos DOM creados dinámicamente
2. Se eliminan automáticamente al terminar la animación
3. El contenedor debe tener `position: relative` o `position: absolute`
4. Las velocidades variables se calculan automáticamente (70% a 130% de la duración base)
5. El z-index puede ajustarse para controlar la superposición

## Performance

- Las partículas usan `will-change: transform` para optimización
- Se eliminan del DOM al terminar para liberar memoria
- GSAP optimiza automáticamente las animaciones

## Integración con Código Existente

Para migrar explosiones existentes al nuevo sistema:

```javascript
// Antes
const animateExplosion = (duration) => {
  // Código manual complejo...
}

// Ahora
const animateExplosion = (duration) => {
  const explosion = new ParticleExplosion({
    container: containerRef.value,
    particleCount: 9,
    durationMin: duration * 0.8,
    durationMax: duration * 1.2,
    particleImages: availableImages
  })
  
  return explosion.explode()
}
```
