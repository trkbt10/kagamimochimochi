import * as THREE from 'three'

/** 保証領域（セーフエリア）のアスペクト比: 9:16 */
export const SAFE_AREA_ASPECT = 9 / 16

/** 3D空間での境界情報 */
export interface WorldBounds {
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

/** セーフエリアの境界情報 */
export interface SafeAreaBounds {
  /** 正規化座標（0-1）での左端 */
  left: number
  /** 正規化座標（0-1）での右端 */
  right: number
  /** 正規化座標（0-1）での上端 */
  top: number
  /** 正規化座標（0-1）での下端 */
  bottom: number
  /** 正規化座標での幅 */
  width: number
  /** 正規化座標での高さ */
  height: number
  /** 3D空間での境界 */
  worldBounds: WorldBounds
}

/**
 * 特定のZ平面での視錐台境界を計算
 */
function calculateWorldBoundsAtZ(
  camera: THREE.PerspectiveCamera,
  left: number,
  right: number,
  top: number,
  bottom: number,
  targetZ: number
): WorldBounds {
  const distance = Math.abs(camera.position.z - targetZ)
  const vFov = (camera.fov * Math.PI) / 180
  const frustumHeight = 2 * distance * Math.tan(vFov / 2)
  const frustumWidth = frustumHeight * camera.aspect

  // 正規化座標（0-1）を視錐台座標（-0.5 ~ 0.5）に変換
  const worldLeft = (left - 0.5) * frustumWidth
  const worldRight = (right - 0.5) * frustumWidth
  const worldTop = (0.5 - top) * frustumHeight
  const worldBottom = (0.5 - bottom) * frustumHeight

  return {
    left: worldLeft,
    right: worldRight,
    top: worldTop,
    bottom: worldBottom,
    centerX: (worldLeft + worldRight) / 2,
    centerY: (worldTop + worldBottom) / 2,
    width: worldRight - worldLeft,
    height: worldTop - worldBottom,
  }
}

/**
 * フルスクリーンのセーフエリアを作成（縦画面用）
 */
function createFullScreenSafeArea(
  camera: THREE.PerspectiveCamera,
  targetZ: number
): SafeAreaBounds {
  return {
    left: 0,
    right: 1,
    top: 0,
    bottom: 1,
    width: 1,
    height: 1,
    worldBounds: calculateWorldBoundsAtZ(camera, 0, 1, 0, 1, targetZ),
  }
}

/**
 * 中央配置のセーフエリアを作成（横画面用）
 */
function createCenteredSafeArea(
  screenAspect: number,
  camera: THREE.PerspectiveCamera,
  targetZ: number
): SafeAreaBounds {
  const safeWidth = SAFE_AREA_ASPECT / screenAspect
  const marginX = (1 - safeWidth) / 2

  return {
    left: marginX,
    right: 1 - marginX,
    top: 0,
    bottom: 1,
    width: safeWidth,
    height: 1,
    worldBounds: calculateWorldBoundsAtZ(
      camera,
      marginX,
      1 - marginX,
      0,
      1,
      targetZ
    ),
  }
}

/**
 * 画面のアスペクト比に基づいてセーフエリアを計算
 * @param screenAspect 画面のアスペクト比（width / height）
 * @param camera Three.jsカメラ
 * @param targetZ 計算対象のZ座標（デフォルト: 0）
 * @returns セーフエリアの境界情報
 */
export function calculateSafeArea(
  screenAspect: number,
  camera: THREE.PerspectiveCamera,
  targetZ: number = 0
): SafeAreaBounds {
  const isPortrait = screenAspect < 1

  if (isPortrait) {
    return createFullScreenSafeArea(camera, targetZ)
  }

  return createCenteredSafeArea(screenAspect, camera, targetZ)
}
