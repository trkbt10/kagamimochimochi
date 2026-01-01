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
 * エンドレスモード専用スコア結果（巨大数・演出強度対応）
 */
export type EndlessScoreResult = ScoreResult & {
  rawScore: number // 計算上の生スコア
  displayScore: string // 表示用フォーマット済み文字列
  effectIntensity: number // 演出強度（0-1）
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
 * エンドレスモードのスコア設定（累乗方式）
 */
const ENDLESS_SCORING = {
  exponent: 2.5, // 累乗指数
  baseMultiplier: 100, // 基本倍率
  stackBonusBase: 50, // 1個あたりの基本ボーナス
  perfectStackMultiplier: 2, // 完璧なスタックの倍率
  centerThreshold: 0.3, // 中心とみなす距離
  mikanSuccessMultiplier: 1.5 // みかん成功時の倍率
} as const

/**
 * 演出強度計算の設定
 */
const EFFECT_INTENSITY_CONFIG = {
  minScore: 100, // 演出開始スコア
  maxScore: 1_000_000 // 演出最大スコア
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
      : this.calculateEndlessLegacy(manager)
  }

  /**
   * エンドレスモード用スコア計算（みかん成功フラグ対応）
   */
  calculateEndless(
    manager: MochiManager,
    mikanSuccess: boolean = false
  ): EndlessScoreResult {
    const allMochi = manager.getAll()
    const stacked = manager.getStacked()
    const breakdown: ScoreBreakdown[] = []

    // 最高到達点（台座上面からの高さ）
    const rawMaxHeight =
      allMochi.length > 0 ? Math.max(...allMochi.map((m) => m.topY)) : 0
    const maxHeight = Math.max(0, rawMaxHeight - DAI_SURFACE_Y)

    // 累乗スコア: height^exponent * baseMultiplier
    const heightScore =
      Math.pow(maxHeight, ENDLESS_SCORING.exponent) *
      ENDLESS_SCORING.baseMultiplier

    // スタックボーナス
    let stackBonus = 0
    for (const mochi of stacked) {
      let bonus = ENDLESS_SCORING.stackBonusBase

      // 中心に近いほど追加ボーナス
      if (mochi.stackedOn) {
        const dx = mochi.position.x - mochi.stackedOn.position.x
        const dz = mochi.position.z - mochi.stackedOn.position.z
        const offset = Math.sqrt(dx ** 2 + dz ** 2)

        if (offset < ENDLESS_SCORING.centerThreshold) {
          bonus *= ENDLESS_SCORING.perfectStackMultiplier
        }
      }

      stackBonus += bonus
      breakdown.push({
        mochiId: mochi.id,
        type: mochi.config.type,
        points: bonus,
        reason: `スタックボーナス`,
        height: mochi.height
      })
    }

    let total = heightScore + stackBonus

    // みかん成功ボーナス
    if (mikanSuccess) {
      total *= ENDLESS_SCORING.mikanSuccessMultiplier
    }

    const displayScore = this.formatBigScore(total)
    const effectIntensity = this.calculateEffectIntensity(total)

    return {
      total: Math.round(total),
      breakdown,
      maxHeight,
      stackCount: stacked.length,
      isPerfect: false,
      rawScore: total,
      displayScore,
      effectIntensity
    }
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
   * エンドレスモード: 高さベースのスコア（レガシー互換用）
   * @deprecated calculateEndless(manager, mikanSuccess)を使用してください
   */
  private calculateEndlessLegacy(manager: MochiManager): ScoreResult {
    const result = this.calculateEndless(manager, false)
    return {
      total: result.total,
      breakdown: result.breakdown,
      maxHeight: result.maxHeight,
      stackCount: result.stackCount,
      isPerfect: result.isPerfect
    }
  }

  /**
   * 巨大スコアをフォーマット
   */
  private formatBigScore(score: number): string {
    if (score < 10_000) {
      return Math.round(score).toLocaleString()
    }
    if (score < 1_000_000) {
      return Math.round(score).toLocaleString()
    }
    if (score < 1_000_000_000) {
      // 百万単位
      const millions = score / 1_000_000
      return `${millions.toFixed(2)}M`
    }
    if (score < 1_000_000_000_000) {
      // 十億単位
      const billions = score / 1_000_000_000
      return `${billions.toFixed(2)}B`
    }
    // それ以上は指数表記
    return score.toExponential(2)
  }

  /**
   * スコアから演出強度を計算（対数圧縮）
   * @param score 生スコア
   * @returns 0-1の演出強度
   */
  private calculateEffectIntensity(score: number): number {
    const { minScore, maxScore } = EFFECT_INTENSITY_CONFIG

    if (score <= minScore) return 0
    if (score >= maxScore) return 1

    // 対数圧縮: (log10(score) - log10(min)) / (log10(max) - log10(min))
    const logScore = Math.log10(Math.max(score, 1))
    const logMin = Math.log10(minScore)
    const logMax = Math.log10(maxScore)

    return (logScore - logMin) / (logMax - logMin)
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
