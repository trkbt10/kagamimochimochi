import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import type { LayoutInfo } from '../core/layout'
import { redistributeParticles, calculateLayoutScale } from '../core/layout'
import { createTextSprite } from '../ui/text-sprite'
import { ExtrudedButton3D } from '../ui/extruded-button-3d'
import { createConfettiSystem, updateConfetti } from '../ui/confetti'
import { PhysicsContext, DecorativeMochiGroup } from '../objects'
import { SceneLighting, ScoreRevealOrchestrator } from '../effects'
import type { ScoreTier as OrchestratorScoreTier } from '../effects'
import { SkyGradient } from '../effects/SkyGradient'
import { SnowEffect } from '../effects/SnowEffect'
import { MountainFuji } from '../objects/MountainFuji'
import type { GameMode } from '../types/game-mode'
import type { NormalResultData, EndlessResultData, GameToResultData } from '../types/scene-data'
import { GameProgressManager } from '../systems/GameProgressManager'

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
  private physicsContext: PhysicsContext | null = null
  private decorativeMochi: DecorativeMochiGroup | null = null
  private confetti: THREE.Points | null = null

  // ゲームモード関連
  private gameMode: GameMode = 'normal'
  private resultData: GameToResultData | null = null

  // お正月演出
  private skyGradient: SkyGradient | null = null
  private sceneLighting: SceneLighting | null = null
  private snowEffect: SnowEffect | null = null
  private mountain: MountainFuji | null = null

  // UI要素
  private uiGroup: THREE.Group | null = null
  private ratingSprite: THREE.Sprite | null = null
  private ratingTextSprite: THREE.Sprite | null = null
  private backButton: ExtrudedButton3D | null = null
  private shareButton: ExtrudedButton3D | null = null
  private endlessStatsSprite: THREE.Sprite | null = null

  // Raycaster
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hoveredButton: ExtrudedButton3D | null = null

  // イベントハンドラ
  private boundOnPointerMove: (e: PointerEvent) => void
  private boundOnPointerDown: (e: PointerEvent) => void
  private boundOnPointerUp: (e: PointerEvent) => void

  // ド派手スコア演出オーケストレーター
  private scoreRevealOrchestrator: ScoreRevealOrchestrator | null = null

  constructor(game: Game) {
    super(game)
    this.boundOnPointerMove = this.onPointerMove.bind(this)
    this.boundOnPointerDown = this.onPointerDown.bind(this)
    this.boundOnPointerUp = this.onPointerUp.bind(this)
  }

  async enter(data?: Record<string, unknown>) {
    // ゲームモードとデータを解析
    this.gameMode = (data?.mode as GameMode) ?? 'normal'
    this.resultData = data as GameToResultData | null

    if (this.gameMode === 'normal') {
      this.score = (data as NormalResultData)?.score ?? 0

      // 通常モードで100点達成時にエンドレスモードを解放
      if (this.score >= 100) {
        const progressManager = GameProgressManager.getInstance()
        progressManager.unlockEndless()
      }
    } else {
      // エンドレスモードでは高さをスコア的に表示
      const endlessData = data as EndlessResultData
      this.score = Math.round((endlessData?.maxHeight ?? 0) * 10)
    }

    // カメラ位置を明示的にリセット
    this.resetCamera()

    this.setupScene()
    this.buildUI3D()
    this.setupEventListeners()
    this.registerLayoutListener()
    this.playResultAnimation()

    const tierConfig = this.getResultTierConfig()
    this.playResultAudio(tierConfig.isSuccess)
  }

  /**
   * モードに応じた結果判定を取得
   */
  private getResultTierConfig(): ScoreTierConfig {
    if (this.gameMode === 'endless') {
      const endlessData = this.resultData as EndlessResultData
      const height = endlessData?.maxHeight ?? 0

      // エンドレスモード用の評価基準
      if (height >= 5) return SCORE_TIER_CONFIGS.perfect
      if (height >= 3) return SCORE_TIER_CONFIGS.excellent
      if (height >= 2) return SCORE_TIER_CONFIGS.good
      if (height >= 1) return SCORE_TIER_CONFIGS.average
      return SCORE_TIER_CONFIGS.poor
    }

    return getScoreTierConfig(this.score)
  }

  private resetCamera() {
    this.game.camera.position.set(0, 5, 12)
    this.game.camera.lookAt(0, 2, 0)
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

    // スコア演出のクリーンアップ
    this.scoreRevealOrchestrator?.dispose()
    this.scoreRevealOrchestrator = null

    // お正月演出のクリーンアップ
    this.skyGradient?.dispose()
    this.sceneLighting?.dispose()
    this.snowEffect?.dispose()
    this.mountain?.dispose()
    this.skyGradient = null
    this.sceneLighting = null
    this.snowEffect = null
    this.mountain = null

    // 鏡餅のクリーンアップ
    this.decorativeMochi?.dispose()
    this.physicsContext?.dispose()
    this.decorativeMochi = null
    this.physicsContext = null

    this.clearScene()
  }

  update(delta: number) {
    // 空と雪のアニメーション
    this.skyGradient?.update(delta)
    this.snowEffect?.update(delta)

    if (this.particles) {
      this.particles.rotation.y += delta * 0.2
    }

    // 物理演算と鏡餅の更新
    if (this.physicsContext && this.decorativeMochi) {
      this.physicsContext.step(delta)
      this.decorativeMochi.update(delta)
      this.decorativeMochi.group.rotation.y += delta * 0.5
    }

    // 紙吹雪のアニメーション
    if (this.confetti) {
      updateConfetti(this.confetti, delta)
    }

    // スコア演出の更新
    this.scoreRevealOrchestrator?.update(delta)

    // UIをカメラに向ける
    if (this.uiGroup) {
      this.uiGroup.lookAt(this.game.camera.position)
    }
  }

  private setupScene() {
    const tierConfig = this.getResultTierConfig()

    // 初日の出の空（timeOfDay = 1.0）
    this.skyGradient = new SkyGradient()
    this.skyGradient.timeOfDay = 1.0 // 朝焼け
    this.skyGradient.addToScene(this.scene)

    this.scene.background = null

    // ライティング設定（共通クラス使用・スコアティアでアクセント色を指定）
    this.sceneLighting = new SceneLighting('result', {
      accentColor: tierConfig.accentLightColor
    })
    this.sceneLighting.addToScene(this.scene)

    // 雪エフェクト
    this.snowEffect = new SnowEffect()
    this.snowEffect.addToScene(this.scene)

    // 富士山を奥に配置
    this.mountain = new MountainFuji(1.5)
    this.mountain.setPosition(0, -2, -60)
    this.mountain.addToScene(this.scene)

    this.createParticles()
    this.createResultKagamimochi()
  }

  private createParticles() {
    const tierConfig = this.getResultTierConfig()
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
    // 物理コンテキストを作成（通常の重力）
    this.physicsContext = new PhysicsContext()

    // 装飾用鏡餅グループを作成（餅のみ、上から落として積む）
    this.decorativeMochi = new DecorativeMochiGroup({
      includeDai: false,
      includeLeaf: false,
      physicsContext: this.physicsContext,
      initialPosition: new THREE.Vector3(0, 2, 0)
    })

    this.decorativeMochi.addToScene(this.scene)
  }

  private buildUI3D() {
    this.uiGroup = new THREE.Group()
    this.uiGroup.position.set(0, 2.5, 4)
    this.scene.add(this.uiGroup)

    const rating = this.getRating()

    if (this.gameMode === 'endless') {
      this.buildEndlessUI(rating)
    } else {
      this.buildNormalUI(rating)
    }

    // シェアボタン（黒ボタン・多重縁取り）
    this.shareButton = new ExtrudedButton3D({
      textKey: 'Xでシェア',
      width: 2.8,
      height: 0.7,
      bodyFrontColor: 0x1a1a1a,
      bodySideColor: 0x444444,
      bodyOutlines: [
        { bevelOffset: 0.08, color: 0x666666 },
        { bevelOffset: 0.04, color: 0x333333 },
      ],
      textOptions: {
        frontColor: 0xffffff,
        sideColor: 0xcccccc,
        outlines: [{ bevelOffset: 1.5, color: 0x000000 }],
      },
      hoverColor: 0x333333,
      activeColor: 0x111111,
      onClick: () => {
        this.shareToTwitter()
      }
    })
    this.shareButton.position.set(0, -1.4, 0)
    this.uiGroup!.add(this.shareButton)

    // タイトルに戻るボタン（金ボタン・多重縁取り）
    this.backButton = new ExtrudedButton3D({
      textKey: 'タイトルに戻る',
      width: 3.2,
      height: 0.8,
      textOptions: {
        frontColor: 0x8b0000,
        sideColor: 0x660000,
        outlines: [{ bevelOffset: 1.5, color: 0x000000 }],
      },
      onClick: () => {
        this.game.audioManager.playClick()
        this.game.sceneManager.switchTo('intro')
      }
    })
    this.backButton.position.set(0, -2.5, 0)
    this.uiGroup!.add(this.backButton)
  }

  /**
   * 通常モード用UI
   * スコア表示はScoreRevealOrchestratorが担当
   */
  private buildNormalUI(rating: { emoji: string; text: string }) {
    // 評価絵文字
    this.ratingSprite = createTextSprite({
      text: rating.emoji,
      fontSize: 80,
      color: '#ffffff'
    })
    this.ratingSprite.position.set(0, 0.3, 0)
    this.ratingSprite.scale.set(0, 0, 0)
    this.uiGroup!.add(this.ratingSprite)

    // 評価テキスト
    this.ratingTextSprite = createTextSprite({
      text: rating.text,
      fontSize: 40,
      color: '#ffffff',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })
    this.ratingTextSprite.position.set(0, -0.3, 0)
    this.ratingTextSprite.material.opacity = 0
    this.uiGroup!.add(this.ratingTextSprite)
  }

  /**
   * エンドレスモード用UI
   * スコア表示はScoreRevealOrchestratorが担当
   */
  private buildEndlessUI(rating: { emoji: string; text: string }) {
    const endlessData = this.resultData as EndlessResultData

    // みかん成功/失敗ステータス
    const mikanStatus = endlessData?.mikanSuccess ? '🍊 完成！' : '🍊 みかん落下...'
    const mikanColor = endlessData?.mikanSuccess ? '#FFD700' : '#FF6B6B'

    // 統計情報（餅数・時間・みかん）
    const statsText = `餅: ${endlessData?.mochiCount ?? 0}個 / ${endlessData?.survivalTime ?? 0}秒 / ${mikanStatus}`
    this.endlessStatsSprite = createTextSprite({
      text: statsText,
      fontSize: 32,
      color: endlessData?.mikanSuccess ? '#ffffff' : mikanColor,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })
    this.endlessStatsSprite.position.set(0, 0.8, 0)
    this.uiGroup!.add(this.endlessStatsSprite)

    // 評価絵文字
    this.ratingSprite = createTextSprite({
      text: rating.emoji,
      fontSize: 70,
      color: '#ffffff'
    })
    this.ratingSprite.position.set(0, 0.3, 0)
    this.ratingSprite.scale.set(0, 0, 0)
    this.uiGroup!.add(this.ratingSprite)

    // 評価テキスト
    this.ratingTextSprite = createTextSprite({
      text: rating.text,
      fontSize: 36,
      color: '#ffffff',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })
    this.ratingTextSprite.position.set(0, -0.3, 0)
    this.ratingTextSprite.material.opacity = 0
    this.uiGroup!.add(this.ratingTextSprite)
  }

  private getRating(): { emoji: string; text: string } {
    const config = this.getResultTierConfig()
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
      const button = intersects[0].object.userData.button as ExtrudedButton3D | undefined
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
      const button = intersects[0].object.userData.button as ExtrudedButton3D | undefined
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
      const button = intersects[0].object.userData.button as ExtrudedButton3D | undefined
      if (button && button.onClick) {
        button.onClick()
      }
    }
  }

  private getInteractiveButtons(): ExtrudedButton3D[] {
    const buttons: ExtrudedButton3D[] = []
    if (this.shareButton) buttons.push(this.shareButton)
    if (this.backButton) buttons.push(this.backButton)
    return buttons
  }

  private shareToTwitter() {
    const rating = this.getRating()
    let text: string

    if (this.gameMode === 'endless') {
      const endlessData = this.resultData as EndlessResultData
      text = `🎍 鏡餅スタッキング【エンドレス】🎍\n\n` +
        `高さ: ${endlessData?.maxHeight ?? 0}m\n` +
        `餅: ${endlessData?.mochiCount ?? 0}個\n` +
        `${rating.emoji} ${rating.text}\n\n` +
        `#鏡餅スタッキング #あけおめ`
    } else {
      text = `🎍 鏡餅スタッキングゲーム 🎍\n\nスコア: ${this.score}点\n${rating.emoji} ${rating.text}\n\n#鏡餅スタッキング #あけおめ`
    }

    const url = encodeURIComponent(window.location.href)
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`
    window.open(tweetUrl, '_blank')
  }

  private async playResultAnimation() {
    // ド派手演出を開始
    const tier = this.getResultTier()
    const label = this.gameMode === 'endless' ? 'SCORE' : 'YOUR SCORE'

    // エンドレスモードの場合はフォーマット済みスコアと演出強度を使用
    let displayScoreValue: number
    let displayScoreText: string | undefined
    let effectIntensity: number | undefined

    if (this.gameMode === 'endless') {
      const endlessData = this.resultData as EndlessResultData
      displayScoreValue = Math.round(endlessData?.rawScore ?? 0)
      displayScoreText = endlessData?.displayScore
      effectIntensity = endlessData?.effectIntensity
    } else {
      displayScoreValue = this.score
    }

    this.scoreRevealOrchestrator = new ScoreRevealOrchestrator(
      this.scene,
      this.game.camera,
      this.game.cameraController,
      this.game.cameraEffects ?? null,
      {
        tier,
        score: displayScoreValue,
        label,
        gameMode: this.gameMode,
        displayScore: displayScoreText,
        effectIntensity,
      }
    )

    // 鏡餅のアニメーション
    if (this.decorativeMochi) {
      gsap.from(this.decorativeMochi.group.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        ease: 'elastic.out(1, 0.5)',
      })
    }

    // 演出完了を待ってから評価表示
    await this.scoreRevealOrchestrator.play()

    // 評価の表示アニメーション
    if (this.ratingSprite) {
      gsap.to(this.ratingSprite.scale, {
        x: 1.5,
        y: 1.5,
        z: 1,
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)',
      })
    }

    // 評価テキストのフェードイン
    if (this.ratingTextSprite) {
      gsap.to(this.ratingTextSprite.material, {
        opacity: 1,
        duration: 0.5,
        delay: 0.3,
      })
    }
  }

  /**
   * スコアティアを取得（オーケストレーター用）
   */
  private getResultTier(): OrchestratorScoreTier {
    if (this.gameMode === 'endless') {
      const endlessData = this.resultData as EndlessResultData
      const height = endlessData?.maxHeight ?? 0

      if (height >= 5) return 'perfect'
      if (height >= 3) return 'excellent'
      if (height >= 2) return 'good'
      if (height >= 1) return 'average'
      return 'poor'
    }

    const score = this.score
    if (score >= 100) return 'perfect'
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'average'
    if (score >= 20) return 'poor'
    return 'fail'
  }

  private spawnConfetti() {
    this.confetti = createConfettiSystem(300)
    this.scene.add(this.confetti)
  }

  /**
   * レイアウト変更時の調整
   */
  protected adjustLayout(layout: LayoutInfo): void {
    // UIグループのスケールを調整（新しいデフォルト0.8を使用）
    if (this.uiGroup) {
      const scale = calculateLayoutScale(layout)
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
