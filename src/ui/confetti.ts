import * as THREE from 'three'

/**
 * 紙吹雪の色オプション [R, G, B]
 */
const CONFETTI_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0.84, 0],      // Gold
  [1, 0.42, 0.42],   // Red
  [0.31, 0.8, 0.77], // Cyan
  [0.27, 0.72, 0.82], // Light blue
  [0.59, 0.81, 0.71], // Green
  [1, 0.55, 0]       // Orange
] as const

type ConfettiGeometryData = {
  positions: Float32Array
  colors: Float32Array
  velocities: Float32Array
  rotations: Float32Array
}

/**
 * ランダムな色を選択する
 */
function selectRandomColor(): readonly [number, number, number] {
  const index = Math.floor(Math.random() * CONFETTI_COLORS.length)
  return CONFETTI_COLORS[index]
}

/**
 * 紙吹雪のジオメトリデータを生成する
 */
function generateConfettiData(count: number): ConfettiGeometryData {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const rotations = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const baseIndex = i * 3

    // 位置（上から降る）
    positions[baseIndex] = (Math.random() - 0.5) * 20
    positions[baseIndex + 1] = Math.random() * 15 + 10
    positions[baseIndex + 2] = (Math.random() - 0.5) * 10

    // 色
    const color = selectRandomColor()
    colors[baseIndex] = color[0]
    colors[baseIndex + 1] = color[1]
    colors[baseIndex + 2] = color[2]

    // 速度
    velocities[baseIndex] = (Math.random() - 0.5) * 2
    velocities[baseIndex + 1] = -Math.random() * 3 - 2
    velocities[baseIndex + 2] = (Math.random() - 0.5) * 2

    // 回転
    rotations[i] = Math.random() * Math.PI * 2
  }

  return { positions, colors, velocities, rotations }
}

/**
 * 紙吹雪パーティクルシステムを作成する
 */
export function createConfettiSystem(count: number = 200): THREE.Points {
  const data = generateConfettiData(count)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  geometry.userData = { velocities: data.velocities, rotations: data.rotations }

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 1
  })

  return new THREE.Points(geometry, material)
}

type ParticlePosition = {
  x: number
  y: number
  z: number
}

/**
 * パーティクルの新しい位置を計算する
 */
function calculateNewPosition(
  current: ParticlePosition,
  velocities: Float32Array,
  index: number,
  delta: number,
  time: number
): ParticlePosition {
  const baseIndex = index * 3

  const newX = current.x + velocities[baseIndex] * delta + Math.sin(time * 0.001 + index) * 0.01
  const newZ = current.z + velocities[baseIndex + 2] * delta + Math.cos(time * 0.001 + index) * 0.01
  const newY = current.y + velocities[baseIndex + 1] * delta

  // 下に落ちたらリセット
  if (newY < -5) {
    return {
      x: (Math.random() - 0.5) * 20,
      y: 15 + Math.random() * 5,
      z: newZ
    }
  }

  return { x: newX, y: newY, z: newZ }
}

/**
 * 紙吹雪をアニメーションする
 */
export function updateConfetti(confetti: THREE.Points, delta: number): void {
  const positions = confetti.geometry.getAttribute('position')
  const velocities = confetti.geometry.userData.velocities as Float32Array
  const time = Date.now()

  for (let i = 0; i < positions.count; i++) {
    const current: ParticlePosition = {
      x: positions.getX(i),
      y: positions.getY(i),
      z: positions.getZ(i)
    }

    const newPos = calculateNewPosition(current, velocities, i, delta, time)
    positions.setXYZ(i, newPos.x, newPos.y, newPos.z)
  }

  positions.needsUpdate = true
}
