import * as THREE from 'three'

/**
 * 発射パラメータの型定義
 */
export type LaunchParameters = {
  /** 水平方向の角度（度） -60 ~ 60 */
  angleH: number
  /** 仰角（度） 15 ~ 75 */
  angleV: number
  /** パワー 0 ~ 100 */
  power: number
  /** 発射位置 */
  launchPosition: THREE.Vector3
}

/**
 * 発射パラメータの初期値
 */
export const LAUNCH_DEFAULTS: Readonly<LaunchParameters> = {
  angleH: 0,
  angleV: 45,
  power: 50,
  launchPosition: new THREE.Vector3(0, 0, 10)
}

/**
 * 発射パラメータの初期値を生成（新しいVector3インスタンスを含む）
 */
export const createDefaultLaunchParameters = (): LaunchParameters => ({
  angleH: LAUNCH_DEFAULTS.angleH,
  angleV: LAUNCH_DEFAULTS.angleV,
  power: LAUNCH_DEFAULTS.power,
  launchPosition: LAUNCH_DEFAULTS.launchPosition.clone()
})

// ゲージ値から角度への変換
/**
 * ゲージ値から水平角度を計算
 * @param gaugeValue 0-100のゲージ値
 * @returns 水平角度（度）
 */
export const gaugeToAngleH = (gaugeValue: number): number => (gaugeValue - 50) * 1.2

/**
 * ゲージ値から仰角を計算
 * @param gaugeValue 0-100のゲージ値
 * @returns 仰角（度）
 */
export const gaugeToAngleV = (gaugeValue: number): number => 15 + gaugeValue * 0.6

// パワー計算
/**
 * パワーから速度乗数を計算
 * @param power 0-100のパワー値
 * @returns 速度乗数 0.12 ~ 0.27
 */
export const calculatePowerMultiplier = (power: number): number => 0.12 + (power / 100) * 0.15

/**
 * 速度乗数から実際の速度を計算
 * @param powerMultiplier 速度乗数
 * @returns 速度 (m/s)
 */
export const calculateSpeed = (powerMultiplier: number): number => 8 + powerMultiplier * 20

// 角度変換ユーティリティ
/**
 * 度数法からラジアンに変換
 */
export const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * 発射パラメータから初速度ベクトルを計算
 */
export const calculateInitialVelocity = (params: LaunchParameters): THREE.Vector3 => {
  const { angleH, angleV, power } = params
  const powerMultiplier = calculatePowerMultiplier(power)
  const speed = calculateSpeed(powerMultiplier)

  const hRad = degreesToRadians(angleH)
  const vRad = degreesToRadians(angleV)

  return new THREE.Vector3(
    Math.sin(hRad) * speed * Math.cos(vRad),
    Math.sin(vRad) * speed,
    -Math.cos(hRad) * speed * Math.cos(vRad)
  )
}
