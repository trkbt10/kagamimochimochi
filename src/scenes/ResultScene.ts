import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import type { LayoutInfo } from '../core/layout'
import { redistributeParticles, calculateLayoutScale } from '../core/layout'
import { createTextSprite } from '../ui/text-sprite'
import { Button3D } from '../ui/button-3d'
import { createConfettiSystem, updateConfetti } from '../ui/confetti'

type ScoreTier = 'perfect' | 'excellent' | 'good' | 'average' | 'poor' | 'fail'

type ScoreTierConfig = {
  minScore: number
  emoji: string
  text: string
  bgColor: number
  accentLightColor: number
  particleColor: THREE.Vector3
  isSuccess: boolean
}

const SCORE_TIER_CONFIGS: Record<ScoreTier, ScoreTierConfig> = {
  perfect: {
    minScore: 100,
    emoji: '🎊🏆🎊',
    text: '完璧！神業です！',
    bgColor: 0x1a0a2a,
    accentLightColor: 0xffd700,
    particleColor: new THREE.Vector3(1, 0.84, 0),
    isSuccess: true
  },
  excellent: {
    minScore: 80,
    emoji: '🎉✨',
    text: '素晴らしい！見事な鏡餅！',
    bgColor: 0x1a0a2a,
    accentLightColor: 0xffd700,
    particleColor: new THREE.Vector3(1, 0.84, 0),
    isSuccess: true
  },
  good: {
    minScore: 60,
    emoji: '😊👍',
    text: 'まあまあ！惜しい！',
    bgColor: 0x1a1a0a,
    accentLightColor: 0xffffff,
    particleColor: new THREE.Vector3(0.8, 0.8, 0.8),
    isSuccess: false
  },
  average: {
    minScore: 40,
    emoji: '😅',
    text: 'うーん...もう一回！',
    bgColor: 0x1a1a0a,
    accentLightColor: 0xffffff,
    particleColor: new THREE.Vector3(0.8, 0.8, 0.8),
    isSuccess: false
  },
  poor: {
    minScore: 20,
    emoji: '😢',
    text: 'ヤバイ...修行が必要',
    bgColor: 0x2a0a0a,
    accentLightColor: 0xff3333,
    particleColor: new THREE.Vector3(0.5, 0.5, 0.5),
    isSuccess: false
  },
  fail: {
    minScore: 0,
    emoji: '💀',
    text: '鏡餅崩壊...あけましておめでとう！',
    bgColor: 0x2a0a0a,
    accentLightColor: 0xff3333,
    particleColor: new THREE.Vector3(0.5, 0.5, 0.5),
    isSuccess: false
  }
}

const TIER_ORDER: ScoreTier[] = ['perfect', 'excellent', 'good', 'average', 'poor', 'fail']

export function getScoreTier(score: number): ScoreTier {
  for (const tier of TIER_ORDER) {
    if (score >= SCORE_TIER_CONFIGS[tier].minScore) {
      return tier
    }
  }
  return 'fail'
}

export function getScoreTierConfig(score: number): ScoreTierConfig {
  return SCORE_TIER_CONFIGS[getScoreTier(score)]
}

export class ResultScene extends BaseScene {
  private score = 0
  private particles: THREE.Points | null = null
  private kagamimochi: THREE.Group | null = null
  private confetti: THREE.Points | null = null

  // UI要素
  private uiGroup: THREE.Group | null = null
  private scoreLabelSprite: THREE.Sprite | null = null
  private scoreSprite: THREE.Sprite | null = null
  private ratingSprite: THREE.Sprite | null = null
  private ratingTextSprite: THREE.Sprite | null = null
  private backButton: Button3D | null = null
  private shareButton: Button3D | null = null

  // Raycaster
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hoveredButton: Button3D | null = null

  // イベントハンドラ
  private boundOnPointerMove: (e: PointerEvent) => void
  private boundOnPointerDown: (e: PointerEvent) => void
  private boundOnPointerUp: (e: PointerEvent) => void

  // アニメーション用
  private displayedScore = 0

  constructor(game: Game) {
    super(game)
    this.boundOnPointerMove = this.onPointerMove.bind(this)
    this.boundOnPointerDown = this.onPointerDown.bind(this)
    this.boundOnPointerUp = this.onPointerUp.bind(this)
  }

  async enter(data?: Record<string, unknown>) {
    this.score = (data?.score as number) ?? 0
    this.displayedScore = 0

    this.setupScene()
    this.buildUI3D()
    this.setupEventListeners()
    this.registerLayoutListener()
    this.playResultAnimation()

    const tierConfig = getScoreTierConfig(this.score)
    this.playResultAudio(tierConfig.isSuccess)
  }

  private playResultAudio(isSuccess: boolean) {
    if (isSuccess) {
      this.game.audioManager.playSuccess()
      this.spawnConfetti()
      return
    }
    this.game.audioManager.playFail()
  }

  async exit() {
    this.removeEventListeners()
    this.unregisterLayoutListener()
    this.clearScene()
  }

  update(delta: number) {
    if (this.particles) {
      this.particles.rotation.y += delta * 0.2
    }

    if (this.kagamimochi) {
      this.kagamimochi.rotation.y += delta * 0.5
    }

    // 紙吹雪のアニメーション
    if (this.confetti) {
      updateConfetti(this.confetti, delta)
    }

    // UIをカメラに向ける
    if (this.uiGroup) {
      this.uiGroup.lookAt(this.game.camera.position)
    }
  }

  private setupScene() {
    const tierConfig = getScoreTierConfig(this.score)

    this.scene.background = new THREE.Color(tierConfig.bgColor)
    this.scene.fog = new THREE.FogExp2(tierConfig.bgColor, 0.05)

    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambient)

    const spotlight = new THREE.SpotLight(0xffd700, 2, 30, Math.PI / 4, 0.5)
    spotlight.position.set(0, 15, 5)
    this.scene.add(spotlight)

    const accentLight = new THREE.PointLight(tierConfig.accentLightColor, 1, 20)
    accentLight.position.set(0, 5, 5)
    this.scene.add(accentLight)

    this.createParticles()
    this.createResultKagamimochi()
  }

  private createParticles() {
    const tierConfig = getScoreTierConfig(this.score)
    const count = 300
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = Math.random() * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30

      colors[i * 3] = tierConfig.particleColor.x
      colors[i * 3 + 1] = tierConfig.particleColor.y
      colors[i * 3 + 2] = tierConfig.particleColor.z
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    })

    this.particles = new THREE.Points(geometry, material)
    this.scene.add(this.particles)
  }

  private createResultKagamimochi() {
    this.kagamimochi = new THREE.Group()

    // Create a visual representation based on score
    const mochiMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8e7,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: this.score >= 30 ? 1 : 0.3
    })

    // Base mochi（下が広い鏡餅型）
    const baseGeometry = this.createMochiGeometry(1.5, 0.75)
    const baseMochi = new THREE.Mesh(baseGeometry, mochiMaterial)
    baseMochi.position.y = -0.5

    // Offset based on score (lower score = more offset)
    const baseOffset = this.score >= 30 ? 0 : (100 - this.score) * 0.02
    baseMochi.position.x = baseOffset * (Math.random() - 0.5)
    baseMochi.position.z = baseOffset * (Math.random() - 0.5)
    this.kagamimochi.add(baseMochi)

    // Top mochi（下が広い鏡餅型）
    const topGeometry = this.createMochiGeometry(1.1, 0.55)
    const topMochiMaterial = mochiMaterial.clone()
    topMochiMaterial.opacity = this.score >= 60 ? 1 : 0.3
    const topMochi = new THREE.Mesh(topGeometry, topMochiMaterial)
    topMochi.position.y = 0.3

    const topOffset = this.score >= 60 ? 0 : (100 - this.score) * 0.03
    topMochi.position.x = topOffset * (Math.random() - 0.5)
    topMochi.position.z = topOffset * (Math.random() - 0.5)
    this.kagamimochi.add(topMochi)

    // Mikan
    const mikanGeometry = new THREE.SphereGeometry(0.5, 32, 24)
    const mikanMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.8,
      transparent: true,
      opacity: this.score >= 80 ? 1 : 0.3
    })
    const mikan = new THREE.Mesh(mikanGeometry, mikanMaterial)
    mikan.position.y = 1

    const mikanOffset = this.score >= 80 ? 0 : (100 - this.score) * 0.04
    mikan.position.x = mikanOffset * (Math.random() - 0.5)
    mikan.position.z = mikanOffset * (Math.random() - 0.5)
    this.kagamimochi.add(mikan)

    this.kagamimochi.position.y = 2
    this.scene.add(this.kagamimochi)
  }

  /**
   * お餅らしい形状を作成（下が広く上が丸い鏡餅型）
   */
  private createMochiGeometry(radius: number, height: number): THREE.BufferGeometry {
    const points: THREE.Vector2[] = []
    const segments = 16

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const topRadius = radius * 0.65
      const ease = t * t * (3 - 2 * t)
      const r = radius - (radius - topRadius) * ease
      const y = -height / 2 + height * t
      points.push(new THREE.Vector2(r, y))
    }
    points.push(new THREE.Vector2(0, height / 2))

    return new THREE.LatheGeometry(points, 32)
  }

  private buildUI3D() {
    this.uiGroup = new THREE.Group()
    this.uiGroup.position.set(0, 4, 4)
    this.scene.add(this.uiGroup)

    const rating = this.getRating()

    // スコアラベル
    this.scoreLabelSprite = createTextSprite({
      text: 'YOUR SCORE',
      fontSize: 36,
      color: '#ffffff'
    })
    this.scoreLabelSprite.position.set(0, 2.5, 0)
    this.uiGroup.add(this.scoreLabelSprite)

    // スコア表示
    this.scoreSprite = createTextSprite({
      text: '0',
      fontSize: 120,
      color: '#FFD700',
      glowColor: '#FFD700',
      glowBlur: 30,
      shadowColor: '#FFA500',
      shadowBlur: 10
    })
    this.scoreSprite.position.set(0, 1.5, 0)
    this.scoreSprite.scale.multiplyScalar(2)
    this.uiGroup.add(this.scoreSprite)

    // 評価絵文字
    this.ratingSprite = createTextSprite({
      text: rating.emoji,
      fontSize: 72,
      color: '#ffffff'
    })
    this.ratingSprite.position.set(0, 0.3, 0)
    this.ratingSprite.scale.set(0, 0, 0) // アニメーション用に初期化
    this.uiGroup.add(this.ratingSprite)

    // 評価テキスト
    this.ratingTextSprite = createTextSprite({
      text: rating.text,
      fontSize: 32,
      color: '#ffffff',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })
    this.ratingTextSprite.position.set(0, -0.3, 0)
    this.ratingTextSprite.material.opacity = 0 // アニメーション用に初期化
    this.uiGroup.add(this.ratingTextSprite)

    // シェアボタン
    this.shareButton = new Button3D({
      text: 'Xでシェア',
      width: 2.5,
      height: 0.6,
      fontSize: 28,
      backgroundColor: 0x000000,
      hoverColor: 0x333333,
      activeColor: 0x111111,
      borderColor: 0x444444,
      textColor: '#ffffff',
      onClick: () => {
        this.shareToTwitter()
      }
    })
    this.shareButton.position.set(0, -1.3, 0)
    this.uiGroup.add(this.shareButton)

    // タイトルに戻るボタン
    this.backButton = new Button3D({
      text: 'タイトルに戻る',
      width: 3,
      height: 0.7,
      fontSize: 32,
      onClick: () => {
        this.game.audioManager.playClick()
        this.game.sceneManager.switchTo('intro')
      }
    })
    this.backButton.position.set(0, -2.3, 0)
    this.uiGroup.add(this.backButton)
  }

  private getRating(): { emoji: string; text: string } {
    const config = getScoreTierConfig(this.score)
    return { emoji: config.emoji, text: config.text }
  }

  private setupEventListeners() {
    const canvas = this.game.renderer.domElement
    canvas.addEventListener('pointermove', this.boundOnPointerMove)
    canvas.addEventListener('pointerdown', this.boundOnPointerDown)
    canvas.addEventListener('pointerup', this.boundOnPointerUp)
  }

  private removeEventListeners() {
    const canvas = this.game.renderer.domElement
    canvas.removeEventListener('pointermove', this.boundOnPointerMove)
    canvas.removeEventListener('pointerdown', this.boundOnPointerDown)
    canvas.removeEventListener('pointerup', this.boundOnPointerUp)
  }

  private updateMousePosition(e: PointerEvent) {
    const rect = this.game.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  private onPointerMove(e: PointerEvent) {
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    const buttons = this.getInteractiveButtons()
    const intersects = this.raycaster.intersectObjects(buttons.map(b => b.getMesh()))

    // 以前のホバー状態をクリア
    if (this.hoveredButton) {
      this.hoveredButton.setHovered(false)
      this.hoveredButton = null
    }

    if (intersects.length > 0) {
      const button = intersects[0].object.userData.button as Button3D | undefined
      if (button) {
        button.setHovered(true)
        this.hoveredButton = button
        this.game.renderer.domElement.style.cursor = 'pointer'
      }
    } else {
      this.game.renderer.domElement.style.cursor = 'default'
    }
  }

  private onPointerDown(e: PointerEvent) {
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    const buttons = this.getInteractiveButtons()
    const intersects = this.raycaster.intersectObjects(buttons.map(b => b.getMesh()))

    if (intersects.length > 0) {
      const button = intersects[0].object.userData.button as Button3D | undefined
      if (button) {
        button.setPressed(true)
      }
    }
  }

  private onPointerUp(e: PointerEvent) {
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    const buttons = this.getInteractiveButtons()
    const intersects = this.raycaster.intersectObjects(buttons.map(b => b.getMesh()))

    // すべてのボタンの押下状態をクリア
    buttons.forEach(b => b.setPressed(false))

    if (intersects.length > 0) {
      const button = intersects[0].object.userData.button as Button3D | undefined
      if (button && button.onClick) {
        button.onClick()
      }
    }
  }

  private getInteractiveButtons(): Button3D[] {
    const buttons: Button3D[] = []
    if (this.shareButton) buttons.push(this.shareButton)
    if (this.backButton) buttons.push(this.backButton)
    return buttons
  }

  private shareToTwitter() {
    const rating = this.getRating()
    const text = `🎍 鏡餅スタッキングゲーム 🎍\n\nスコア: ${this.score}点\n${rating.emoji} ${rating.text}\n\n#鏡餅スタッキング #あけおめ`
    const url = encodeURIComponent(window.location.href)
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`
    window.open(tweetUrl, '_blank')
  }

  private playResultAnimation() {
    // スコアカウントアップアニメーション
    const animationObj = { val: 0 }
    gsap.to(animationObj, {
      val: this.score,
      duration: 2,
      ease: 'power2.out',
      onUpdate: () => {
        this.displayedScore = Math.round(animationObj.val)
        this.updateScoreDisplay()
      }
    })

    // 評価の表示アニメーション
    if (this.ratingSprite) {
      gsap.to(this.ratingSprite.scale, {
        x: 1.5,
        y: 1.5,
        z: 1,
        duration: 0.5,
        delay: 1.5,
        ease: 'elastic.out(1, 0.5)'
      })
    }

    // 評価テキストのフェードイン
    if (this.ratingTextSprite) {
      gsap.to(this.ratingTextSprite.material, {
        opacity: 1,
        duration: 0.5,
        delay: 2
      })
    }

    // 鏡餅のアニメーション
    if (this.kagamimochi) {
      gsap.from(this.kagamimochi.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        ease: 'elastic.out(1, 0.5)'
      })
    }

    // カメラアニメーション
    gsap.from(this.game.camera.position, {
      z: 20,
      y: 10,
      duration: 1.5,
      ease: 'power2.out'
    })

    // UIグループのアニメーション
    if (this.uiGroup) {
      gsap.from(this.uiGroup.position, {
        y: 10,
        duration: 1.2,
        delay: 0.3,
        ease: 'elastic.out(1, 0.7)'
      })
    }
  }

  private updateScoreDisplay() {
    if (this.scoreSprite && this.uiGroup) {
      // 既存のスコアスプライトを削除
      this.uiGroup.remove(this.scoreSprite)

      // 新しいスコアスプライトを作成
      this.scoreSprite = createTextSprite({
        text: this.displayedScore.toString(),
        fontSize: 120,
        color: '#FFD700',
        glowColor: '#FFD700',
        glowBlur: 30,
        shadowColor: '#FFA500',
        shadowBlur: 10
      })
      this.scoreSprite.position.set(0, 1.5, 0)
      this.scoreSprite.scale.multiplyScalar(2)
      this.uiGroup.add(this.scoreSprite)
    }
  }

  private spawnConfetti() {
    this.confetti = createConfettiSystem(300)
    this.scene.add(this.confetti)
  }

  /**
   * レイアウト変更時の調整
   */
  protected adjustLayout(layout: LayoutInfo): void {
    // UIグループのスケールを調整
    if (this.uiGroup) {
      const scale = calculateLayoutScale(layout, 0.6)
      this.uiGroup.scale.setScalar(scale)
    }

    // パーティクルを装飾領域に拡張
    if (this.particles) {
      redistributeParticles(this.particles, layout, {
        baseWidth: 30,
        baseHeight: 20,
        baseDepth: 30,
        yOffset: 0,
      })
    }

    // 紙吹雪も装飾領域に拡張
    if (this.confetti) {
      redistributeParticles(this.confetti, layout, {
        baseWidth: 20,
        baseHeight: 15,
        baseDepth: 10,
        yOffset: 5,
      })
    }
  }
}
