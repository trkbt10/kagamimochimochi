import * as THREE from 'three'
import { calculateSafeArea, type SafeAreaBounds } from './SafeAreaCalculator'

/** レイアウトモード */
export type LayoutMode = 'portrait' | 'landscape'

/** 装飾領域（セーフエリア外の左右余白） */
export interface DecorationArea {
  side: 'left' | 'right'
  /** 正規化座標（0-1）での境界 */
  left: number
  right: number
  /** 3D空間での境界 */
  worldLeft: number
  worldRight: number
}

/** レイアウト情報 */
export interface LayoutInfo {
  /** レイアウトモード（縦/横） */
  mode: LayoutMode
  /** 画面のアスペクト比 */
  screenAspect: number
  /** セーフエリアの境界 */
  safeArea: SafeAreaBounds
  /** 装飾領域（横画面のみ） */
  decorationAreas: DecorationArea[]
}

/** レイアウト変更リスナー */
export type LayoutChangeListener = (layout: LayoutInfo) => void

/**
 * レイアウト管理クラス
 * 画面サイズに基づいてセーフエリアと装飾領域を計算し、
 * レイアウト変更を各シーンに通知する
 */
export class LayoutManager {
  private camera: THREE.PerspectiveCamera
  private currentLayout: LayoutInfo | null = null
  private listeners: Set<LayoutChangeListener> = new Set()
  private targetZ: number

  constructor(camera: THREE.PerspectiveCamera, targetZ: number = 0) {
    this.camera = camera
    this.targetZ = targetZ
  }

  /**
   * レイアウト情報を更新
   * @param width 画面幅
   * @param height 画面高さ
   * @returns 更新されたレイアウト情報
   */
  update(width: number, height: number): LayoutInfo {
    const screenAspect = width / height
    const mode: LayoutMode = screenAspect < 1 ? 'portrait' : 'landscape'
    const safeArea = calculateSafeArea(screenAspect, this.camera, this.targetZ)
    const decorationAreas = this.calculateDecorationAreas(safeArea, mode)

    this.currentLayout = {
      mode,
      screenAspect,
      safeArea,
      decorationAreas,
    }

    this.notifyListeners()
    return this.currentLayout
  }

  /**
   * 現在のレイアウト情報を取得
   */
  getCurrentLayout(): LayoutInfo | null {
    return this.currentLayout
  }

  /**
   * レイアウト変更リスナーを追加
   */
  addListener(listener: LayoutChangeListener): void {
    this.listeners.add(listener)
  }

  /**
   * レイアウト変更リスナーを削除
   */
  removeListener(listener: LayoutChangeListener): void {
    this.listeners.delete(listener)
  }

  /**
   * 計算対象のZ座標を設定
   */
  setTargetZ(z: number): void {
    this.targetZ = z
  }

  /**
   * 装飾領域を計算
   */
  private calculateDecorationAreas(
    safeArea: SafeAreaBounds,
    mode: LayoutMode
  ): DecorationArea[] {
    if (mode === 'portrait') {
      return [] // 縦画面では装飾領域なし
    }

    return [
      {
        side: 'left',
        left: 0,
        right: safeArea.left,
        worldLeft: safeArea.worldBounds.left - safeArea.worldBounds.width,
        worldRight: safeArea.worldBounds.left,
      },
      {
        side: 'right',
        left: safeArea.right,
        right: 1,
        worldLeft: safeArea.worldBounds.right,
        worldRight: safeArea.worldBounds.right + safeArea.worldBounds.width,
      },
    ]
  }

  /**
   * 全リスナーに通知
   */
  private notifyListeners(): void {
    if (!this.currentLayout) return

    for (const listener of this.listeners) {
      listener(this.currentLayout)
    }
  }
}
