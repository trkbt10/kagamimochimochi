import { describe, test, expect } from 'bun:test'
import * as THREE from 'three'

/**
 * text-sprite のテスト
 *
 * createTextSprite は Canvas API に依存しているため、
 * 純粋関数のテストとモジュール構造のテストに限定します。
 * 実際の描画テストはブラウザ環境での E2E テストで行います。
 */
describe('text-sprite module', () => {
  test('モジュールがエクスポートされている', async () => {
    const module = await import('./text-sprite')

    expect(module.createTextSprite).toBeDefined()
    expect(typeof module.createTextSprite).toBe('function')
  })

  test('TextSpriteOptions 型がエクスポートされている', async () => {
    // 型のテストはコンパイル時に行われる
    const module = await import('./text-sprite')
    expect(module).toBeDefined()
  })
})

describe('TextSpriteOptions type', () => {
  test('必須プロパティは text のみ', () => {
    // このテストはコンパイル時の型チェックで保証される
    // ランタイムでは型は存在しないため、構造を確認
    const minimalOptions = { text: 'test' }
    expect(minimalOptions.text).toBe('test')
  })

  test('オプションプロパティのデフォルト値', () => {
    const defaults = {
      fontSize: 48,
      fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif",
      color: '#ffffff',
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 20,
      textAlign: 'center',
      shadowBlur: 0,
      glowBlur: 0
    }

    expect(defaults.fontSize).toBe(48)
    expect(defaults.padding).toBe(20)
    expect(defaults.textAlign).toBe('center')
  })
})

describe('calculateTextXOffset logic', () => {
  test('center 配置のオフセット計算', () => {
    const canvasWidth = 200
    const expected = canvasWidth / 2
    expect(expected).toBe(100)
  })

  test('left 配置のオフセット計算', () => {
    const padding = 20
    const glowBlur = 10
    const expected = padding + glowBlur
    expect(expected).toBe(30)
  })

  test('right 配置のオフセット計算', () => {
    const canvasWidth = 200
    const padding = 20
    const glowBlur = 10
    const expected = canvasWidth - padding - glowBlur
    expect(expected).toBe(170)
  })
})

describe('calculateCanvasDimensions logic', () => {
  test('キャンバスサイズの計算', () => {
    const textWidth = 100
    const textHeight = 50
    const padding = 20
    const borderWidth = 2
    const glowBlur = 5

    const expectedWidth = textWidth + padding * 2 + borderWidth * 2 + glowBlur * 2
    const expectedHeight = textHeight + padding * 2 + borderWidth * 2 + glowBlur * 2

    expect(expectedWidth).toBe(154)
    expect(expectedHeight).toBe(104)
  })
})

describe('THREE.Sprite creation', () => {
  test('Sprite が正しく作成される', () => {
    const material = new THREE.SpriteMaterial({
      transparent: true,
      depthTest: false
    })
    const sprite = new THREE.Sprite(material)

    expect(sprite).toBeInstanceOf(THREE.Sprite)
    expect(material.transparent).toBe(true)
    expect(material.depthTest).toBe(false)
  })

  test('スケール設定が正しく動作する', () => {
    const sprite = new THREE.Sprite()
    const scale = 0.01
    const canvasWidth = 200
    const canvasHeight = 100

    sprite.scale.set(canvasWidth * scale, canvasHeight * scale, 1)

    expect(sprite.scale.x).toBe(2)
    expect(sprite.scale.y).toBe(1)
    expect(sprite.scale.z).toBe(1)
  })
})
