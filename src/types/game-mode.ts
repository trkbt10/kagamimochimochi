import type { MochiType } from '../objects'

/**
 * ゲームモードの種類
 */
export type GameMode = 'normal' | 'endless'

/**
 * スコア計算方式
 */
export type ScoreType = 'accuracy' | 'height'

/**
 * ゲームモードの設定
 */
export type GameModeConfig = {
  readonly mode: GameMode
  readonly displayName: string
  readonly description: string
  /** 餅の順序（endlessの場合は循環） */
  readonly mochiSequence: readonly MochiType[]
  /** 循環するかどうか */
  readonly isLooping: boolean
  /** スコア計算方式 */
  readonly scoreType: ScoreType
}

/**
 * 通常モード設定
 */
export const NORMAL_MODE_CONFIG: GameModeConfig = {
  mode: 'normal',
  displayName: '通常モード',
  description: '3つの餅を積み上げて100点を目指せ！',
  mochiSequence: ['base', 'top', 'mikan'] as const,
  isLooping: false,
  scoreType: 'accuracy'
}

/**
 * エンドレスモード設定
 */
export const ENDLESS_MODE_CONFIG: GameModeConfig = {
  mode: 'endless',
  displayName: 'エンドレスモード',
  description: '餅を限界まで積み続けろ！崩れたらゲームオーバー',
  mochiSequence: ['base', 'top'] as const,
  isLooping: true,
  scoreType: 'height'
}

/**
 * 全モード設定のマップ
 */
export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  normal: NORMAL_MODE_CONFIG,
  endless: ENDLESS_MODE_CONFIG
}

/**
 * モード設定を取得
 */
export const getGameModeConfig = (mode: GameMode): GameModeConfig => {
  return GAME_MODE_CONFIGS[mode]
}
