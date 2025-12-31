import * as THREE from 'three'
import { gsap } from 'gsap'

type CutInOptions = {
  fontSize?: number
  textColor?: string
  glowColor?: string
  shadowColor?: string
}

function getResponsiveFontSize(): number {
  const width = window.innerWidth
  if (width < 480) return 60
  if (width < 768) return 80
  return 100
}

const DEFAULT_OPTIONS: Required<CutInOptions> = {
  fontSize: 100,
  textColor: '#FFFFFF',
  glowColor: '#FFD700',
  shadowColor: '#000000'
}

function createGlitterTextCanvas(text: string, options: Required<CutInOptions>): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const padding = 60

  ctx.font = `bold ${options.fontSize}px sans-serif`
  const textMetrics = ctx.measureText(text)
  const textWidth = textMetrics.width
  const textHeight = options.fontSize * 1.3

  canvas.width = (textWidth + padding * 2) * dpr
  canvas.height = (textHeight + padding * 2) * dpr
  ctx.scale(dpr, dpr)

  const width = textWidth + padding * 2
  const height = textHeight + padding * 2
  const centerX = width / 2
  const centerY = height / 2

  ctx.font = `bold ${options.fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // ドロップシャドウ（複数レイヤーで深み）
  ctx.shadowColor = options.shadowColor
  ctx.shadowBlur = 20
  ctx.shadowOffsetX = 6
  ctx.shadowOffsetY = 6
  ctx.fillStyle = options.shadowColor
  ctx.fillText(text, centerX, centerY)

  // グロー効果
  ctx.shadowColor = options.glowColor
  ctx.shadowBlur = 30
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = options.glowColor
  ctx.fillText(text, centerX, centerY)

  // メイン金属グラデーション
  ctx.shadowBlur = 0
  const gradient = ctx.createLinearGradient(0, centerY - options.fontSize / 2, 0, centerY + options.fontSize / 2)
  gradient.addColorStop(0, '#FFFACD')
  gradient.addColorStop(0.2, '#FFD700')
  gradient.addColorStop(0.4, '#FFA500')
  gradient.addColorStop(0.6, '#FFD700')
  gradient.addColorStop(0.8, '#FFFACD')
  gradient.addColorStop(1, '#DAA520')

  ctx.fillStyle = gradient
  ctx.fillText(text, centerX, centerY)

  // 縁取り
  ctx.strokeStyle = '#B8860B'
  ctx.lineWidth = 3
  ctx.strokeText(text, centerX, centerY)

  // ハイライト（上部光沢）
  const highlightGradient = ctx.createLinearGradient(0, centerY - options.fontSize / 2, 0, centerY)
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)')
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = highlightGradient
  ctx.fillText(text, centerX, centerY)

  return canvas
}

export class CutInText {
  private sprite: THREE.Sprite | null = null
  private material: THREE.SpriteMaterial | null = null
  private scene: THREE.Scene
  private timeline: gsap.core.Timeline | null = null
  private onCompleteCallback: (() => void) | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  show(
    text: string,
    camera: THREE.Camera,
    options: CutInOptions = {},
    onComplete?: () => void
  ) {
    this.hide()
    this.onCompleteCallback = onComplete || null

    const responsiveFontSize = getResponsiveFontSize()
    const mergedOptions = { ...DEFAULT_OPTIONS, fontSize: responsiveFontSize, ...options }
    const canvas = createGlitterTextCanvas(text, mergedOptions)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    this.material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false
    })

    this.sprite = new THREE.Sprite(this.material)

    const aspect = canvas.width / canvas.height
    const baseScale = window.innerWidth < 768 ? 2.5 : 3.5
    this.sprite.scale.set(baseScale * aspect, baseScale, 1)

    this.updatePositionToCamera(camera)
    this.scene.add(this.sprite)

    this.playAnimation()
  }

  private updatePositionToCamera(camera: THREE.Camera) {
    if (!this.sprite) return

    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(camera.quaternion)

    this.sprite.position.copy(camera.position)
    this.sprite.position.add(forward.multiplyScalar(4))
    this.sprite.quaternion.copy(camera.quaternion)
  }

  private playAnimation() {
    if (!this.sprite || !this.material) return

    const originalScale = this.sprite.scale.clone()

    this.sprite.scale.set(0, 0, 0)

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.hide()
        this.onCompleteCallback?.()
      }
    })

    this.timeline
      // フェードイン + スケールイン
      .to(this.material, {
        opacity: 1,
        duration: 0.15,
        ease: 'power2.out'
      })
      .to(
        this.sprite.scale,
        {
          x: originalScale.x * 1.1,
          y: originalScale.y * 1.1,
          z: 1,
          duration: 0.15,
          ease: 'back.out(2)'
        },
        0
      )
      // バウンス
      .to(this.sprite.scale, {
        x: originalScale.x,
        y: originalScale.y,
        duration: 0.1,
        ease: 'power2.out'
      })
      // 表示維持
      .to({}, { duration: 0.5 })
      // フェードアウト
      .to(this.material, {
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in'
      })
      .to(
        this.sprite.scale,
        {
          x: originalScale.x * 0.8,
          y: originalScale.y * 0.8,
          duration: 0.25,
          ease: 'power2.in'
        },
        '-=0.25'
      )
  }

  hide() {
    if (this.timeline) {
      this.timeline.kill()
      this.timeline = null
    }

    if (this.sprite) {
      this.scene.remove(this.sprite)
      this.sprite = null
    }

    if (this.material) {
      if (this.material.map) {
        this.material.map.dispose()
      }
      this.material.dispose()
      this.material = null
    }
  }

  dispose() {
    this.hide()
  }
}
