import * as THREE from 'three'
import type { LayoutInfo } from './LayoutManager'

/**
 * パーティクルを装飾領域まで拡張
 * 横画面時にセーフエリア外の余白領域にもパーティクルを表示する
 *
 * @param particles パーティクルオブジェクト
 * @param layout 現在のレイアウト情報
 * @param baseWidth 縦画面時の基準幅
 */
export function extendParticlesToDecoration(
  particles: THREE.Points,
  layout: LayoutInfo,
  baseWidth: number
): void {
  if (layout.mode === 'portrait') {
    // 縦画面では拡張なし（元の幅を維持）
    return
  }

  const positions = particles.geometry.getAttribute('position')
  if (!positions) return

  // 画面幅に合わせて拡張倍率を計算
  const extendedWidth = baseWidth / layout.safeArea.width

  for (let i = 0; i < positions.count; i++) {
    const currentX = positions.getX(i)
    // 元の位置を基準に拡張
    const normalizedX = currentX / baseWidth
    const newX = normalizedX * extendedWidth
    positions.setX(i, newX)
  }

  positions.needsUpdate = true
}

/**
 * パーティクルを再配置（ランダム配置）
 * 横画面時に装飾領域を含む全体にパーティクルを配置し直す
 *
 * @param particles パーティクルオブジェクト
 * @param layout 現在のレイアウト情報
 * @param options 配置オプション
 */
export function redistributeParticles(
  particles: THREE.Points,
  layout: LayoutInfo,
  options: {
    baseWidth: number
    baseHeight: number
    baseDepth: number
    yOffset?: number
  }
): void {
  const positions = particles.geometry.getAttribute('position')
  if (!positions) return

  const { baseWidth, baseHeight, baseDepth, yOffset = 0 } = options

  // 横画面では幅を拡張
  const extendedWidth =
    layout.mode === 'landscape' ? baseWidth / layout.safeArea.width : baseWidth

  for (let i = 0; i < positions.count; i++) {
    const x = (Math.random() - 0.5) * extendedWidth
    const y = Math.random() * baseHeight + yOffset
    const z = (Math.random() - 0.5) * baseDepth

    positions.setXYZ(i, x, y, z)
  }

  positions.needsUpdate = true
}

/**
 * オブジェクトのX座標をセーフエリア内に制限
 *
 * @param object 3Dオブジェクト
 * @param layout 現在のレイアウト情報
 * @param margin セーフエリア端からのマージン（オプション）
 */
export function clampToSafeArea(
  object: THREE.Object3D,
  layout: LayoutInfo,
  margin: number = 0
): void {
  const bounds = layout.safeArea.worldBounds
  const minX = bounds.left + margin
  const maxX = bounds.right - margin

  object.position.x = Math.max(minX, Math.min(maxX, object.position.x))
}

/**
 * オブジェクトをセーフエリアの相対位置に配置
 *
 * @param object 3Dオブジェクト
 * @param layout 現在のレイアウト情報
 * @param relativeX -1（左端）〜 0（中央）〜 1（右端）
 * @param relativeY -1（下端）〜 0（中央）〜 1（上端）
 * @param z Z座標（そのまま維持）
 */
export function positionInSafeArea(
  object: THREE.Object3D,
  layout: LayoutInfo,
  relativeX: number,
  relativeY: number,
  z?: number
): void {
  const bounds = layout.safeArea.worldBounds
  const x = bounds.centerX + (relativeX * bounds.width) / 2
  const y = bounds.centerY + (relativeY * bounds.height) / 2

  object.position.x = x
  object.position.y = y
  if (z !== undefined) {
    object.position.z = z
  }
}

/**
 * スケールをレイアウトモードに応じて調整
 *
 * @param object 3Dオブジェクト
 * @param layout 現在のレイアウト情報
 * @param portraitScale 縦画面時のスケール
 * @param landscapeScale 横画面時のスケール
 */
export function adjustScaleForLayout(
  object: THREE.Object3D,
  layout: LayoutInfo,
  portraitScale: number,
  landscapeScale: number = 1
): void {
  const scale = layout.mode === 'portrait' ? portraitScale : landscapeScale
  object.scale.setScalar(scale)
}

/**
 * レイアウトモードに応じたスケール値を計算
 *
 * @param layout 現在のレイアウト情報
 * @param minScale 最小スケール（縦画面時の下限）
 * @returns 計算されたスケール値
 */
export function calculateLayoutScale(
  layout: LayoutInfo,
  minScale: number = 0.6
): number {
  if (layout.mode === 'landscape') {
    return 1
  }

  // 縦画面ではアスペクト比に応じてスケールを調整
  return Math.max(minScale, layout.screenAspect)
}
