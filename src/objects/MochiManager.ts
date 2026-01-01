import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import {
  MochiObject,
  MOCHI_CONFIGS,
  type MochiType,
  type MochiConfig
} from './MochiObject'
import type { GameMode } from '../types/game-mode'

/**
 * 餅管理クラス
 * - 餅オブジェクトのライフサイクル管理
 * - スタック状態の判定・更新
 */
export class MochiManager {
  private mochiList: MochiObject[] = []
  private world: CANNON.World
  private scene: THREE.Scene
  private mochiMaterial: CANNON.Material
  private gameMode: GameMode

  // スタック判定パラメータ
  private readonly STACK_HEIGHT_THRESHOLD = 0.3 // 最大高さ差

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    mochiMaterial: CANNON.Material,
    gameMode: GameMode = 'normal'
  ) {
    this.world = world
    this.scene = scene
    this.mochiMaterial = mochiMaterial
    this.gameMode = gameMode
  }

  // --- Factory ---
  createMochi(type: MochiType, position: THREE.Vector3): MochiObject {
    const config = MOCHI_CONFIGS[type]
    const mochi = new MochiObject(config, this.mochiMaterial, position)
    mochi.addToScene(this.scene)
    mochi.addToWorld(this.world)
    this.mochiList.push(mochi)
    return mochi
  }

  createMochiWithConfig(
    config: MochiConfig,
    position: THREE.Vector3
  ): MochiObject {
    const mochi = new MochiObject(config, this.mochiMaterial, position)
    mochi.addToScene(this.scene)
    mochi.addToWorld(this.world)
    this.mochiList.push(mochi)
    return mochi
  }

  // --- Access ---
  getAll(): readonly MochiObject[] {
    return this.mochiList
  }

  getByType(type: MochiType): MochiObject[] {
    return this.mochiList.filter((m) => m.config.type === type)
  }

  getStacked(): MochiObject[] {
    return this.mochiList.filter((m) => m.isStacked)
  }

  getById(id: string): MochiObject | undefined {
    return this.mochiList.find((m) => m.id === id)
  }

  getCount(): number {
    return this.mochiList.length
  }

  // --- Update ---
  update(): void {
    for (const mochi of this.mochiList) {
      mochi.syncMeshWithBody()
    }
    this.updateStackStates()
  }

  /**
   * スタック状態の更新
   * - 物理的な位置関係から「積み重なっている」を判定
   */
  private updateStackStates(): void {
    const sorted = [...this.mochiList].sort((a, b) => a.height - b.height)

    for (const mochi of sorted) {
      if (mochi.state === 'flying') continue

      const below = this.findMochiBelow(mochi)

      if (below) {
        mochi.setStackedOn(below)
      } else if (this.isOnGround(mochi)) {
        mochi.setState('stacked')
        mochi.setStackedOn(null)
      } else {
        mochi.setState('fallen')
        mochi.setStackedOn(null)
      }
    }
  }

  /**
   * この餅の直下にある餅を探す
   */
  private findMochiBelow(target: MochiObject): MochiObject | null {
    const targetPos = target.position

    for (const candidate of this.mochiList) {
      if (candidate === target) continue
      if (candidate.topY >= target.bottomY) continue

      const heightDiff = target.bottomY - candidate.topY
      if (heightDiff > this.STACK_HEIGHT_THRESHOLD) continue

      const dx = targetPos.x - candidate.position.x
      const dz = targetPos.z - candidate.position.z
      const distance = Math.sqrt(dx ** 2 + dz ** 2)

      const threshold =
        Math.min(target.config.radius, candidate.config.radius) * 1.2

      if (distance < threshold) {
        return candidate
      }
    }

    return null
  }

  /**
   * 地面または台座の上にあるか
   * DAI_SURFACE_Y = -1.5 付近
   */
  private isOnGround(mochi: MochiObject): boolean {
    return mochi.bottomY < 0 && mochi.bottomY > -3
  }

  // --- Height Tracking ---
  getMaxHeight(): number {
    if (this.mochiList.length === 0) return 0
    return Math.max(...this.mochiList.map((m) => m.topY))
  }

  getStackHeight(): number {
    const stacked = this.getStacked()
    if (stacked.length === 0) return 0
    return Math.max(...stacked.map((m) => m.topY))
  }

  // --- Collapse Detection ---
  /**
   * 崩壊を検出（エンドレスモード用）
   * @param daiPosition 台座の位置
   * @param maxDistanceFromDai 台座からの最大許容距離
   * @param minHeight 最小許容高さ
   */
  detectCollapse(
    daiPosition: THREE.Vector3,
    maxDistanceFromDai: number = 3,
    minHeight: number = -1.8
  ): boolean {
    if (this.mochiList.length === 0) return false

    for (const mochi of this.mochiList) {
      if (mochi.state === 'flying') continue

      const distFromDai = Math.sqrt(
        (mochi.position.x - daiPosition.x) ** 2 +
          (mochi.position.z - daiPosition.z) ** 2
      )

      // 台座から離れすぎた
      if (distFromDai > maxDistanceFromDai) {
        return true
      }

      // 床に落ちた（台座以外の場所で低すぎる）
      if (mochi.height < minHeight && distFromDai > 2) {
        return true
      }
    }

    return false
  }

  // --- Game Mode ---
  setGameMode(mode: GameMode): void {
    this.gameMode = mode
  }

  getGameMode(): GameMode {
    return this.gameMode
  }

  // --- Cleanup ---
  removeMochi(mochi: MochiObject): void {
    const index = this.mochiList.indexOf(mochi)
    if (index !== -1) {
      mochi.dispose(this.world, this.scene)
      this.mochiList.splice(index, 1)
    }
  }

  clear(): void {
    for (const mochi of [...this.mochiList]) {
      mochi.dispose(this.world, this.scene)
    }
    this.mochiList = []
  }

  dispose(): void {
    this.clear()
  }
}
