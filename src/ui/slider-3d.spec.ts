import { describe, test, expect, mock } from 'bun:test'
import { Slider3D } from './slider-3d'
import * as THREE from 'three'

// createTextSprite をモック（DOM依存のため）
mock.module('./text-sprite', () => ({
  createTextSprite: () => {
    const sprite = new THREE.Sprite()
    sprite.scale.set(1, 0.5, 1)
    return sprite
  }
}))

describe('Slider3D', () => {
  test('THREE.Group を継承している', () => {
    const slider = new Slider3D({ label: 'Test' })

    expect(slider).toBeInstanceOf(THREE.Group)
  })

  test('デフォルトオプションで作成できる', () => {
    const slider = new Slider3D({ label: 'Test' })

    expect(slider.getValue()).toBe(0.7)
    expect(slider.getWidth()).toBe(2)
  })

  test('初期値を設定できる', () => {
    const slider = new Slider3D({ label: 'Test', initialValue: 0.5 })

    expect(slider.getValue()).toBe(0.5)
  })

  test('min/max を設定できる', () => {
    const slider = new Slider3D({
      label: 'Test',
      min: 10,
      max: 100,
      initialValue: 50
    })

    expect(slider.getValue()).toBe(50)
  })

  test('setValue で値を更新できる', () => {
    const slider = new Slider3D({ label: 'Test' })

    slider.setValue(0.3)
    expect(slider.getValue()).toBe(0.3)
  })

  test('setValue は min/max でクランプされる', () => {
    const slider = new Slider3D({ label: 'Test', min: 0, max: 1 })

    slider.setValue(-0.5)
    expect(slider.getValue()).toBe(0)

    slider.setValue(1.5)
    expect(slider.getValue()).toBe(1)
  })

  test('setValueFromPosition で正規化された位置から値を設定できる', () => {
    const slider = new Slider3D({
      label: 'Test',
      min: 0,
      max: 100,
      initialValue: 0
    })

    slider.setValueFromPosition(0.5)
    expect(slider.getValue()).toBe(50)
  })

  test('onChange コールバックが呼ばれる', () => {
    const tracker = { value: 0 }
    const slider = new Slider3D({
      label: 'Test',
      onChange: (v) => {
        tracker.value = v
      }
    })

    slider.setValueFromPosition(0.5)
    expect(tracker.value).toBe(0.5)
  })

  test('setDragging でドラッグ状態を設定できる', () => {
    const slider = new Slider3D({ label: 'Test' })

    expect(slider.getIsDragging()).toBe(false)

    slider.setDragging(true)
    expect(slider.getIsDragging()).toBe(true)

    slider.setDragging(false)
    expect(slider.getIsDragging()).toBe(false)
  })

  test('setDragging でハンドルの emissive が変化する', () => {
    const slider = new Slider3D({ label: 'Test' })
    const handle = slider.getHandle()
    const material = handle.material as THREE.MeshStandardMaterial

    slider.setDragging(true)
    expect(material.emissive.getHex()).toBe(0x444444)

    slider.setDragging(false)
    expect(material.emissive.getHex()).toBe(0x000000)
  })

  test('getTrack でトラックメッシュを取得できる', () => {
    const slider = new Slider3D({ label: 'Test' })
    const track = slider.getTrack()

    expect(track).toBeInstanceOf(THREE.Mesh)
    expect(track.userData.slider).toBe(slider)
  })

  test('getHandle でハンドルメッシュを取得できる', () => {
    const slider = new Slider3D({ label: 'Test' })
    const handle = slider.getHandle()

    expect(handle).toBeInstanceOf(THREE.Mesh)
    expect(handle.userData.slider).toBe(slider)
  })
})
