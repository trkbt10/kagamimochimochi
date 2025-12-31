import * as CANNON from 'cannon-es'

type StickyConnection = {
  spring: CANNON.Spring
  bodyA: CANNON.Body // 下のオブジェクト
  bodyB: CANNON.Body // 上のオブジェクト
  createdAt: number
}

export class StickinessManager {
  private connections: StickyConnection[] = []

  // 粘性パラメータ
  private readonly STIFFNESS = 50 // バネの強さ
  private readonly DAMPING = 5 // 減衰
  private readonly REST_LENGTH = 0.1 // 静止時の距離
  private readonly BREAK_VELOCITY = 8 // この相対速度を超えると離れる
  private readonly MIN_CONTACT_TIME = 0.3 // 最低接触時間（秒）
  private readonly MAX_DISTANCE = 2.0 // この距離を超えると離れる

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_world: CANNON.World) {
    // worldは将来の拡張用に受け取るが、現在はSpringが内部で参照するため不要
  }

  /**
   * 衝突時に呼ばれる - 「上に乗った」かを判定
   */
  onCollision(
    bodyA: CANNON.Body,
    bodyB: CANNON.Body,
    contactNormal: CANNON.Vec3
  ): void {
    // 既に接続済みかチェック
    if (this.hasConnection(bodyA, bodyB)) return

    // 「上に乗った」の判定: 接触法線がほぼ上向き(Y > 0.7)
    if (Math.abs(contactNormal.y) < 0.7) return

    // どちらが上かを判定（Y座標で比較）
    const [lower, upper] =
      bodyA.position.y < bodyB.position.y ? [bodyA, bodyB] : [bodyB, bodyA]

    this.createConnection(lower, upper)
  }

  private createConnection(lower: CANNON.Body, upper: CANNON.Body): void {
    // 接触点を計算（上のオブジェクトの底面中心付近）
    const anchorLower = new CANNON.Vec3(
      upper.position.x - lower.position.x,
      upper.position.y - lower.position.y - 0.1,
      upper.position.z - lower.position.z
    )
    const anchorUpper = new CANNON.Vec3(0, -0.1, 0)

    const spring = new CANNON.Spring(lower, upper, {
      restLength: this.REST_LENGTH,
      stiffness: this.STIFFNESS,
      damping: this.DAMPING,
      localAnchorA: anchorLower,
      localAnchorB: anchorUpper
    })

    this.connections.push({
      spring,
      bodyA: lower,
      bodyB: upper,
      createdAt: Date.now()
    })
  }

  /**
   * 毎フレーム呼び出し - バネの力を適用し、離脱条件をチェック
   */
  update(): void {
    const now = Date.now()

    for (let i = this.connections.length - 1; i >= 0; i--) {
      const conn = this.connections[i]

      // バネの力を適用
      conn.spring.applyForce()

      // 離脱条件のチェック
      if (this.shouldBreak(conn, now)) {
        this.connections.splice(i, 1)
      }
    }
  }

  private shouldBreak(conn: StickyConnection, now: number): boolean {
    // 最低接触時間をまだ満たしていない場合は離れない
    const elapsed = (now - conn.createdAt) / 1000
    if (elapsed < this.MIN_CONTACT_TIME) return false

    // 相対位置を計算
    const relPos = new CANNON.Vec3()
    conn.bodyB.position.vsub(conn.bodyA.position, relPos)

    // 距離が大きすぎる場合
    const distance = relPos.length()
    if (distance > this.MAX_DISTANCE) return true

    // 相対速度を計算
    const relVel = new CANNON.Vec3()
    conn.bodyB.velocity.vsub(conn.bodyA.velocity, relVel)

    // 上向きの相対速度が大きすぎる場合
    if (relVel.y > this.BREAK_VELOCITY) return true

    return false
  }

  private hasConnection(bodyA: CANNON.Body, bodyB: CANNON.Body): boolean {
    return this.connections.some(
      (c) =>
        (c.bodyA === bodyA && c.bodyB === bodyB) ||
        (c.bodyA === bodyB && c.bodyB === bodyA)
    )
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    this.connections = []
  }
}
