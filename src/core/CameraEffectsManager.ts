import * as THREE from 'three'
import type { PostProcessManager } from '../postprocess/PostProcessManager'
import type { CameraController } from './CameraController'

/**
 * カメラエフェクトの種類
 */
export type CameraEffectType = 'none' | 'motionBlur' | 'zoomLines' | 'impact'

/**
 * エフェクト設定
 */
export type CameraEffectConfig = {
  motionBlur?: {
    intensity: number // 0-1
    duration: number // 秒
  }
  zoomLines?: {
    intensity: number // 集中線の密度
    duration: number
  }
  impact?: {
    shake: number // 振動強度
    flash?: boolean // 白フラッシュ
  }
}

/**
 * 移動方向に基づくエフェクト判定の閾値
 */
const EFFECT_THRESHOLDS = {
  forwardSpeedForZoomLines: 5, // Z方向への速度がこれ以上なら集中線
  horizontalSpeedForMotionBlur: 8, // X方向への速度がこれ以上ならモーションブラー
  minDistance: 3 // 最小移動距離
} as const

/**
 * カメラエフェクト管理クラス
 * - PostProcessManagerと連携
 * - CameraControllerと連携
 * - 移動方向に応じた自動エフェクト選択
 */
export class CameraEffectsManager {
  private postProcess: PostProcessManager | null
  private cameraController: CameraController

  constructor(
    postProcess: PostProcessManager | null,
    cameraController: CameraController
  ) {
    this.postProcess = postProcess
    this.cameraController = cameraController
  }

  /**
   * PostProcessManagerを設定
   */
  setPostProcessManager(postProcess: PostProcessManager | null): void {
    this.postProcess = postProcess
  }

  /**
   * カメラ移動方向に基づいてエフェクトを自動選択・適用
   */
  triggerEffectForMovement(
    from: THREE.Vector3,
    to: THREE.Vector3,
    duration: number
  ): CameraEffectType {
    const direction = to.clone().sub(from)
    const distance = direction.length()

    if (distance < EFFECT_THRESHOLDS.minDistance) {
      return 'none'
    }

    // 前方向への高速移動 → 集中線
    const forwardSpeed = -direction.z / duration // -Zが前方向
    if (
      forwardSpeed > EFFECT_THRESHOLDS.forwardSpeedForZoomLines &&
      direction.z < -3
    ) {
      this.triggerZoomLines(0.7, duration)
      return 'zoomLines'
    }

    // 横方向への高速移動 → モーションブラー
    const horizontalSpeed = Math.abs(direction.x) / duration
    if (horizontalSpeed > EFFECT_THRESHOLDS.horizontalSpeedForMotionBlur) {
      this.triggerMotionBlur(0.5, duration * 0.8)
      return 'motionBlur'
    }

    return 'none'
  }

  /**
   * モーションブラーをトリガー
   */
  triggerMotionBlur(intensity: number = 0.6, duration: number = 0.8): void {
    this.postProcess?.enableMotionBlur(intensity, duration)
  }

  /**
   * 集中線エフェクトをトリガー
   */
  triggerZoomLines(intensity: number = 0.7, duration: number = 0.5): void {
    this.postProcess?.enableZoomLines(intensity, duration)
  }

  /**
   * インパクトエフェクト（シェイク + オプションでフラッシュ）
   */
  triggerImpact(config: CameraEffectConfig['impact']): void {
    if (!config) return

    if (config.shake) {
      this.cameraController.shake(config.shake, 0.3, true)
    }

    // フラッシュは将来実装
  }

  /**
   * 着地時のエフェクトセット
   */
  triggerLandingEffect(intensity: number = 0.5): void {
    this.cameraController.shake(intensity * 0.2, 0.2, true)
    this.triggerMotionBlur(intensity * 0.4, 0.3)
  }

  /**
   * 発射時のエフェクト
   */
  triggerLaunchEffect(angleH: number): void {
    // 横方向発射の場合はモーションブラー
    if (Math.abs(angleH) > 20) {
      this.triggerMotionBlur(0.4, 0.5)
    }
  }

  /**
   * 結果発表時のズームエフェクト
   */
  triggerResultZoomEffect(): void {
    this.triggerMotionBlur(0.7, 0.6)
    this.cameraController.zoomPunch(55, 0.3)
  }

  /**
   * エフェクトが有効かどうか
   */
  get isEffectEnabled(): boolean {
    return this.postProcess?.enabled ?? false
  }
}
