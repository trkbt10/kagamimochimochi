import * as THREE from 'three'
import { gsap } from 'gsap'

export type GodRayConfig = {
  rayCount: number       // レイの本数
  color: number          // レイの色
  intensity: number      // 強度（不透明度）
  length: number         // レイの長さ
  rotationSpeed: number  // 回転速度（rad/s）
  pulseAnimation?: boolean // パルスアニメーション
}

/**
 * ゴッドレイエフェクト
 * スプライトベースで放射状の光線を表現
 */
export class GodRayEffect {
  private rays: THREE.Mesh[] = []
  private group: THREE.Group
  private config: GodRayConfig
  private materials: THREE.MeshBasicMaterial[] = []
  private isActive: boolean = false

  constructor(config: GodRayConfig) {
    this.group = new THREE.Group()
    this.config = config

    this.createRays()

    // 初期状態は非表示
    this.group.visible = false
  }

  /**
   * レイを作成
   */
  private createRays(): void {
    const { rayCount, color, length } = this.config

    // グラデーションテクスチャを作成
    const texture = this.createGradientTexture()

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2

      // レイのジオメトリ（細長いPlane）
      const geometry = new THREE.PlaneGeometry(0.15, length)

      // マテリアル
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        map: texture,
      })
      this.materials.push(material)

      const ray = new THREE.Mesh(geometry, material)

      // 放射状に配置
      ray.rotation.z = angle

      // 中心から少しオフセット
      const offsetDistance = length / 2 + 0.5
      ray.position.x = Math.cos(angle) * offsetDistance
      ray.position.y = Math.sin(angle) * offsetDistance

      this.rays.push(ray)
      this.group.add(ray)
    }
  }

  /**
   * 中心から外へ薄くなるグラデーションテクスチャを作成
   */
  private createGradientTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    // 縦方向のグラデーション（上が透明、下が不透明）
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)')
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 256)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  /**
   * フェードインアニメーション
   */
  fadeIn(duration: number = 0.5): gsap.core.Timeline {
    const tl = gsap.timeline()

    this.group.visible = true
    this.isActive = true

    // 全レイのマテリアルをフェードイン
    this.materials.forEach((material, index) => {
      tl.to(material, {
        opacity: this.config.intensity,
        duration,
        ease: 'power2.out',
      }, index * 0.02) // 少しずつずらして出現
    })

    // パルスアニメーション（有効な場合）
    if (this.config.pulseAnimation) {
      this.startPulseAnimation()
    }

    return tl
  }

  /**
   * フェードアウトアニメーション
   */
  fadeOut(duration: number = 0.3): gsap.core.Timeline {
    const tl = gsap.timeline()

    this.materials.forEach((material) => {
      tl.to(material, {
        opacity: 0,
        duration,
        ease: 'power2.in',
      }, 0)
    })

    tl.call(() => {
      this.group.visible = false
      this.isActive = false
    })

    return tl
  }

  /**
   * パルスアニメーションを開始
   */
  private startPulseAnimation(): void {
    this.materials.forEach((material, index) => {
      gsap.to(material, {
        opacity: this.config.intensity * 1.5,
        duration: 0.5 + index * 0.03,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })
    })
  }

  /**
   * 強度を設定
   */
  setIntensity(intensity: number): void {
    this.config.intensity = intensity
    this.materials.forEach(material => {
      if (this.isActive) {
        material.opacity = intensity
      }
    })
  }

  /**
   * 色を設定
   */
  setColor(color: number): void {
    this.materials.forEach(material => {
      material.color.setHex(color)
    })
  }

  /**
   * 毎フレーム更新
   */
  update(delta: number): void {
    if (!this.isActive) return

    // 回転アニメーション
    this.group.rotation.z += this.config.rotationSpeed * delta
  }

  /**
   * グループを取得
   */
  getGroup(): THREE.Group {
    return this.group
  }

  /**
   * リソース解放
   */
  dispose(): void {
    // アニメーションを停止
    this.materials.forEach(material => {
      gsap.killTweensOf(material)
      material.dispose()
    })
    this.materials = []

    this.rays.forEach(ray => {
      ray.geometry.dispose()
    })
    this.rays = []

    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
  }
}

/**
 * スコアティア別のゴッドレイ設定
 */
export const GODRAY_TIER_CONFIGS: Record<string, GodRayConfig | null> = {
  fail: null,
  poor: null,
  average: null,
  good: {
    rayCount: 6,
    color: 0xffffff,
    intensity: 0.2,
    length: 8,
    rotationSpeed: 0.1,
    pulseAnimation: false,
  },
  excellent: {
    rayCount: 12,
    color: 0xffd700,
    intensity: 0.35,
    length: 12,
    rotationSpeed: 0.15,
    pulseAnimation: false,
  },
  perfect: {
    rayCount: 16,
    color: 0xffd700,
    intensity: 0.5,
    length: 15,
    rotationSpeed: 0.2,
    pulseAnimation: true,
  },
}
