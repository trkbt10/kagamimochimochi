import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { gsap } from 'gsap'
import type { ExtrudeTextOptions, TextPathData } from './types'

export class ExtrudedText {
  private group: THREE.Group
  private meshes: THREE.Mesh[] = []
  private shineLight: THREE.SpotLight | null = null

  /**
   * @param svgStringOrData SVG文字列、またはTextPathDataオブジェクト
   * @param options 押し出しオプション
   */
  constructor(svgStringOrData: string | TextPathData, options: ExtrudeTextOptions) {
    this.group = new THREE.Group()

    if (typeof svgStringOrData === 'string') {
      // 後方互換性：SVG文字列の場合は幾何学的中心を使用
      this.createMeshFromSVG(svgStringOrData, options)
    } else {
      // TextPathDataの場合は視覚的重心を使用
      this.createMeshFromSVG(svgStringOrData.svg, options, {
        originX: svgStringOrData.originX,
        originY: svgStringOrData.originY
      })
    }

    this.createShineLight()
  }

  private createMeshFromSVG(
    svgString: string,
    options: ExtrudeTextOptions,
    visualCenter?: { originX: number; originY: number }
  ) {
    const loader = new SVGLoader()
    const svgData = loader.parse(svgString)

    // SVGのバウンディングボックスを計算してセンタリング用に使用
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    for (const path of svgData.paths) {
      const shapes = SVGLoader.createShapes(path)

      for (const shape of shapes) {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: options.depth,
          bevelEnabled: true,
          bevelThickness: options.bevelThickness,
          bevelSize: options.bevelSize,
          bevelOffset: 0,
          bevelSegments: options.bevelSegments,
        })

        // バウンディングボックスを更新
        geometry.computeBoundingBox()
        if (geometry.boundingBox) {
          minX = Math.min(minX, geometry.boundingBox.min.x)
          minY = Math.min(minY, geometry.boundingBox.min.y)
          maxX = Math.max(maxX, geometry.boundingBox.max.x)
          maxY = Math.max(maxY, geometry.boundingBox.max.y)
        }

        // マテリアル（前面と側面で異なる色）
        const materials = [
          this.createFrontMaterial(options), // 前面
          this.createSideMaterial(options), // 側面（ベベル含む）
        ]

        const mesh = new THREE.Mesh(geometry, materials)
        this.meshes.push(mesh)
        this.group.add(mesh)
      }
    }

    // センタリング：視覚的重心が指定されていればそれを使用、なければ幾何学的中心
    const centerX = visualCenter?.originX ?? (minX + maxX) / 2
    const centerY = visualCenter?.originY ?? (minY + maxY) / 2
    this.group.position.set(-centerX, -centerY, 0)

    // Y軸を反転（SVGは上が正、Three.jsは下が正のため）
    this.group.scale.y = -1
  }

  private createFrontMaterial(options: ExtrudeTextOptions): THREE.Material {
    return new THREE.MeshStandardMaterial({
      color: options.frontColor,
      metalness: 0.3,
      roughness: 0.4,
      side: THREE.FrontSide,
    })
  }

  private createSideMaterial(options: ExtrudeTextOptions): THREE.Material {
    return new THREE.MeshStandardMaterial({
      color: options.sideColor,
      metalness: 0.5,
      roughness: 0.3,
      side: THREE.FrontSide,
    })
  }

  private createShineLight() {
    // 光沢アニメーション用のスポットライト
    this.shineLight = new THREE.SpotLight(0xffffff, 3)
    this.shineLight.angle = Math.PI / 4
    this.shineLight.penumbra = 0.5
    this.shineLight.distance = 200
    this.shineLight.position.set(-100, 0, 50)

    // ライトターゲットを追加
    const target = new THREE.Object3D()
    target.position.set(0, 0, 0)
    this.group.add(target)
    this.shineLight.target = target

    this.group.add(this.shineLight)
  }

  playShineAnimation() {
    if (!this.shineLight) return

    // ライトを左から右へ移動させて光沢アニメーション
    gsap.fromTo(
      this.shineLight.position,
      { x: -100 },
      { x: 100, duration: 0.5, ease: 'power2.inOut' }
    )
  }

  getGroup(): THREE.Group {
    return this.group
  }

  dispose() {
    // メッシュのクリーンアップ
    for (const mesh of this.meshes) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose())
      } else {
        mesh.material.dispose()
      }
    }
    this.meshes = []

    // ライトのクリーンアップ
    if (this.shineLight) {
      this.group.remove(this.shineLight)
      this.shineLight.dispose()
      this.shineLight = null
    }

    // グループから全ての子を削除
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
  }
}
