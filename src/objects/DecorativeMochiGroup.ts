import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { MochiObject, MOCHI_CONFIGS } from './MochiObject'
import { PhysicsContext } from './PhysicsContext'

export interface DecorativeMochiConfig {
  includeDai?: boolean
  includeLeaf?: boolean
  physicsContext: PhysicsContext
  initialPosition?: THREE.Vector3
}

export interface MochiDisplayState {
  baseOpacity?: number
  topOpacity?: number
  mikanOpacity?: number
  baseOffset?: THREE.Vector3
  topOffset?: THREE.Vector3
  mikanOffset?: THREE.Vector3
}

/**
 * 装飾用鏡餅グループ
 * MochiObjectを内部で使用し、物理演算対応の装飾鏡餅を提供
 */
export class DecorativeMochiGroup {
  public readonly group: THREE.Group

  private baseMochi: MochiObject
  private topMochi: MochiObject
  private mikanMochi: MochiObject

  private dai: THREE.Mesh | null = null
  private leaf: THREE.Mesh | null = null

  private physicsContext: PhysicsContext
  private groundBody: CANNON.Body | null = null

  constructor(config: DecorativeMochiConfig) {
    this.physicsContext = config.physicsContext
    this.group = new THREE.Group()

    const initialPos = config.initialPosition ?? new THREE.Vector3(0, 0, 0)

    // 地面を作成（餅が落ちないように）
    this.groundBody = this.physicsContext.createGround(initialPos.y - 2)

    // 餅の配置位置（相対座標）
    const baseHeight = MOCHI_CONFIGS.base.height
    const topHeight = MOCHI_CONFIGS.top.height
    const mikanRadius = MOCHI_CONFIGS.mikan.radius

    // 下餅の位置（地面から少し上）
    const baseY = initialPos.y - 0.5
    // 上餅の位置（下餅の上）
    const topY = baseY + baseHeight / 2 + topHeight / 2 + 0.1
    // みかんの位置（上餅の上）
    const mikanY = topY + topHeight / 2 + mikanRadius + 0.1

    // 餅オブジェクトを作成
    this.baseMochi = new MochiObject(
      MOCHI_CONFIGS.base,
      this.physicsContext.mochiMaterial,
      new THREE.Vector3(initialPos.x, baseY, initialPos.z)
    )
    this.physicsContext.addBody(this.baseMochi.body)
    this.group.add(this.baseMochi.mesh)

    this.topMochi = new MochiObject(
      MOCHI_CONFIGS.top,
      this.physicsContext.mochiMaterial,
      new THREE.Vector3(initialPos.x, topY, initialPos.z)
    )
    this.physicsContext.addBody(this.topMochi.body)
    this.group.add(this.topMochi.mesh)

    this.mikanMochi = new MochiObject(
      MOCHI_CONFIGS.mikan,
      this.physicsContext.mochiMaterial,
      new THREE.Vector3(initialPos.x, mikanY, initialPos.z)
    )
    this.physicsContext.addBody(this.mikanMochi.body)
    this.group.add(this.mikanMochi.mesh)

    // 台座を追加（オプション）
    if (config.includeDai) {
      this.createDai(initialPos)
    }

    // 葉を追加（オプション）
    if (config.includeLeaf) {
      this.createLeaf()
    }
  }

  private createDai(position: THREE.Vector3): void {
    const daiGeometry = new THREE.CylinderGeometry(1.8, 2, 0.3, 32)
    const daiMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6,
      metalness: 0.2
    })
    this.dai = new THREE.Mesh(daiGeometry, daiMaterial)
    this.dai.position.set(position.x, position.y - 1.5, position.z)
    this.dai.castShadow = true
    this.dai.receiveShadow = true
    this.group.add(this.dai)
  }

  private createLeaf(): void {
    const leafGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.15)
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 })
    this.leaf = new THREE.Mesh(leafGeometry, leafMaterial)
    this.leaf.rotation.z = Math.PI / 6
    this.group.add(this.leaf)
  }

  /**
   * 物理演算結果をメッシュに同期
   */
  update(_delta: number): void {
    this.baseMochi.syncMeshWithBody()
    this.topMochi.syncMeshWithBody()
    this.mikanMochi.syncMeshWithBody()

    // 葉をみかんに追従
    if (this.leaf) {
      const mikanPos = this.mikanMochi.position
      this.leaf.position.set(
        mikanPos.x,
        mikanPos.y + MOCHI_CONFIGS.mikan.radius + 0.01,
        mikanPos.z
      )
    }
  }

  /**
   * 浮遊力を適用（IntroScene用）
   * @param time 現在時刻（Date.now() * 0.002 など）
   * @param amplitude 力の振幅
   */
  applyFloatForce(time: number, amplitude: number): void {
    // 重力に打ち勝つ上向きの力 + sin波で揺らぎ
    const baseForce = amplitude * 3 // 重力との釣り合い
    const waveForce = Math.sin(time) * amplitude

    const force = new CANNON.Vec3(0, baseForce + waveForce, 0)

    this.baseMochi.applyForce(force)
    this.topMochi.applyForce(force)
    this.mikanMochi.applyForce(force)
  }

  /**
   * 表示状態を適用（ResultScene用）
   */
  applyDisplayState(state: MochiDisplayState): void {
    if (state.baseOpacity !== undefined) {
      this.baseMochi.setOpacity(state.baseOpacity)
    }
    if (state.topOpacity !== undefined) {
      this.topMochi.setOpacity(state.topOpacity)
    }
    if (state.mikanOpacity !== undefined) {
      this.mikanMochi.setOpacity(state.mikanOpacity)
    }

    // 物理ボディの位置オフセット
    if (state.baseOffset) {
      this.baseMochi.body.position.x += state.baseOffset.x
      this.baseMochi.body.position.z += state.baseOffset.z
    }
    if (state.topOffset) {
      this.topMochi.body.position.x += state.topOffset.x
      this.topMochi.body.position.z += state.topOffset.z
    }
    if (state.mikanOffset) {
      this.mikanMochi.body.position.x += state.mikanOffset.x
      this.mikanMochi.body.position.z += state.mikanOffset.z
    }
  }

  /**
   * シーンに追加
   */
  addToScene(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  /**
   * シーンから削除
   */
  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.group)
  }

  /**
   * 全体の位置を設定
   */
  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z)
  }

  /**
   * 餅オブジェクトへのアクセサ
   */
  getBaseMochi(): MochiObject {
    return this.baseMochi
  }

  getTopMochi(): MochiObject {
    return this.topMochi
  }

  getMikanMochi(): MochiObject {
    return this.mikanMochi
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    // 物理ボディを削除
    this.physicsContext.removeBody(this.baseMochi.body)
    this.physicsContext.removeBody(this.topMochi.body)
    this.physicsContext.removeBody(this.mikanMochi.body)
    if (this.groundBody) {
      this.physicsContext.removeBody(this.groundBody)
    }

    // メッシュのジオメトリとマテリアルを破棄
    this.baseMochi.mesh.geometry.dispose()
    this.topMochi.mesh.geometry.dispose()
    this.mikanMochi.mesh.geometry.dispose()

    if (this.baseMochi.mesh.material instanceof THREE.Material) {
      this.baseMochi.mesh.material.dispose()
    }
    if (this.topMochi.mesh.material instanceof THREE.Material) {
      this.topMochi.mesh.material.dispose()
    }
    if (this.mikanMochi.mesh.material instanceof THREE.Material) {
      this.mikanMochi.mesh.material.dispose()
    }

    if (this.dai) {
      this.dai.geometry.dispose()
      if (this.dai.material instanceof THREE.Material) {
        this.dai.material.dispose()
      }
    }

    if (this.leaf) {
      this.leaf.geometry.dispose()
      if (this.leaf.material instanceof THREE.Material) {
        this.leaf.material.dispose()
      }
    }

    // グループから全て削除
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
  }
}
