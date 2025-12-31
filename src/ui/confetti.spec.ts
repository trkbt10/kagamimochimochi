import { describe, test, expect, beforeAll } from 'bun:test'
import { createConfettiSystem, updateConfetti } from './confetti'
import * as THREE from 'three'

describe('createConfettiSystem', () => {
  test('指定した数のパーティクルが作成される', () => {
    const count = 100
    const confetti = createConfettiSystem(count)

    const positions = confetti.geometry.getAttribute('position')
    expect(positions.count).toBe(count)
  })

  test('デフォルトで200個のパーティクルが作成される', () => {
    const confetti = createConfettiSystem()

    const positions = confetti.geometry.getAttribute('position')
    expect(positions.count).toBe(200)
  })

  test('色属性が設定される', () => {
    const confetti = createConfettiSystem(10)

    const colors = confetti.geometry.getAttribute('color')
    expect(colors).toBeDefined()
    expect(colors.count).toBe(10)
  })

  test('velocities が userData に保存される', () => {
    const count = 50
    const confetti = createConfettiSystem(count)

    expect(confetti.geometry.userData.velocities).toBeDefined()
    expect(confetti.geometry.userData.velocities.length).toBe(count * 3)
  })

  test('rotations が userData に保存される', () => {
    const count = 50
    const confetti = createConfettiSystem(count)

    expect(confetti.geometry.userData.rotations).toBeDefined()
    expect(confetti.geometry.userData.rotations.length).toBe(count)
  })

  test('位置が適切な範囲に初期化される', () => {
    const confetti = createConfettiSystem(100)
    const positions = confetti.geometry.getAttribute('position')

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i)
      expect(y).toBeGreaterThanOrEqual(10)
      expect(y).toBeLessThanOrEqual(25)
    }
  })
})

describe('updateConfetti', () => {
  test('パーティクルの位置が更新される', () => {
    const confetti = createConfettiSystem(10)
    const positions = confetti.geometry.getAttribute('position')

    const initialY = positions.getY(0)
    updateConfetti(confetti, 0.1)

    const newY = positions.getY(0)
    expect(newY).not.toBe(initialY)
  })

  test('位置属性が更新される', () => {
    const confetti = createConfettiSystem(10)
    const positions = confetti.geometry.getAttribute('position')

    const initialPositions: number[] = []
    for (let i = 0; i < positions.count; i++) {
      initialPositions.push(positions.getX(i), positions.getY(i), positions.getZ(i))
    }

    updateConfetti(confetti, 0.5)

    const getPositionComponent = (positions: THREE.BufferAttribute, i: number, component: number): number => {
      if (component === 0) return positions.getX(i)
      if (component === 1) return positions.getY(i)
      return positions.getZ(i)
    }

    const hasChanged = initialPositions.some((val, idx) => {
      const i = Math.floor(idx / 3)
      const component = idx % 3
      const current = getPositionComponent(positions, i, component)
      return val !== current
    })

    expect(hasChanged).toBe(true)
  })

  test('下に落ちたパーティクルがリセットされる', () => {
    const confetti = createConfettiSystem(1)
    const positions = confetti.geometry.getAttribute('position')

    // 強制的に下に移動
    positions.setY(0, -10)

    updateConfetti(confetti, 0.1)

    const newY = positions.getY(0)
    expect(newY).toBeGreaterThanOrEqual(15)
  })
})
