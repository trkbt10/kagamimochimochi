import * as CANNON from 'cannon-es'

export interface PhysicsContextConfig {
  gravity?: CANNON.Vec3
  stepRate?: number
  substeps?: number
}

/**
 * 軽量な物理ワールドラッパー
 * IntroScene/ResultSceneでMochiObjectを使用するための物理コンテキスト
 */
export class PhysicsContext {
  public readonly world: CANNON.World
  public readonly mochiMaterial: CANNON.Material
  public readonly groundMaterial: CANNON.Material

  private readonly stepRate: number
  private readonly substeps: number
  private bodies: Set<CANNON.Body> = new Set()

  constructor(config?: PhysicsContextConfig) {
    this.world = new CANNON.World()
    this.world.gravity.set(
      config?.gravity?.x ?? 0,
      config?.gravity?.y ?? -9.8,
      config?.gravity?.z ?? 0
    )
    this.world.broadphase = new CANNON.NaiveBroadphase()

    this.stepRate = config?.stepRate ?? 1 / 60
    this.substeps = config?.substeps ?? 3

    // マテリアル設定
    this.mochiMaterial = new CANNON.Material('mochi')
    this.groundMaterial = new CANNON.Material('ground')

    // 餅同士の接触
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.mochiMaterial, this.mochiMaterial, {
        friction: 1.5,
        restitution: 0.01
      })
    )

    // 餅と地面の接触
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.mochiMaterial, this.groundMaterial, {
        friction: 1.2,
        restitution: 0.02
      })
    )
  }

  /**
   * 物理ステップを進める
   */
  step(delta: number): void {
    this.world.step(this.stepRate, delta, this.substeps)
  }

  /**
   * ボディを追加
   */
  addBody(body: CANNON.Body): void {
    if (!this.bodies.has(body)) {
      this.world.addBody(body)
      this.bodies.add(body)
    }
  }

  /**
   * ボディを削除
   */
  removeBody(body: CANNON.Body): void {
    if (this.bodies.has(body)) {
      this.world.removeBody(body)
      this.bodies.delete(body)
    }
  }

  /**
   * 地面を作成して追加
   */
  createGround(y: number = 0): CANNON.Body {
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.groundMaterial
    })
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    groundBody.position.set(0, y, 0)
    this.addBody(groundBody)
    return groundBody
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    for (const body of this.bodies) {
      this.world.removeBody(body)
    }
    this.bodies.clear()
  }
}
