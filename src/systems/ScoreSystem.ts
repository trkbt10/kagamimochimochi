import type { MochiManager } from '../objects/MochiManager'
import type { MochiObject, MochiType } from '../objects/MochiObject'
import type { GameMode } from '../types/game-mode'
import { TARGET_POSITION, DAI_SURFACE_Y } from '../scenes/game/trajectory'

/**
 * スコア計算結果
 */
export type ScoreResult = {
  total: number
  breakdown: ScoreBreakdown[]
  maxHeight: number
  stackCount: number
  isPerfect: boolean
}

/**
 * 個別スコア内訳
 */
export type ScoreBreakdown = {
  mochiId: string
  type: MochiType
  points: number
  reason: string
  height: number
}

/**
 * クラシックモードのスコア設定（100点満点）
 */
const CLASSIC_SCORING = {
  base: {
    onTarget: 30,
    nearTarget: 15,
    targetRadius: 1.5,
    nearRadius: 3.0,
    minY: -2,
    maxY: 0
  },
  top: {
    stacked: 35,
    near: 15,
    stackRadius: 1.2,
    nearRadius: 2.0,
    maxHeightAbove: 2
  },
  mikan: {
    stacked: 35,
    near: 15,
    stackRadius: 0.8,
    nearRadius: 1.5,
    maxHeightAbove: 1.5
  }
} as const

/**
 * エンドレスモードのスコア設定
 */
const ENDLESS_SCORING = {
  heightMultiplier: 10, // 高さ1mあたりの点数
  stackBonus: 5, // 正しくスタックされた餅1つあたりのボーナス
  perfectStackBonus: 20, // 完璧なスタック（中心に近い）のボーナス
  centerThreshold: 0.3 // 中心とみなす距離
} as const

/**
 * スコア計算システム
 */
export class ScoreSystem {
  private gameMode: GameMode

  constructor(gameMode: GameMode = 'normal') {
    this.gameMode = gameMode
  }

  setGameMode(mode: GameMode): void {
    this.gameMode = mode
  }

  getGameMode(): GameMode {
    return this.gameMode
  }

  /**
   * スコアを計算
   */
  calculate(manager: MochiManager): ScoreResult {
    return this.gameMode === 'normal'
      ? this.calculateClassic(manager)
      : this.calculateEndless(manager)
  }

  /**
   * クラシックモード: 100点満点
   * 既存の互換性を維持
   */
  private calculateClassic(manager: MochiManager): ScoreResult {
    const allMochi = manager.getAll()
    const breakdown: ScoreBreakdown[] = []
    let total = 0

    const base = allMochi.find((m) => m.config.type === 'base')
    const top = allMochi.find((m) => m.config.type === 'top')
    const mikan = allMochi.find((m) => m.config.type === 'mikan')

    if (base) {
      const result = this.scoreClassicBase(base)
      breakdown.push(result)
      total += result.points
    }

    if (top && base) {
      const result = this.scoreClassicTop(top, base)
      breakdown.push(result)
      total += result.points
    }

    if (mikan && top) {
      const result = this.scoreClassicMikan(mikan, top)
      breakdown.push(result)
      total += result.points
    }

    const maxHeight = allMochi.length > 0 ? Math.max(...allMochi.map((m) => m.topY)) : 0
    const stackCount = manager.getStacked().length

    return {
      total: Math.min(100, total),
      breakdown,
      maxHeight,
      stackCount,
      isPerfect: total >= 100
    }
  }

  private scoreClassicBase(base: MochiObject): ScoreBreakdown {
    const dx = base.position.x - TARGET_POSITION.x
    const dz = base.position.z - TARGET_POSITION.z
    const dist = Math.sqrt(dx ** 2 + dz ** 2)
    const { onTarget, nearTarget, targetRadius, nearRadius, minY, maxY } =
      CLASSIC_SCORING.base

    const isOnDai = base.bottomY > minY && base.bottomY < maxY

    if (dist < targetRadius && isOnDai) {
      return {
        mochiId: base.id,
        type: 'base',
        points: onTarget,
        reason: 'ターゲット上',
        height: base.height
      }
    }
    if (dist < nearRadius) {
      return {
        mochiId: base.id,
        type: 'base',
        points: nearTarget,
        reason: 'ターゲット付近',
        height: base.height
      }
    }
    return {
      mochiId: base.id,
      type: 'base',
      points: 0,
      reason: 'ターゲット外',
      height: base.height
    }
  }

  private scoreClassicTop(top: MochiObject, base: MochiObject): ScoreBreakdown {
    const isPhysicallyStacked = top.stackedOn === base
    const { stacked, near, stackRadius, nearRadius, maxHeightAbove } =
      CLASSIC_SCORING.top

    if (isPhysicallyStacked) {
      return {
        mochiId: top.id,
        type: 'top',
        points: stacked,
        reason: 'ベースの上に積載',
        height: top.height
      }
    }

    // フォールバック: 位置ベース判定
    const dx = top.position.x - base.position.x
    const dz = top.position.z - base.position.z
    const dist = Math.sqrt(dx ** 2 + dz ** 2)
    const isAbove = top.height > base.height && top.height < base.height + maxHeightAbove

    if (dist < stackRadius && isAbove) {
      return {
        mochiId: top.id,
        type: 'top',
        points: stacked,
        reason: 'ベース上方',
        height: top.height
      }
    }
    if (dist < nearRadius) {
      return {
        mochiId: top.id,
        type: 'top',
        points: near,
        reason: 'ベース付近',
        height: top.height
      }
    }
    return {
      mochiId: top.id,
      type: 'top',
      points: 0,
      reason: 'ベース外',
      height: top.height
    }
  }

  private scoreClassicMikan(
    mikan: MochiObject,
    top: MochiObject
  ): ScoreBreakdown {
    const isPhysicallyStacked = mikan.stackedOn === top
    const { stacked, near, stackRadius, nearRadius, maxHeightAbove } =
      CLASSIC_SCORING.mikan

    if (isPhysicallyStacked) {
      return {
        mochiId: mikan.id,
        type: 'mikan',
        points: stacked,
        reason: '上餅の上に積載',
        height: mikan.height
      }
    }

    // フォールバック
    const dx = mikan.position.x - top.position.x
    const dz = mikan.position.z - top.position.z
    const dist = Math.sqrt(dx ** 2 + dz ** 2)
    const isAbove =
      mikan.height > top.height && mikan.height < top.height + maxHeightAbove

    if (dist < stackRadius && isAbove) {
      return {
        mochiId: mikan.id,
        type: 'mikan',
        points: stacked,
        reason: '上餅上方',
        height: mikan.height
      }
    }
    if (dist < nearRadius) {
      return {
        mochiId: mikan.id,
        type: 'mikan',
        points: near,
        reason: '上餅付近',
        height: mikan.height
      }
    }
    return {
      mochiId: mikan.id,
      type: 'mikan',
      points: 0,
      reason: '上餅外',
      height: mikan.height
    }
  }

  /**
   * エンドレスモード: 高さベースのスコア
   */
  private calculateEndless(manager: MochiManager): ScoreResult {
    const allMochi = manager.getAll()
    const stacked = manager.getStacked()
    const breakdown: ScoreBreakdown[] = []

    // 最高到達点（台座上面からの高さ）
    const rawMaxHeight =
      allMochi.length > 0 ? Math.max(...allMochi.map((m) => m.topY)) : 0
    const maxHeight = Math.max(0, rawMaxHeight - DAI_SURFACE_Y)
    const heightScore = Math.floor(maxHeight * ENDLESS_SCORING.heightMultiplier)

    // スタックボーナス
    let stackBonus = 0
    for (const mochi of stacked) {
      let bonus = ENDLESS_SCORING.stackBonus

      // 中心に近いほど追加ボーナス
      if (mochi.stackedOn) {
        const dx = mochi.position.x - mochi.stackedOn.position.x
        const dz = mochi.position.z - mochi.stackedOn.position.z
        const offset = Math.sqrt(dx ** 2 + dz ** 2)

        if (offset < ENDLESS_SCORING.centerThreshold) {
          bonus += ENDLESS_SCORING.perfectStackBonus
        }
      }

      stackBonus += bonus
      breakdown.push({
        mochiId: mochi.id,
        type: mochi.config.type,
        points: bonus,
        reason: `スタックボーナス (高さ: ${mochi.height.toFixed(1)}m)`,
        height: mochi.height
      })
    }

    const total = heightScore + stackBonus

    return {
      total,
      breakdown,
      maxHeight,
      stackCount: stacked.length,
      isPerfect: false // エンドレスには完璧はない
    }
  }

  /**
   * リアルタイム高度取得（エンドレスモード用）
   */
  getCurrentHeight(manager: MochiManager): number {
    const allMochi = manager.getAll()
    if (allMochi.length === 0) return 0
    const rawMax = Math.max(...allMochi.map((m) => m.topY))
    return Math.max(0, rawMax - DAI_SURFACE_Y)
  }
}
