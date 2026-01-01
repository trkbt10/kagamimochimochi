import * as THREE from 'three'

const DUST_PARTICLE_COUNT = 100
const DUST_LIFETIME = 2.0
const GRAVITY = -12

type DustParticleData = {
  positions: Float32Array
  velocities: Float32Array
  lifetimes: Float32Array
  sizes: Float32Array
}

/**
 * 拡張版土煙エフェクト
 * 着地時のインパクト用に、より多くのパーティクルと放射状のバースト
 */
export class ImpactDustEffect {
  private particles: THREE.Points
  private data: DustParticleData
  private floorY: number
  private baseOpacity: number = 0.9

  constructor(scene: THREE.Scene, floorY: number = -2) {
    this.floorY = floorY
    this.data = this.createDustData()

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.data.positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(this.data.sizes, 1))

    // 色を設定（茶色系のグラデーション + ハイライト）
    const colors = new Float32Array(DUST_PARTICLE_COUNT * 3)
    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      const isHighlight = Math.random() < 0.15 // 15%はハイライト
      if (isHighlight) {
        // 明るいハイライト
        colors[i * 3] = 0.95
        colors[i * 3 + 1] = 0.9
        colors[i * 3 + 2] = 0.8
      } else {
        // 茶色系グラデーション
        const brownVariation = 0.1 + Math.random() * 0.2
        colors[i * 3] = 0.55 + brownVariation
        colors[i * 3 + 1] = 0.45 + brownVariation * 0.8
        colors[i * 3 + 2] = 0.33 + brownVariation * 0.5
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.15,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: this.baseOpacity,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    this.particles = new THREE.Points(geometry, material)
    scene.add(this.particles)
  }

  private createDustData(): DustParticleData {
    const positions = new Float32Array(DUST_PARTICLE_COUNT * 3)
    const velocities = new Float32Array(DUST_PARTICLE_COUNT * 3)
    const lifetimes = new Float32Array(DUST_PARTICLE_COUNT)
    const sizes = new Float32Array(DUST_PARTICLE_COUNT)

    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -1000
      positions[i * 3 + 2] = 0
      lifetimes[i] = -1
      sizes[i] = 0.1 + Math.random() * 0.15
    }

    return { positions, velocities, lifetimes, sizes }
  }

  /**
   * 土煙を発生させる
   * @param position 発生位置
   * @param intensity 強度（0-2、デフォルト1）
   */
  emit(position: THREE.Vector3, intensity: number = 1): void {
    const clampedIntensity = Math.min(Math.max(intensity, 0), 2)
    const particlesToEmit = Math.floor(DUST_PARTICLE_COUNT * Math.min(clampedIntensity, 1))

    // 3段階のリング（内側から外側へ）
    const rings = [
      { ratio: 0.3, speedMult: 0.6, heightMult: 0.5 },
      { ratio: 0.5, speedMult: 1.0, heightMult: 1.0 },
      { ratio: 0.2, speedMult: 1.5, heightMult: 1.5 },
    ]

    let particleIndex = 0

    for (const ring of rings) {
      const ringParticles = Math.floor(particlesToEmit * ring.ratio)

      for (let i = 0; i < ringParticles && particleIndex < DUST_PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * 0.3
        const baseIndex = particleIndex * 3

        // 初期位置
        this.data.positions[baseIndex] = position.x + Math.cos(angle) * distance
        this.data.positions[baseIndex + 1] = position.y + Math.random() * 0.2
        this.data.positions[baseIndex + 2] = position.z + Math.sin(angle) * distance

        // 速度（放射状 + 上向き）
        const speed = (2 + Math.random() * 5) * clampedIntensity * ring.speedMult
        const outAngle = angle + (Math.random() - 0.5) * 0.3
        this.data.velocities[baseIndex] = Math.cos(outAngle) * speed
        this.data.velocities[baseIndex + 1] = (1.5 + Math.random() * 4) * clampedIntensity * ring.heightMult
        this.data.velocities[baseIndex + 2] = Math.sin(outAngle) * speed

        // ライフタイム（リングによって異なる）
        this.data.lifetimes[particleIndex] = DUST_LIFETIME * (0.6 + Math.random() * 0.4) * ring.speedMult

        // サイズ（外側のリングほど大きい）
        this.data.sizes[particleIndex] = (0.12 + Math.random() * 0.1) * ring.speedMult

        particleIndex++
      }
    }

    // サイズ属性を更新
    const sizeAttr = this.particles.geometry.getAttribute('size') as THREE.BufferAttribute
    sizeAttr.needsUpdate = true
  }

  /**
   * 毎フレーム更新
   */
  update(delta: number): void {
    const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    let activeCount = 0
    let totalLifeRatio = 0

    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      if (this.data.lifetimes[i] <= 0) continue

      activeCount++
      this.data.lifetimes[i] -= delta
      totalLifeRatio += this.data.lifetimes[i] / DUST_LIFETIME

      const baseIndex = i * 3

      // 空気抵抗
      this.data.velocities[baseIndex] *= 0.97
      this.data.velocities[baseIndex + 1] += GRAVITY * delta * 0.4
      this.data.velocities[baseIndex + 2] *= 0.97

      // 位置更新
      this.data.positions[baseIndex] += this.data.velocities[baseIndex] * delta
      this.data.positions[baseIndex + 1] += this.data.velocities[baseIndex + 1] * delta
      this.data.positions[baseIndex + 2] += this.data.velocities[baseIndex + 2] * delta

      // 床との衝突
      if (this.data.positions[baseIndex + 1] < this.floorY) {
        this.data.positions[baseIndex + 1] = this.floorY
        this.data.velocities[baseIndex + 1] *= -0.2 // 少しバウンス
        this.data.velocities[baseIndex] *= 0.5
        this.data.velocities[baseIndex + 2] *= 0.5
        this.data.lifetimes[i] = Math.min(this.data.lifetimes[i], 0.4)
      }

      positions.setXYZ(
        i,
        this.data.positions[baseIndex],
        this.data.positions[baseIndex + 1],
        this.data.positions[baseIndex + 2]
      )
    }

    // 不透明度をライフタイムに基づいて調整
    const material = this.particles.material as THREE.PointsMaterial
    if (activeCount > 0) {
      const avgLifeRatio = totalLifeRatio / activeCount
      material.opacity = avgLifeRatio * this.baseOpacity
    } else {
      material.opacity = 0
    }

    positions.needsUpdate = true
  }

  /**
   * リソース解放
   */
  dispose(): void {
    this.particles.geometry.dispose()
    ;(this.particles.material as THREE.Material).dispose()
    this.particles.parent?.remove(this.particles)
  }
}
