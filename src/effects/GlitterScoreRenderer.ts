import * as THREE from 'three'
import { gsap } from 'gsap'

export type ScoreDisplayTier = 'normal' | 'silver' | 'gold' | 'rainbow'

type TierColors = {
  main: string
  highlight: string
  shadow: string
  glow: string
}

const TIER_COLORS: Record<ScoreDisplayTier, TierColors> = {
  normal: {
    main: '#FFFFFF',
    highlight: '#FFFFFF',
    shadow: '#888888',
    glow: 'rgba(255, 255, 255, 0.3)'
  },
  silver: {
    main: '#C0C0C0',
    highlight: '#FFFFFF',
    shadow: '#606060',
    glow: 'rgba(192, 192, 192, 0.5)'
  },
  gold: {
    main: '#FFD700',
    highlight: '#FFFACD',
    shadow: '#B8860B',
    glow: 'rgba(255, 215, 0, 0.6)'
  },
  rainbow: {
    main: '#FFD700',
    highlight: '#FFFFFF',
    shadow: '#FF4500',
    glow: 'rgba(255, 215, 0, 0.8)'
  }
}

function getDisplayTier(score: number): ScoreDisplayTier {
  if (score >= 95) return 'rainbow'
  if (score >= 80) return 'gold'
  if (score >= 60) return 'silver'
  return 'normal'
}

function getResponsiveScaleFactor(): number {
  const width = window.innerWidth
  if (width < 480) return 0.6
  if (width < 768) return 0.8
  return 1
}

function create3DTextCanvas(
  text: string,
  tier: ScoreDisplayTier,
  fontSize: number = 144
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const padding = 60

  ctx.font = `bold ${fontSize}px sans-serif`
  const textMetrics = ctx.measureText(text)
  const textWidth = textMetrics.width
  const textHeight = fontSize * 1.3

  canvas.width = (textWidth + padding * 2) * dpr
  canvas.height = (textHeight + padding * 2) * dpr
  ctx.scale(dpr, dpr)

  const width = textWidth + padding * 2
  const height = textHeight + padding * 2
  const centerX = width / 2
  const centerY = height / 2

  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const colors = TIER_COLORS[tier]

  if (tier === 'gold' || tier === 'rainbow') {
    ctx.shadowColor = colors.glow
    ctx.shadowBlur = 40
    ctx.fillStyle = colors.main
    ctx.fillText(text, centerX, centerY)
    ctx.shadowBlur = 0
  }

  for (let i = 6; i >= 1; i--) {
    ctx.fillStyle = colors.shadow
    ctx.fillText(text, centerX + i * 0.8, centerY + i * 0.8)
  }

  if (tier === 'gold' || tier === 'rainbow') {
    const gradient = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY + fontSize / 2)

    if (tier === 'rainbow') {
      gradient.addColorStop(0, '#FF6B6B')
      gradient.addColorStop(0.2, '#FFD93D')
      gradient.addColorStop(0.4, '#6BCB77')
      gradient.addColorStop(0.6, '#4D96FF')
      gradient.addColorStop(0.8, '#9B59B6')
      gradient.addColorStop(1, '#FF6B6B')
    } else {
      gradient.addColorStop(0, '#FFFACD')
      gradient.addColorStop(0.25, '#FFD700')
      gradient.addColorStop(0.5, '#DAA520')
      gradient.addColorStop(0.75, '#FFD700')
      gradient.addColorStop(1, '#B8860B')
    }

    ctx.fillStyle = gradient
    ctx.fillText(text, centerX, centerY)

    ctx.strokeStyle = colors.shadow
    ctx.lineWidth = 3
    ctx.strokeText(text, centerX, centerY)

    const highlightGradient = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY - fontSize / 4)
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = highlightGradient
    ctx.fillText(text, centerX, centerY)

  } else if (tier === 'silver') {
    const gradient = ctx.createLinearGradient(0, centerY - fontSize / 2, 0, centerY + fontSize / 2)
    gradient.addColorStop(0, '#FFFFFF')
    gradient.addColorStop(0.3, '#C0C0C0')
    gradient.addColorStop(0.5, '#A0A0A0')
    gradient.addColorStop(0.7, '#C0C0C0')
    gradient.addColorStop(1, '#808080')

    ctx.fillStyle = gradient
    ctx.fillText(text, centerX, centerY)

    ctx.strokeStyle = colors.shadow
    ctx.lineWidth = 2
    ctx.strokeText(text, centerX, centerY)

  } else {
    ctx.fillStyle = colors.main
    ctx.fillText(text, centerX, centerY)
  }

  return canvas
}

export class GlitterScoreRenderer {
  private scene: THREE.Scene
  private scoreGroup: THREE.Group
  private lightParticles: THREE.Points | null = null
  private lightRays: THREE.Mesh[] = []
  private currentTier: ScoreDisplayTier = 'normal'

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scoreGroup = new THREE.Group()
    this.scene.add(this.scoreGroup)
  }

  createScoreDisplay(score: number): THREE.Sprite {
    this.currentTier = getDisplayTier(score)

    const canvas = create3DTextCanvas(score.toString(), this.currentTier)
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })

    const sprite = new THREE.Sprite(material)
    const aspect = canvas.width / canvas.height
    const scaleFactor = getResponsiveScaleFactor()
    const baseScale = 4 * scaleFactor
    sprite.scale.set(baseScale * aspect, baseScale, 1)
    this.scoreGroup.add(sprite)

    if (this.currentTier === 'gold' || this.currentTier === 'rainbow') {
      this.addGlitterParticles()
      this.addLightRays()
    }

    return sprite
  }

  updateScore(score: number): THREE.Sprite | null {
    this.dispose()
    this.scoreGroup = new THREE.Group()
    this.scene.add(this.scoreGroup)

    return this.createScoreDisplay(score)
  }

  private addGlitterParticles() {
    const count = this.currentTier === 'rainbow' ? 80 : 50
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3
      positions[i * 3 + 2] = Math.random() * 0.5 + 0.1

      if (this.currentTier === 'rainbow') {
        const hue = Math.random()
        const color = new THREE.Color().setHSL(hue, 1, 0.6)
        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      } else {
        colors[i * 3] = 1
        colors[i * 3 + 1] = 0.84 + Math.random() * 0.16
        colors[i * 3 + 2] = 0
      }

      sizes[i] = 0.05 + Math.random() * 0.1
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.userData = { originalPositions: positions.slice(), time: 0 }

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    this.lightParticles = new THREE.Points(geometry, material)
    this.scoreGroup.add(this.lightParticles)
  }

  private addLightRays() {
    const rayCount = 8
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2
      const geometry = new THREE.PlaneGeometry(0.08, 4)
      const material = new THREE.MeshBasicMaterial({
        color: this.currentTier === 'rainbow' ? 0xffffff : 0xffd700,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })

      const ray = new THREE.Mesh(geometry, material)
      ray.rotation.z = angle
      ray.position.z = -0.2
      this.scoreGroup.add(ray)
      this.lightRays.push(ray)

      gsap.to(ray.rotation, {
        z: angle + Math.PI * 2,
        duration: 6,
        repeat: -1,
        ease: 'none'
      })

      if (this.currentTier === 'rainbow') {
        gsap.to(material, {
          opacity: 0.4,
          duration: 0.5,
          yoyo: true,
          repeat: -1,
          ease: 'power1.inOut'
        })
      }
    }
  }

  update(delta: number) {
    if (this.lightParticles) {
      const positions = this.lightParticles.geometry.getAttribute('position') as THREE.BufferAttribute
      const original = this.lightParticles.geometry.userData.originalPositions as Float32Array
      const time = (this.lightParticles.geometry.userData.time as number) + delta
      this.lightParticles.geometry.userData.time = time

      for (let i = 0; i < positions.count; i++) {
        const baseX = original[i * 3]
        const baseY = original[i * 3 + 1]

        positions.setX(i, baseX + Math.sin(time * 2 + i * 0.5) * 0.1)
        positions.setY(i, baseY + Math.cos(time * 1.5 + i * 0.3) * 0.1)
      }
      positions.needsUpdate = true
    }
  }

  getGroup(): THREE.Group {
    return this.scoreGroup
  }

  dispose() {
    if (this.lightParticles) {
      this.lightParticles.geometry.dispose()
      ;(this.lightParticles.material as THREE.Material).dispose()
      this.scoreGroup.remove(this.lightParticles)
      this.lightParticles = null
    }

    for (const ray of this.lightRays) {
      gsap.killTweensOf(ray.rotation)
      gsap.killTweensOf(ray.material)
      ray.geometry.dispose()
      ;(ray.material as THREE.Material).dispose()
      this.scoreGroup.remove(ray)
    }
    this.lightRays = []

    for (const child of [...this.scoreGroup.children]) {
      if (child instanceof THREE.Sprite) {
        const material = child.material as THREE.SpriteMaterial
        if (material.map) material.map.dispose()
        material.dispose()
      }
      this.scoreGroup.remove(child)
    }

    this.scene.remove(this.scoreGroup)
  }
}
