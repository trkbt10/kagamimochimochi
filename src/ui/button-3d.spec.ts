import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { Button3D } from './button-3d'
import * as THREE from 'three'

// createTextSprite をモック（DOM依存のため）
mock.module('./text-sprite', () => ({
  createTextSprite: () => {
    const sprite = new THREE.Sprite()
    sprite.scale.set(1, 0.5, 1)
    return sprite
  }
}))

describe('Button3D', () => {
  test('THREE.Group を継承している', () => {
    const button = new Button3D({ text: 'Test' })

    expect(button).toBeInstanceOf(THREE.Group)
  })

  test('デフォルトオプションで作成できる', () => {
    const button = new Button3D({ text: 'Test' })
    const mesh = button.getMesh()

    expect(mesh).toBeInstanceOf(THREE.Mesh)
  })

  test('onClick コールバックが設定される', () => {
    const tracker = { called: false }
    const callback = () => {
      tracker.called = true
    }

    const button = new Button3D({ text: 'Test', onClick: callback })
    button.onClick?.()

    expect(tracker.called).toBe(true)
  })

  test('setHovered でホバー状態が変化する', () => {
    const button = new Button3D({
      text: 'Test',
      backgroundColor: 0xff0000,
      hoverColor: 0x00ff00
    })
    const mesh = button.getMesh()
    const material = mesh.material as THREE.MeshStandardMaterial

    button.setHovered(true)
    expect(material.color.getHex()).toBe(0x00ff00)

    button.setHovered(false)
    expect(material.color.getHex()).toBe(0xff0000)
  })

  test('同じ状態への変更は無視される', () => {
    const button = new Button3D({ text: 'Test' })
    const initialZ = button.position.z

    button.setHovered(false)
    button.setHovered(false)

    expect(button.position.z).toBe(initialZ)
  })

  test('setPressed で押下状態が変化する', () => {
    const button = new Button3D({
      text: 'Test',
      backgroundColor: 0xff0000,
      activeColor: 0x0000ff
    })
    const mesh = button.getMesh()
    const material = mesh.material as THREE.MeshStandardMaterial
    const initialZ = button.position.z

    button.setPressed(true)
    expect(material.color.getHex()).toBe(0x0000ff)
    expect(button.position.z).toBeLessThan(initialZ)

    button.setPressed(false)
    expect(button.position.z).toBe(initialZ)
  })

  test('押下状態が優先される', () => {
    const button = new Button3D({
      text: 'Test',
      backgroundColor: 0xff0000,
      hoverColor: 0x00ff00,
      activeColor: 0x0000ff
    })
    const mesh = button.getMesh()
    const material = mesh.material as THREE.MeshStandardMaterial

    button.setHovered(true)
    button.setPressed(true)

    expect(material.color.getHex()).toBe(0x0000ff)
  })

  test('getMesh でメッシュを取得できる', () => {
    const button = new Button3D({ text: 'Test' })
    const mesh = button.getMesh()

    expect(mesh).toBeDefined()
    expect(mesh.userData.button).toBe(button)
  })

  test('メッシュの userData にボタン参照が保存される', () => {
    const button = new Button3D({ text: 'Test' })
    const mesh = button.getMesh()

    expect(mesh.userData.button).toBe(button)
  })

  test('子要素として mesh, edge, textSprite が追加される', () => {
    const button = new Button3D({ text: 'Test' })

    expect(button.children.length).toBe(3)
  })
})
