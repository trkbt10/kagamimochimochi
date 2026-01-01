/**
 * ゲーム進行状況の永続化マネージャー
 */

const STORAGE_KEY = 'kagamimochi_game_progress'

export type GameProgress = {
  /** エンドレスモードが解放されているか */
  endlessUnlocked: boolean
  /** 解放演出を表示済みか（1回だけ表示するフラグ） */
  unlockCutinShown: boolean
  /** 通常モードの最高スコア（将来拡張用） */
  normalHighScore: number
  /** 解放日時（デバッグ・将来拡張用） */
  unlockedAt: string | null
}

const DEFAULT_GAME_PROGRESS: GameProgress = {
  endlessUnlocked: false,
  unlockCutinShown: false,
  normalHighScore: 0,
  unlockedAt: null,
}

/**
 * ゲーム進行状況の永続化マネージャー（シングルトン）
 */
export class GameProgressManager {
  private static instance: GameProgressManager | null = null
  private progress: GameProgress

  private constructor() {
    this.progress = this.load()
  }

  static getInstance(): GameProgressManager {
    if (!GameProgressManager.instance) {
      GameProgressManager.instance = new GameProgressManager()
    }
    return GameProgressManager.instance
  }

  /**
   * localStorage から読み込み
   */
  private load(): GameProgress {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { ...DEFAULT_GAME_PROGRESS }

      const parsed = JSON.parse(raw) as Partial<GameProgress>
      return { ...DEFAULT_GAME_PROGRESS, ...parsed }
    } catch (e) {
      console.warn('Failed to load game progress:', e)
      return { ...DEFAULT_GAME_PROGRESS }
    }
  }

  /**
   * localStorage に保存
   */
  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress))
    } catch (e) {
      console.warn('Failed to save game progress:', e)
    }
  }

  /**
   * エンドレスモードが解放されているか
   */
  isEndlessUnlocked(): boolean {
    return this.progress.endlessUnlocked
  }

  /**
   * エンドレスモードを解放
   */
  unlockEndless(): void {
    if (this.progress.endlessUnlocked) return

    this.progress.endlessUnlocked = true
    this.progress.unlockedAt = new Date().toISOString()
    this.save()
  }

  /**
   * 解放カットインを表示済みか
   */
  isUnlockCutinShown(): boolean {
    return this.progress.unlockCutinShown
  }

  /**
   * 解放カットインを表示済みにする
   */
  markUnlockCutinShown(): void {
    this.progress.unlockCutinShown = true
    this.save()
  }

  /**
   * 通常モードの最高スコアを更新
   */
  updateNormalHighScore(score: number): void {
    if (score > this.progress.normalHighScore) {
      this.progress.normalHighScore = score
      this.save()
    }
  }

  /**
   * 通常モードの最高スコアを取得
   */
  getNormalHighScore(): number {
    return this.progress.normalHighScore
  }

  /**
   * 現在の進行状況を取得（読み取り専用）
   */
  getProgress(): Readonly<GameProgress> {
    return { ...this.progress }
  }
}
