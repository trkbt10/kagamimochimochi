import type { GameMode } from './game-mode'

/**
 * IntroScene → GameScene のデータ
 */
export type IntroToGameData = {
  mode: GameMode
}

/**
 * GameScene → ResultScene のデータ（通常モード）
 */
export type NormalResultData = {
  mode: 'normal'
  score: number // 0-100点
}

/**
 * GameScene → ResultScene のデータ（エンドレスモード）
 */
export type EndlessResultData = {
  mode: 'endless'
  maxHeight: number // 達成した最高高度（メートル）
  mochiCount: number // 積んだ餅の数
  survivalTime: number // 生存時間（秒）
  mikanSuccess: boolean // みかん成功したか
  rawScore: number // 生スコア（累乗計算後）
  displayScore: string // 表示用フォーマット済み
  effectIntensity: number // 演出強度（0-1）
}

/**
 * GameScene → ResultScene の共通データ型
 */
export type GameToResultData = NormalResultData | EndlessResultData

/**
 * 型ガード: 通常モードのデータか判定
 */
export const isNormalResultData = (
  data: GameToResultData
): data is NormalResultData => {
  return data.mode === 'normal'
}

/**
 * 型ガード: エンドレスモードのデータか判定
 */
export const isEndlessResultData = (
  data: GameToResultData
): data is EndlessResultData => {
  return data.mode === 'endless'
}
