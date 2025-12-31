import * as THREE from 'three'
import type { SafeAreaBounds } from './SafeAreaCalculator'

/**
 * セーフエリア座標と3D座標の変換ユーティリティ
 */
export class CoordinateConverter {
  private camera: THREE.PerspectiveCamera
  private safeArea: SafeAreaBounds

  constructor(camera: THREE.PerspectiveCamera, safeArea: SafeAreaBounds) {
    this.camera = camera
    this.safeArea = safeArea
  }

  /**
   * セーフエリア情報を更新
   */
  updateSafeArea(safeArea: SafeAreaBounds): void {
    this.safeArea = safeArea
  }

  /**
   * セーフエリア内の相対位置を3D座標に変換
   * @param relativeX -1（左端）〜 0（中央）〜 1（右端）
   * @param relativeY -1（下端）〜 0（中央）〜 1（上端）
   * @param depth Z座標
   * @returns 3D空間の座標
   */
  safeAreaRelativeToWorld(
    relativeX: number,
    relativeY: number,
    depth: number
  ): THREE.Vector3 {
    const bounds = this.safeArea.worldBounds
    const x = bounds.centerX + (relativeX * bounds.width) / 2
    const y = bounds.centerY + (relativeY * bounds.height) / 2
    return new THREE.Vector3(x, y, depth)
  }

  /**
   * セーフエリア内の相対位置を3D座標に変換（カメラ相対）
   * カメラの前方一定距離に配置する場合に使用
   * @param relativeX -1（左端）〜 0（中央）〜 1（右端）
   * @param relativeY -1（下端）〜 0（中央）〜 1（上端）
   * @param distance カメラからの距離
   * @returns 3D空間の座標
   */
  safeAreaRelativeToCamera(
    relativeX: number,
    relativeY: number,
    distance: number
  ): THREE.Vector3 {
    // カメラの視錐台をこの距離で計算
    const vFov = (this.camera.fov * Math.PI) / 180
    const frustumHeight = 2 * distance * Math.tan(vFov / 2)
    const frustumWidth = frustumHeight * this.camera.aspect

    // セーフエリアの幅を考慮
    const safeWidth = frustumWidth * this.safeArea.width
    const safeHeight = frustumHeight * this.safeArea.height

    // カメラの前方向ベクトル
    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(this.camera.quaternion)

    // カメラの右方向ベクトル
    const right = new THREE.Vector3(1, 0, 0)
    right.applyQuaternion(this.camera.quaternion)

    // カメラの上方向ベクトル
    const up = new THREE.Vector3(0, 1, 0)
    up.applyQuaternion(this.camera.quaternion)

    // 基準位置（カメラの前方distance距離）
    const basePosition = this.camera.position.clone()
    basePosition.add(forward.multiplyScalar(distance))

    // 相対位置を適用
    const offsetX = (relativeX * safeWidth) / 2
    const offsetY = (relativeY * safeHeight) / 2

    basePosition.add(right.clone().multiplyScalar(offsetX))
    basePosition.add(up.clone().multiplyScalar(offsetY))

    return basePosition
  }

  /**
   * スクリーン座標をセーフエリア相対座標に変換
   * @param screenX スクリーンX座標（ピクセル）
   * @param screenY スクリーンY座標（ピクセル）
   * @param screenWidth 画面幅
   * @param screenHeight 画面高さ
   * @returns セーフエリア相対座標（範囲外の場合はnull）
   */
  screenToSafeAreaRelative(
    screenX: number,
    screenY: number,
    screenWidth: number,
    screenHeight: number
  ): { x: number; y: number } | null {
    // 正規化座標に変換（0-1）
    const normalizedX = screenX / screenWidth
    const normalizedY = screenY / screenHeight

    // セーフエリア範囲チェック
    if (
      normalizedX < this.safeArea.left ||
      normalizedX > this.safeArea.right ||
      normalizedY < this.safeArea.top ||
      normalizedY > this.safeArea.bottom
    ) {
      return null // セーフエリア外
    }

    // セーフエリア内での相対位置を計算（-1 〜 1）
    const relativeX =
      ((normalizedX - this.safeArea.left) / this.safeArea.width) * 2 - 1
    const relativeY =
      -(((normalizedY - this.safeArea.top) / this.safeArea.height) * 2 - 1)

    return { x: relativeX, y: relativeY }
  }

  /**
   * 3D座標をセーフエリア相対座標に変換
   * @param worldPosition 3D空間の座標
   * @returns セーフエリア相対座標
   */
  worldToSafeAreaRelative(
    worldPosition: THREE.Vector3
  ): { x: number; y: number } {
    const bounds = this.safeArea.worldBounds
    const relativeX = ((worldPosition.x - bounds.centerX) / bounds.width) * 2
    const relativeY = ((worldPosition.y - bounds.centerY) / bounds.height) * 2

    return { x: relativeX, y: relativeY }
  }
}
