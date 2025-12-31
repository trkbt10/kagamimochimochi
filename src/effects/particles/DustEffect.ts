import * as THREE from 'three'

const DUST_PARTICLE_COUNT = 50
const DUST_LIFETIME = 1.5
const GRAVITY = -9.8

type DustParticleData = {
  positions: Float32Array
  velocities: Float32Array
  lifetimes: Float32Array
}

function createDustData(): DustParticleData {
  const positions = new Float32Array(DUST_PARTICLE_COUNT * 3)
  const velocities = new Float32Array(DUST_PARTICLE_COUNT * 3)
  const lifetimes = new Float32Array(DUST_PARTICLE_COUNT)

  for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
    positions[i * 3] = 0
    positions[i * 3 + 1] = -1000
    positions[i * 3 + 2] = 0
    lifetimes[i] = -1
  }

  return { positions, velocities, lifetimes }
}

export class DustEffect {
  private particles: THREE.Points
  private data: DustParticleData
  private floorY: number

  constructor(scene: THREE.Scene, floorY: number = -2) {
    this.floorY = floorY
    this.data = createDustData()

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.data.positions, 3))

    const colors = new Float32Array(DUST_PARTICLE_COUNT * 3)
    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      const brownVariation = 0.1 + Math.random() * 0.15
      colors[i * 3] = 0.55 + brownVariation
      colors[i * 3 + 1] = 0.45 + brownVariation * 0.8
      colors[i * 3 + 2] = 0.33 + brownVariation * 0.5
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    })

    this.particles = new THREE.Points(geometry, material)
    scene.add(this.particles)
  }

  emit(position: THREE.Vector3, intensity: number = 1) {
    const particlesToEmit = Math.floor(DUST_PARTICLE_COUNT * Math.min(intensity, 1))

    for (let i = 0; i < particlesToEmit; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * 0.5
      const baseIndex = i * 3

      this.data.positions[baseIndex] = position.x + Math.cos(angle) * distance
      this.data.positions[baseIndex + 1] = position.y + Math.random() * 0.3
      this.data.positions[baseIndex + 2] = position.z + Math.sin(angle) * distance

      const speed = 2 + Math.random() * 4 * intensity
      const outAngle = angle + (Math.random() - 0.5) * 0.5
      this.data.velocities[baseIndex] = Math.cos(outAngle) * speed
      this.data.velocities[baseIndex + 1] = 1 + Math.random() * 3 * intensity
      this.data.velocities[baseIndex + 2] = Math.sin(outAngle) * speed

      this.data.lifetimes[i] = DUST_LIFETIME * (0.7 + Math.random() * 0.3)
    }
  }

  update(delta: number) {
    const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    let activeCount = 0

    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      if (this.data.lifetimes[i] <= 0) continue

      activeCount++
      this.data.lifetimes[i] -= delta

      const baseIndex = i * 3

      this.data.velocities[baseIndex] *= 0.98
      this.data.velocities[baseIndex + 1] += GRAVITY * delta * 0.5
      this.data.velocities[baseIndex + 2] *= 0.98

      this.data.positions[baseIndex] += this.data.velocities[baseIndex] * delta
      this.data.positions[baseIndex + 1] += this.data.velocities[baseIndex + 1] * delta
      this.data.positions[baseIndex + 2] += this.data.velocities[baseIndex + 2] * delta

      if (this.data.positions[baseIndex + 1] < this.floorY) {
        this.data.positions[baseIndex + 1] = this.floorY
        this.data.velocities[baseIndex + 1] = 0
        this.data.lifetimes[i] = Math.min(this.data.lifetimes[i], 0.3)
      }

      positions.setXYZ(
        i,
        this.data.positions[baseIndex],
        this.data.positions[baseIndex + 1],
        this.data.positions[baseIndex + 2]
      )
    }

    const material = this.particles.material as THREE.PointsMaterial
    let avgLifeRatio = 0
    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      if (this.data.lifetimes[i] > 0) {
        avgLifeRatio += this.data.lifetimes[i] / DUST_LIFETIME
      }
    }
    material.opacity = activeCount > 0 ? (avgLifeRatio / activeCount) * 0.8 : 0

    positions.needsUpdate = true
  }

  dispose() {
    this.particles.geometry.dispose()
    ;(this.particles.material as THREE.Material).dispose()
    this.particles.parent?.remove(this.particles)
  }
}
