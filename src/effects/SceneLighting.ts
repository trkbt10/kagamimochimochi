import * as THREE from 'three'

export type LightingPreset = 'intro' | 'result' | 'game'

export interface SceneLightingOptions {
  accentColor?: number
}

/**
 * シーン別ライティング管理クラス
 * 各シーンに最適化されたライト設定をプリセットとして提供
 * 影設定を共通化し、モアレを防止
 */
export class SceneLighting {
  private lights: THREE.Light[] = []
  private fog: THREE.FogExp2 | null = null
  private scene: THREE.Scene | null = null

  // 動的ライト参照（GameScene用）
  private mainLight: THREE.DirectionalLight | null = null
  private ambientLight: THREE.AmbientLight | null = null

  constructor(
    private preset: LightingPreset,
    private options: SceneLightingOptions = {}
  ) {
    this.createLights()
  }

  /**
   * 共通の影設定を適用（モアレ防止）
   */
  private configureShadow(
    light: THREE.DirectionalLight | THREE.SpotLight
  ): void {
    light.castShadow = true
    light.shadow.mapSize.width = 2048
    light.shadow.mapSize.height = 2048
    light.shadow.bias = -0.0005
    light.shadow.normalBias = 0.02
  }

  private createLights(): void {
    switch (this.preset) {
      case 'intro':
        this.createIntroLights()
        break
      case 'result':
        this.createResultLights()
        break
      case 'game':
        this.createGameLights()
        break
    }
  }

  /**
   * Introシーン用ライト（夜空 + 月明かり + ゴールドスポット）
   */
  private createIntroLights(): void {
    // 月明かり（青白い光）
    const moonLight = new THREE.DirectionalLight(0x8888ff, 0.4)
    moonLight.position.set(-10, 15, -5)
    this.lights.push(moonLight)

    // 環境光 - 夜なので少し暗め
    this.ambientLight = new THREE.AmbientLight(0x6666aa, 0.3)
    this.lights.push(this.ambientLight)

    // メインスポットライト - ゴールドで鏡餅を照らす
    const spotlight = new THREE.SpotLight(0xffd700, 3, 40, Math.PI / 4, 0.5, 1)
    spotlight.position.set(0, 15, 5)
    this.configureShadow(spotlight)
    this.lights.push(spotlight)

    // 前面光（UI可視性確保）
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.4)
    frontLight.position.set(0, 5, 10)
    this.lights.push(frontLight)

    // ポイントライト - 赤とゴールドでお正月感
    const redLight = new THREE.PointLight(0xff3333, 1.2, 25)
    redLight.position.set(-5, 3, -3)
    this.lights.push(redLight)

    const goldLight = new THREE.PointLight(0xffd700, 1.2, 25)
    goldLight.position.set(5, 3, -3)
    this.lights.push(goldLight)

    // 霧 - 夜空に合わせた色
    this.fog = new THREE.FogExp2(0x0a0a1e, 0.008)
  }

  /**
   * Resultシーン用ライト（朝焼け + 太陽光）
   */
  private createResultLights(): void {
    // 朝日の暖かい光
    const sunLight = new THREE.DirectionalLight(0xffddaa, 1.2)
    sunLight.position.set(5, 10, -5)
    this.configureShadow(sunLight)
    this.lights.push(sunLight)

    // 環境光 - 明るめ
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.lights.push(this.ambientLight)

    // スポットライト
    const spotlight = new THREE.SpotLight(0xffd700, 2, 30, Math.PI / 4, 0.5)
    spotlight.position.set(0, 15, 5)
    this.configureShadow(spotlight)
    this.lights.push(spotlight)

    // アクセントライト（スコアティアで色が変わる）
    const accentColor = this.options.accentColor ?? 0xffd700
    const accentLight = new THREE.PointLight(accentColor, 1, 20)
    accentLight.position.set(0, 5, 5)
    this.lights.push(accentLight)

    // 霧 - 朝焼け色
    this.fog = new THREE.FogExp2(0xff8060, 0.015)
  }

  /**
   * Gameシーン用ライト（動的ライト・時刻連動）
   */
  private createGameLights(): void {
    // 月明かり
    const moonLight = new THREE.DirectionalLight(0x8888ff, 0.3)
    moonLight.position.set(-10, 15, -5)
    this.lights.push(moonLight)

    // 環境光（動的）
    this.ambientLight = new THREE.AmbientLight(0x6666aa, 0.3)
    this.lights.push(this.ambientLight)

    // メインライト（動的・影あり）
    this.mainLight = new THREE.DirectionalLight(0xffffff, 0.5)
    this.mainLight.position.set(5, 10, 5)
    this.configureShadow(this.mainLight)
    this.lights.push(this.mainLight)

    // ターゲットスポットライト
    const targetSpotlight = new THREE.SpotLight(0xffd700, 1, 30, Math.PI / 6, 0.5)
    targetSpotlight.position.set(0, 15, 0)
    this.lights.push(targetSpotlight)

    // ターゲット発光
    const targetGlow = new THREE.PointLight(0xffd700, 0.5, 5)
    targetGlow.position.set(0, -1, 0)
    this.lights.push(targetGlow)

    // 霧 - 夜空色（動的に変更可能）
    this.fog = new THREE.FogExp2(0x0a0a1e, 0.01)
  }

  /**
   * シーンにライトと霧を追加
   */
  addToScene(scene: THREE.Scene): void {
    this.scene = scene

    for (const light of this.lights) {
      scene.add(light)
    }

    if (this.fog) {
      scene.fog = this.fog
    }
  }

  /**
   * GameScene用: 時刻に応じた動的更新
   */
  updateTimeOfDay(skyTime: number): void {
    if (this.preset !== 'game') return

    // 時刻に応じて色を補間
    if (skyTime < 0.4) {
      // 夜
      this.ambientLight?.color.setHex(0x6666aa)
      this.mainLight?.color.setHex(0xffffff)
      this.fog?.color.setHex(0x0a0a1e)
    } else if (skyTime < 0.8) {
      // 薄明
      const t = (skyTime - 0.4) / 0.4
      this.ambientLight?.color.lerpColors(
        new THREE.Color(0x6666aa),
        new THREE.Color(0xffffff),
        t
      )
      this.mainLight?.color.lerpColors(
        new THREE.Color(0xffffff),
        new THREE.Color(0xffddaa),
        t
      )
      this.fog?.color.lerpColors(
        new THREE.Color(0x0a0a1e),
        new THREE.Color(0xff8060),
        t
      )
    } else {
      // 朝
      this.ambientLight?.color.setHex(0xffffff)
      this.mainLight?.color.setHex(0xffddaa)
      this.fog?.color.setHex(0xff8060)
    }
  }

  /**
   * アクセントカラーを変更（ResultScene用）
   */
  setAccentColor(color: number): void {
    // アクセントライト（PointLightの最後のもの）を探して色を変更
    for (const light of this.lights) {
      if (light instanceof THREE.PointLight && light.position.z === 5) {
        light.color.setHex(color)
        break
      }
    }
  }

  /**
   * メインライトへの参照を取得（GameScene用）
   */
  getMainLight(): THREE.DirectionalLight | null {
    return this.mainLight
  }

  /**
   * 霧への参照を取得
   */
  getFog(): THREE.FogExp2 | null {
    return this.fog
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    if (this.scene) {
      for (const light of this.lights) {
        this.scene.remove(light)
      }
      if (this.fog && this.scene.fog === this.fog) {
        this.scene.fog = null
      }
    }

    this.lights = []
    this.fog = null
    this.mainLight = null
    this.ambientLight = null
    this.scene = null
  }
}
