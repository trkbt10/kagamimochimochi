import * as THREE from 'three'
import { gsap } from 'gsap'
import { CharacterSequencer } from './CharacterSequencer'
import { GodRayEffect, GODRAY_TIER_CONFIGS } from './GodRayEffect'
import { ImpactDustEffect } from './ImpactDustEffect'
import { ShockwaveEffect } from '../ShockwaveEffect'
import type { CameraController } from '../../core/CameraController'
import type { CameraEffectsManager } from '../../core/CameraEffectsManager'
import type { ExtrudeTextOptions } from '../../text-builder/types'

export type ScoreTier = 'perfect' | 'excellent' | 'good' | 'average' | 'poor' | 'fail'

export type ScoreRevealConfig = {
  tier: ScoreTier
  score: number
  label: string // "YOUR SCORE" または "MAX HEIGHT" など
  gameMode: 'normal' | 'endless'
  effectIntensity?: number // 0-1の演出強度（エンドレスモード用）
  displayScore?: string // フォーマット済み表示スコア（エンドレスモード用）
}

/**
 * スコアティア別の演出パラメータ
 */
type TierEffectConfig = {
  textColors: {
    frontColor: number
    sideColor: number
    outlines: Array<{ bevelOffset: number; color: number }>
  }
  entranceDelay: number      // 文字間隔（秒）
  rotationCount: number      // 全体回転数
  landingHeight: number      // 落下高さ
  dustIntensity: number      // 土煙強度
  shakeIntensity: number     // 振動強度
  useZoomLines: boolean
  useMotionBlur: boolean
}

const TIER_EFFECT_CONFIGS: Record<ScoreTier, TierEffectConfig> = {
  fail: {
    textColors: {
      frontColor: 0x888888,
      sideColor: 0x666666,
      outlines: [{ bevelOffset: 2, color: 0x444444 }],
    },
    entranceDelay: 0.2,
    rotationCount: 0.5,
    landingHeight: -0.3,
    dustIntensity: 0.4,
    shakeIntensity: 0.1,
    useZoomLines: false,
    useMotionBlur: false,
  },
  poor: {
    textColors: {
      frontColor: 0xaaaaaa,
      sideColor: 0x888888,
      outlines: [{ bevelOffset: 2, color: 0x666666 }],
    },
    entranceDelay: 0.18,
    rotationCount: 0.5,
    landingHeight: -0.4,
    dustIntensity: 0.5,
    shakeIntensity: 0.15,
    useZoomLines: false,
    useMotionBlur: true,
  },
  average: {
    textColors: {
      frontColor: 0xffffff,
      sideColor: 0xdddddd,
      outlines: [{ bevelOffset: 2, color: 0xaaaaaa }],
    },
    entranceDelay: 0.15,
    rotationCount: 1,
    landingHeight: -0.5,
    dustIntensity: 0.8,
    shakeIntensity: 0.2,
    useZoomLines: true,
    useMotionBlur: true,
  },
  good: {
    textColors: {
      frontColor: 0xc0c0c0,
      sideColor: 0xa0a0a0,
      outlines: [
        { bevelOffset: 3, color: 0x808080 },
        { bevelOffset: 1.5, color: 0xe0e0e0 },
      ],
    },
    entranceDelay: 0.12,
    rotationCount: 1,
    landingHeight: -0.6,
    dustIntensity: 1.0,
    shakeIntensity: 0.25,
    useZoomLines: true,
    useMotionBlur: true,
  },
  excellent: {
    textColors: {
      frontColor: 0xffd700,
      sideColor: 0xdaa520,
      outlines: [
        { bevelOffset: 4, color: 0xb8860b },
        { bevelOffset: 2, color: 0xffec8b },
      ],
    },
    entranceDelay: 0.1,
    rotationCount: 1.5,
    landingHeight: -0.8,
    dustIntensity: 1.3,
    shakeIntensity: 0.3,
    useZoomLines: true,
    useMotionBlur: true,
  },
  perfect: {
    textColors: {
      frontColor: 0xffd700,
      sideColor: 0xffec8b,
      outlines: [
        { bevelOffset: 5, color: 0xff4500 },
        { bevelOffset: 3, color: 0xffa500 },
        { bevelOffset: 1.5, color: 0xfffacd },
      ],
    },
    entranceDelay: 0.08,
    rotationCount: 2,
    landingHeight: -1.0,
    dustIntensity: 1.5,
    shakeIntensity: 0.35,
    useZoomLines: true,
    useMotionBlur: true,
  },
}

/**
 * スコア表示のド派手演出オーケストレーター
 */
export class ScoreRevealOrchestrator {
  private scene: THREE.Scene
  private cameraController: CameraController
  private cameraEffects: CameraEffectsManager | null
  private config: ScoreRevealConfig
  private tierConfig: TierEffectConfig

  // コンポーネント
  private labelSequencer: CharacterSequencer | null = null
  private scoreSequencer: CharacterSequencer | null = null
  private godRayEffect: GodRayEffect | null = null
  private dustEffect: ImpactDustEffect | null = null
  private shockwaveEffect: ShockwaveEffect | null = null

  // コンテナグループ
  private container: THREE.Group
  private labelGroup: THREE.Group
  private scoreGroup: THREE.Group

  // ライティング
  private spotLight: THREE.SpotLight | null = null

  // タイムライン
  private masterTimeline: gsap.core.Timeline | null = null

  // 状態
  private isPlaying: boolean = false
  private isComplete: boolean = false

  constructor(
    scene: THREE.Scene,
    _camera: THREE.PerspectiveCamera,
    cameraController: CameraController,
    cameraEffects: CameraEffectsManager | null,
    config: ScoreRevealConfig
  ) {
    this.scene = scene
    this.cameraController = cameraController
    this.cameraEffects = cameraEffects
    this.config = config

    // ティアコンフィグを取得し、エンドレスモードの場合は演出強度で調整
    const baseTierConfig = TIER_EFFECT_CONFIGS[config.tier]
    this.tierConfig =
      config.gameMode === 'endless' && config.effectIntensity !== undefined
        ? this.adjustTierConfigByIntensity(baseTierConfig, config.effectIntensity)
        : baseTierConfig

    // コンテナ作成
    this.container = new THREE.Group()
    this.labelGroup = new THREE.Group()
    this.scoreGroup = new THREE.Group()
    this.container.add(this.labelGroup)
    this.container.add(this.scoreGroup)
    this.scene.add(this.container)

    // 初期位置
    this.container.position.set(0, 5.0, 0)

    // セットアップ
    this.setupComponents()
    this.setupLighting()
  }

  /**
   * コンポーネントをセットアップ
   */
  private setupComponents(): void {
    // ラベル用オプション（控えめな白系）
    const labelOptions: ExtrudeTextOptions = {
      depth: 2,
      bevelThickness: 0.8,
      bevelSize: 0.5,
      bevelSegments: 8,
      frontColor: 0xffffff,
      sideColor: 0xcccccc,
      outlines: [
        { bevelOffset: 1.5, color: 0x666666 },
      ],
    }

    // スコア用オプション（ティア別の派手な装飾）
    const scoreOptions: ExtrudeTextOptions = {
      depth: 6,
      bevelThickness: 2,
      bevelSize: 1.5,
      bevelSegments: 15,
      ...this.tierConfig.textColors,
    }

    // ラベル（YOUR SCORE など）
    this.labelSequencer = new CharacterSequencer(this.config.label, labelOptions)
    const labelGroup = this.labelSequencer.getGroup()
    labelGroup.scale.setScalar(0.008)
    labelGroup.position.y = 1.5
    this.labelGroup.add(labelGroup)

    // スコア数値（メイン・派手に）
    let scoreText: string
    if (this.config.gameMode === 'endless') {
      // エンドレスモードではフォーマット済みスコアを使用
      scoreText = this.config.displayScore ?? `${this.config.score}m`
    } else {
      scoreText = `${this.config.score}点`
    }
    this.scoreSequencer = new CharacterSequencer(scoreText, scoreOptions)
    const scoreGroup = this.scoreSequencer.getGroup()
    scoreGroup.scale.setScalar(0.025)
    scoreGroup.position.y = -1.0
    this.scoreGroup.add(scoreGroup)

    // ゴッドレイ（高スコア時のみ）
    const godRayConfig = GODRAY_TIER_CONFIGS[this.config.tier]
    if (godRayConfig) {
      this.godRayEffect = new GodRayEffect(godRayConfig)
      const godRayGroup = this.godRayEffect.getGroup()
      godRayGroup.position.z = -2
      this.container.add(godRayGroup)
    }

    // 土煙エフェクト
    this.dustEffect = new ImpactDustEffect(this.scene, -2)

    // 衝撃波エフェクト
    this.shockwaveEffect = new ShockwaveEffect(this.scene)
  }

  /**
   * ライティングをセットアップ
   */
  private setupLighting(): void {
    this.spotLight = new THREE.SpotLight(0xffffff, 2)
    this.spotLight.position.set(0, 5, 10)
    this.spotLight.angle = Math.PI / 4
    this.spotLight.penumbra = 0.5
    this.spotLight.distance = 30
    this.spotLight.target = this.container
    this.scene.add(this.spotLight)
  }

  /**
   * 演出を開始
   */
  play(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isPlaying) {
        resolve()
        return
      }

      this.isPlaying = true
      this.masterTimeline = gsap.timeline({
        onComplete: () => {
          this.isComplete = true
          this.isPlaying = false
          resolve()
        },
      })

      // 各フェーズを順番に追加
      this.masterTimeline.add(this.phaseZoomIn(), 0)
      this.masterTimeline.add(this.phaseCharacterEntrance(), 0.6)
      this.masterTimeline.add(this.phaseFullRotation(), '+=0.2')
      this.masterTimeline.add(this.phaseZoomOutAndLand(), '+=0')
      this.masterTimeline.add(this.phaseDustImpact(), '-=0.2')
    })
  }

  /**
   * Phase 1: ズームイン
   */
  private phaseZoomIn(): gsap.core.Timeline {
    const tl = gsap.timeline()

    // カメラをスコアに接近
    const targetPosition = new THREE.Vector3(0, 5.5, 6)
    const targetLookAt = new THREE.Vector3(0, 4.5, 0)

    tl.add(
      this.cameraController.animateTo(targetPosition, targetLookAt, {
        duration: 0.8,
        ease: 'power2.inOut',
      })
    )

    // 集中線エフェクト
    if (this.tierConfig.useZoomLines) {
      tl.call(() => {
        this.cameraEffects?.triggerZoomLines(0.5, 0.6)
      }, [], 0)
    }

    return tl
  }

  /**
   * Phase 2: 文字登場（1文字ずつ）
   */
  private phaseCharacterEntrance(): gsap.core.Timeline {
    const tl = gsap.timeline()

    // ラベルの登場
    if (this.labelSequencer) {
      tl.add(
        this.labelSequencer.playSequentialEntrance(
          this.tierConfig.entranceDelay * 0.8,
          () => {
            // 各文字で小さな振動
            this.cameraController.shake(0.02, 0.1, true)
          }
        ),
        0
      )
    }

    // スコア数値の登場（ラベルの途中から）
    if (this.scoreSequencer) {
      const labelDuration = this.labelSequencer
        ? this.labelSequencer.getCharacterCount() * this.tierConfig.entranceDelay * 0.8 * 0.5
        : 0

      tl.add(
        this.scoreSequencer.playSequentialEntrance(
          this.tierConfig.entranceDelay,
          () => {
            // 各文字で振動（スコアの方が強め）
            this.cameraController.shake(0.03, 0.15, true)
          }
        ),
        labelDuration
      )
    }

    // 光沢アニメーション
    tl.call(() => {
      this.labelSequencer?.playAllShineAnimations()
    }, [], '+=0.1')

    tl.call(() => {
      this.scoreSequencer?.playAllShineAnimations()
    }, [], '+=0.05')

    return tl
  }

  /**
   * Phase 3: 全体回転
   */
  private phaseFullRotation(): gsap.core.Timeline {
    const tl = gsap.timeline()

    const rotations = this.tierConfig.rotationCount
    const duration = 0.6 + rotations * 0.3
    // 回転数を整数に丸めて最終的に正面を向くようにする
    const fullRotations = Math.round(rotations)

    // スコア数値のみ回転（ラベルは固定）
    tl.to(this.scoreGroup.rotation, {
      y: Math.PI * 2 * fullRotations,
      duration,
      ease: 'power1.inOut',
    })

    // ゴッドレイをフェードイン
    if (this.godRayEffect) {
      tl.add(this.godRayEffect.fadeIn(0.5), 0)
    }

    return tl
  }

  /**
   * Phase 4: ズームアウト＆落下
   */
  private phaseZoomOutAndLand(): gsap.core.Timeline {
    const tl = gsap.timeline()

    // カメラを元の位置へ
    const targetPosition = new THREE.Vector3(0, 5, 12)
    const targetLookAt = new THREE.Vector3(0, 3, 0)

    tl.add(
      this.cameraController.animateTo(targetPosition, targetLookAt, {
        duration: 1,
        ease: 'power2.inOut',
      }),
      0
    )

    // モーションブラー
    if (this.tierConfig.useMotionBlur) {
      tl.call(() => {
        this.cameraEffects?.triggerMotionBlur(0.4, 0.6)
      }, [], 0)
    }

    // 落下アニメーション（落下量を抑えて高い位置に留まる）
    const landY = 4.5 + this.tierConfig.landingHeight * 0.3

    tl.to(this.container.position, {
      y: landY,
      duration: 0.6,
      ease: 'bounce.out',
    }, 0.4)

    return tl
  }

  /**
   * Phase 5: 土煙インパクト
   */
  private phaseDustImpact(): gsap.core.Timeline {
    const tl = gsap.timeline()

    // 着地位置（落下量が抑えられているので調整）
    const impactPosition = new THREE.Vector3(
      this.container.position.x,
      4.5 + this.tierConfig.landingHeight * 0.3 - 2,
      this.container.position.z
    )

    // 土煙
    tl.call(() => {
      this.dustEffect?.emit(impactPosition, this.tierConfig.dustIntensity)
    }, [], 0)

    // 衝撃波
    tl.call(() => {
      this.shockwaveEffect?.trigger(impactPosition)
    }, [], 0.05)

    // カメラシェイク
    tl.call(() => {
      this.cameraController.shake(this.tierConfig.shakeIntensity, 0.4, true)
    }, [], 0)

    // ズームパンチ
    tl.call(() => {
      this.cameraController.zoomPunch(55, 0.3)
    }, [], 0)

    // 余韻（微バウンス）
    tl.to(this.container.position, {
      y: this.container.position.y + 0.1,
      duration: 0.15,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
    }, 0.3)

    return tl
  }

  /**
   * 毎フレーム更新
   */
  update(delta: number): void {
    this.dustEffect?.update(delta)
    this.godRayEffect?.update(delta)
  }

  /**
   * コンテナのグループを取得
   */
  getContainer(): THREE.Group {
    return this.container
  }

  /**
   * 演出が完了したか
   */
  isFinished(): boolean {
    return this.isComplete
  }

  /**
   * 演出強度に基づいてティアパラメータを動的調整
   * @param baseConfig 基本のティアコンフィグ
   * @param intensity 演出強度（0-1）
   * @returns 調整されたティアコンフィグ
   */
  private adjustTierConfigByIntensity(
    baseConfig: TierEffectConfig,
    intensity: number
  ): TierEffectConfig {
    // 演出強度に応じてパラメータを調整
    // intensity: 0 = 控えめ, 1 = 最大
    return {
      ...baseConfig,
      // 文字の登場間隔を短く（速く）
      entranceDelay: baseConfig.entranceDelay * (1 - intensity * 0.3),
      // 回転数を増加
      rotationCount: baseConfig.rotationCount * (1 + intensity * 0.5),
      // 落下高さを大きく
      landingHeight: baseConfig.landingHeight * (1 + intensity * 0.3),
      // 土煙強度を増加
      dustIntensity: baseConfig.dustIntensity * (1 + intensity * 0.5),
      // 振動強度を増加
      shakeIntensity: baseConfig.shakeIntensity * (1 + intensity * 0.4),
      // 高強度時はズームラインとモーションブラーを有効化
      useZoomLines: intensity >= 0.3 ? true : baseConfig.useZoomLines,
      useMotionBlur: intensity >= 0.2 ? true : baseConfig.useMotionBlur,
    }
  }

  /**
   * リソース解放
   */
  dispose(): void {
    // タイムラインを停止
    if (this.masterTimeline) {
      this.masterTimeline.kill()
      this.masterTimeline = null
    }

    // コンポーネントを破棄
    this.labelSequencer?.dispose()
    this.scoreSequencer?.dispose()
    this.godRayEffect?.dispose()
    this.dustEffect?.dispose()
    this.shockwaveEffect?.dispose()

    // ライトを削除
    if (this.spotLight) {
      this.scene.remove(this.spotLight)
      this.spotLight.dispose()
      this.spotLight = null
    }

    // コンテナを削除
    this.scene.remove(this.container)
    while (this.container.children.length > 0) {
      this.container.remove(this.container.children[0])
    }
  }
}
