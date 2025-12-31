import * as THREE from 'three'

export type SnowEffectOptions = {
  count?: number
  areaWidth?: number
  areaHeight?: number
  areaDepth?: number
  fallSpeed?: number
  windStrength?: number
}

const DEFAULT_OPTIONS: Required<SnowEffectOptions> = {
  count: 250,
  areaWidth: 60,
  areaHeight: 30,
  areaDepth: 60,
  fallSpeed: 1.5,
  windStrength: 0.3
}

export class SnowEffect {
  private particles: THREE.Points
  private geometry: THREE.BufferGeometry
  private material: THREE.PointsMaterial
  private velocities: Float32Array
  private options: Required<SnowEffectOptions>
  private time = 0

  constructor(options: SnowEffectOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }

    this.geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(this.options.count * 3)
    this.velocities = new Float32Array(this.options.count)

    for (let i = 0; i < this.options.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.options.areaWidth
      positions[i * 3 + 1] = Math.random() * this.options.areaHeight
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.options.areaDepth

      this.velocities[i] = 0.5 + Math.random() * 0.5
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    this.material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.particles = new THREE.Points(this.geometry, this.material)
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.particles)
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.particles)
  }

  update(delta: number) {
    this.time += delta

    const positions = this.geometry.attributes.position.array as Float32Array
    const { areaWidth, areaHeight, areaDepth, fallSpeed, windStrength } = this.options

    for (let i = 0; i < this.options.count; i++) {
      const i3 = i * 3
      const velocity = this.velocities[i]

      positions[i3 + 1] -= velocity * fallSpeed * delta

      const windX = Math.sin(this.time * 0.5 + i * 0.1) * windStrength
      const windZ = Math.cos(this.time * 0.3 + i * 0.15) * windStrength * 0.5
      positions[i3] += windX * delta
      positions[i3 + 2] += windZ * delta

      if (positions[i3 + 1] < -2) {
        positions[i3 + 1] = areaHeight
        positions[i3] = (Math.random() - 0.5) * areaWidth
        positions[i3 + 2] = (Math.random() - 0.5) * areaDepth
      }

      if (positions[i3] > areaWidth / 2) positions[i3] = -areaWidth / 2
      if (positions[i3] < -areaWidth / 2) positions[i3] = areaWidth / 2
      if (positions[i3 + 2] > areaDepth / 2) positions[i3 + 2] = -areaDepth / 2
      if (positions[i3 + 2] < -areaDepth / 2) positions[i3 + 2] = areaDepth / 2
    }

    this.geometry.attributes.position.needsUpdate = true
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }

  setOpacity(opacity: number) {
    this.material.opacity = opacity
  }
}
