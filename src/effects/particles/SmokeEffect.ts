import * as THREE from 'three'

const SMOKE_PARTICLE_COUNT = 80
const SMOKE_LIFETIME = 1.5
const SMOKE_INITIAL_BURST_DURATION = 0.1

type SmokeParticleData = {
  positions: Float32Array
  velocities: Float32Array
  lifetimes: Float32Array
  sizes: Float32Array
  opacities: Float32Array
}

function createSmokeData(): SmokeParticleData {
  const positions = new Float32Array(SMOKE_PARTICLE_COUNT * 3)
  const velocities = new Float32Array(SMOKE_PARTICLE_COUNT * 3)
  const lifetimes = new Float32Array(SMOKE_PARTICLE_COUNT)
  const sizes = new Float32Array(SMOKE_PARTICLE_COUNT)
  const opacities = new Float32Array(SMOKE_PARTICLE_COUNT)

  for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
    positions[i * 3] = 0
    positions[i * 3 + 1] = -1000
    positions[i * 3 + 2] = 0
    lifetimes[i] = -1
    sizes[i] = 0.1 + Math.random() * 0.2
    opacities[i] = 0
  }

  return { positions, velocities, lifetimes, sizes, opacities }
}

export class SmokeEffect {
  private particles: THREE.Points
  private data: SmokeParticleData
  private emitting = false
  private emitTime = 0
  private emitPosition = new THREE.Vector3()
  private emitDirection = new THREE.Vector3()
  private nextParticleIndex = 0

  constructor(scene: THREE.Scene) {
    this.data = createSmokeData()

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.data.positions, 3))

    const colors = new Float32Array(SMOKE_PARTICLE_COUNT * 3)
    for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
      const gray = 0.7 + Math.random() * 0.3
      colors[i * 3] = gray
      colors[i * 3 + 1] = gray
      colors[i * 3 + 2] = gray
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.NormalBlending
    })

    this.particles = new THREE.Points(geometry, material)
    scene.add(this.particles)
  }

  emit(position: THREE.Vector3, direction: THREE.Vector3) {
    this.emitting = true
    this.emitTime = 0
    this.emitPosition.copy(position)
    this.emitDirection.copy(direction).normalize().negate()
    this.nextParticleIndex = 0
  }

  update(delta: number) {
    if (this.emitting) {
      this.emitTime += delta
      if (this.emitTime < SMOKE_INITIAL_BURST_DURATION) {
        const particlesToEmit = Math.floor(
          (this.emitTime / SMOKE_INITIAL_BURST_DURATION) * SMOKE_PARTICLE_COUNT
        ) - this.nextParticleIndex

        for (let i = 0; i < particlesToEmit && this.nextParticleIndex < SMOKE_PARTICLE_COUNT; i++) {
          this.emitParticle(this.nextParticleIndex)
          this.nextParticleIndex++
        }
      } else {
        this.emitting = false
      }
    }

    this.updateParticles(delta)
  }

  private emitParticle(index: number) {
    const spread = 0.5
    const randomOffset = new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    )

    const baseIndex = index * 3
    this.data.positions[baseIndex] = this.emitPosition.x + randomOffset.x
    this.data.positions[baseIndex + 1] = this.emitPosition.y + randomOffset.y
    this.data.positions[baseIndex + 2] = this.emitPosition.z + randomOffset.z

    const speed = 2 + Math.random() * 3
    const spreadAngle = Math.PI / 6
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * spreadAngle

    const localDir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    )

    const up = new THREE.Vector3(0, 1, 0)
    const rotationAxis = new THREE.Vector3().crossVectors(up, this.emitDirection).normalize()
    const rotationAngle = Math.acos(up.dot(this.emitDirection))

    if (rotationAxis.length() > 0.001) {
      localDir.applyAxisAngle(rotationAxis, rotationAngle)
    }

    this.data.velocities[baseIndex] = localDir.x * speed + this.emitDirection.x * speed * 0.5
    this.data.velocities[baseIndex + 1] = localDir.y * speed + 1.5
    this.data.velocities[baseIndex + 2] = localDir.z * speed + this.emitDirection.z * speed * 0.5

    this.data.lifetimes[index] = SMOKE_LIFETIME
    this.data.opacities[index] = 0.8
  }

  private updateParticles(delta: number) {
    const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute

    for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
      if (this.data.lifetimes[i] <= 0) continue

      this.data.lifetimes[i] -= delta

      const baseIndex = i * 3

      this.data.velocities[baseIndex] *= 0.95
      this.data.velocities[baseIndex + 1] += 0.8 * delta
      this.data.velocities[baseIndex + 2] *= 0.95

      this.data.positions[baseIndex] += this.data.velocities[baseIndex] * delta
      this.data.positions[baseIndex + 1] += this.data.velocities[baseIndex + 1] * delta
      this.data.positions[baseIndex + 2] += this.data.velocities[baseIndex + 2] * delta

      const lifeRatio = this.data.lifetimes[i] / SMOKE_LIFETIME
      this.data.opacities[i] = lifeRatio * 0.6
      this.data.sizes[i] = (0.1 + Math.random() * 0.2) * (1 + (1 - lifeRatio) * 2)

      positions.setXYZ(
        i,
        this.data.positions[baseIndex],
        this.data.positions[baseIndex + 1],
        this.data.positions[baseIndex + 2]
      )
    }

    const material = this.particles.material as THREE.PointsMaterial
    let avgOpacity = 0
    let activeCount = 0
    for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
      if (this.data.lifetimes[i] > 0) {
        avgOpacity += this.data.opacities[i]
        activeCount++
      }
    }
    material.opacity = activeCount > 0 ? avgOpacity / activeCount : 0

    positions.needsUpdate = true
  }

  dispose() {
    this.particles.geometry.dispose()
    ;(this.particles.material as THREE.Material).dispose()
    this.particles.parent?.remove(this.particles)
  }
}
