import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import type { LayoutInfo } from '../core/layout'
import { redistributeParticles, calculateLayoutScale } from '../core/layout'
import { createTextSprite } from '../ui/text-sprite'
import { Button3D } from '../ui/button-3d'
import { PhysicsContext, DecorativeMochiGroup } from '../objects'
import { SkyGradient } from '../effects/SkyGradient'
import { SceneLighting } from '../effects/SceneLighting'
import { SnowEffect } from '../effects/SnowEffect'
import { Kadomatsu } from '../objects/Kadomatsu'
import { MountainFuji } from '../objects/MountainFuji'
import { ExtrudedText, TEXT_PATH_DATA } from '../text-builder'
import type { GameMode } from '../types/game-mode'

// タイトル用の金ピカ赤フチどり設定
// 構成: 金(本体) → 赤(側面ふち) → 黒(外側ふち)
const TITLE_TEXT_OPTIONS = {
  depth: 10,
  bevelThickness: 2.5,
  bevelSize: 2,
  bevelSegments: 15, // 6→15に増加（滑らかなベベル）
  frontColor: 0xffd700, // ゴールド
  sideColor: 0xcc0000, // 赤（内側ふちどり）
  outlines: [
    { bevelOffset: 6, color: 0x000000 }, // 黒（最外側ふちどり）
    { bevelOffset: 3, color: 0xcc0000 }, // 赤（外側ふちどり）
  ],
}

export class IntroScene extends BaseScene {
  private particles: THREE.Points | null = null
  private physicsContext: PhysicsContext | null = null
  private decorativeMochi: DecorativeMochiGroup | null = null

  // お正月演出
  private skyGradient: SkyGradient | null = null
  private sceneLighting: SceneLighting | null = null
  private snowEffect: SnowEffect | null = null
  private kadomatsuLeft: Kadomatsu | null = null
  private kadomatsuRight: Kadomatsu | null = null
  private mountain: MountainFuji | null = null

  // UI要素
  private uiGroup: THREE.Group | null = null
  private title3D: ExtrudedText | null = null
  private titleContainer: THREE.Group | null = null
  private titleSub3D: ExtrudedText | null = null
  private titleSubContainer: THREE.Group | null = null
  private subtitleSprite: THREE.Sprite | null = null
  private instructionSprite: THREE.Sprite | null = null
  private normalModeButton: Button3D | null = null
  private endlessModeButton: Button3D | null = null

  // Raycaster
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hoveredButton: Button3D | null = null
  private activeButton: Button3D | null = null

  // イベントハンドラ
  private boundOnPointerMove: (e: PointerEvent) => void
  private boundOnPointerDown: (e: PointerEvent) => void
  private boundOnPointerUp: (e: PointerEvent) => void

  constructor(game: Game) {
    super(game)
    this.boundOnPointerMove = this.onPointerMove.bind(this)
    this.boundOnPointerDown = this.onPointerDown.bind(this)
    this.boundOnPointerUp = this.onPointerUp.bind(this)
  }

  async enter() {
    this.setupScene()
    this.buildUI3D()
    this.setupEventListeners()
    this.registerLayoutListener()
    this.animateIntro()
  }

  async exit() {
    this.removeEventListeners()
    this.unregisterLayoutListener()

    // お正月演出のクリーンアップ
    this.skyGradient?.dispose()
    this.sceneLighting?.dispose()
    this.snowEffect?.dispose()
    this.kadomatsuLeft?.dispose()
    this.kadomatsuRight?.dispose()
    this.mountain?.dispose()
    this.skyGradient = null
    this.sceneLighting = null
    this.snowEffect = null
    this.kadomatsuLeft = null
    this.kadomatsuRight = null
    this.mountain = null

    // 鏡餅のクリーンアップ
    this.decorativeMochi?.dispose()
    this.physicsContext?.dispose()
    this.decorativeMochi = null
    this.physicsContext = null

    // 3Dタイトルのクリーンアップ
    this.title3D?.dispose()
    this.titleSub3D?.dispose()
    this.title3D = null
    this.titleSub3D = null
    this.titleContainer = null
    this.titleSubContainer = null

    this.clearScene()
  }

  update(delta: number) {
    // 空と雪のアニメーション
    this.skyGradient?.update(delta)
    this.snowEffect?.update(delta)

    // Rotate particles
    if (this.particles) {
      this.particles.rotation.y += delta * 0.1
    }

    // 物理演算と鏡餅
    if (this.physicsContext && this.decorativeMochi) {
      this.physicsContext.step(delta)
      this.decorativeMochi.update(delta)

      // グループ全体を回転
      this.decorativeMochi.group.rotation.y += delta * 0.3
    }

    // UIをカメラに向ける
    if (this.uiGroup) {
      this.uiGroup.lookAt(this.game.camera.position)
    }
  }

  private setupScene() {
    // グラデーション空（夜空）
    this.skyGradient = new SkyGradient()
    this.skyGradient.timeOfDay = 0 // 夜空
    this.skyGradient.addToScene(this.scene)

    // 背景色は使わない（空で覆う）
    this.scene.background = null

    // ライティング設定（共通クラス使用）
    this.sceneLighting = new SceneLighting('intro')
    this.sceneLighting.addToScene(this.scene)

    // 雪エフェクト
    this.snowEffect = new SnowEffect()
    this.snowEffect.addToScene(this.scene)

    // 門松を左右に配置
    this.kadomatsuLeft = new Kadomatsu(0.8)
    this.kadomatsuLeft.setPosition(-5, -2, -2)
    this.kadomatsuLeft.addToScene(this.scene)

    this.kadomatsuRight = new Kadomatsu(0.8)
    this.kadomatsuRight.setPosition(5, -2, -2)
    this.kadomatsuRight.group.rotation.y = Math.PI // 反対向き
    this.kadomatsuRight.addToScene(this.scene)

    // 富士山を奥に配置
    this.mountain = new MountainFuji(1.5)
    this.mountain.setPosition(0, -2, -60)
    this.mountain.addToScene(this.scene)

    // Create floating particles (gold confetti)
    this.createParticles()

    // Create decorative kagamimochi
    this.createDecorativeKagamimochi()

    // Create tatami floor
    this.createFloor()
  }

  private createParticles() {
    const geometry = new THREE.BufferGeometry()
    const count = 500
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = Math.random() * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30

      // Gold/red colors
      if (Math.random() > 0.5) {
        colors[i * 3] = 1
        colors[i * 3 + 1] = 0.84
        colors[i * 3 + 2] = 0
      } else {
        colors[i * 3] = 0.8
        colors[i * 3 + 1] = 0.1
        colors[i * 3 + 2] = 0.1
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    })

    this.particles = new THREE.Points(geometry, material)
    this.scene.add(this.particles)
  }

  private createDecorativeKagamimochi() {
    // 弱い重力の物理コンテキストを作成（浮遊感を演出）
    this.physicsContext = new PhysicsContext({
      gravity: { x: 0, y: -3, z: 0 } as any
    })

    // 装飾用鏡餅グループを作成（台座と葉を含む）
    this.decorativeMochi = new DecorativeMochiGroup({
      includeDai: true,
      includeLeaf: true,
      physicsContext: this.physicsContext,
      initialPosition: new THREE.Vector3(0, 0.5, 0)
    })

    this.decorativeMochi.addToScene(this.scene)
  }

  private createFloor() {
    // Tatami-like floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B7355,
      roughness: 0.9,
      metalness: 0.0
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2
    floor.receiveShadow = true
    this.scene.add(floor)
  }

  private buildUI3D() {
    this.uiGroup = new THREE.Group()
    this.uiGroup.position.set(0, 3, 3)
    this.scene.add(this.uiGroup)

    // 3D押し出しタイトル「鏡餅」
    const titlePathData = TEXT_PATH_DATA['鏡餅']
    if (titlePathData) {
      this.title3D = new ExtrudedText(titlePathData, TITLE_TEXT_OPTIONS)
      this.titleContainer = new THREE.Group()
      this.titleContainer.add(this.title3D.getGroup())
      // スケール調整（SVGサイズに合わせる）
      const titleScale = 0.018
      this.titleContainer.scale.set(titleScale, titleScale, titleScale)
      // 局所ライトを追加（金色がよく見えるように）
      const titleLight = new THREE.PointLight(0xffffff, 1.5, 10)
      titleLight.position.set(0, 0, 50)
      this.titleContainer.add(titleLight)
    }

    // 3D押し出しタイトル「スタッキング」
    const titleSubPathData = TEXT_PATH_DATA['スタッキング']
    if (titleSubPathData) {
      this.titleSub3D = new ExtrudedText(titleSubPathData, TITLE_TEXT_OPTIONS)
      this.titleSubContainer = new THREE.Group()
      this.titleSubContainer.add(this.titleSub3D.getGroup())
      // スケール調整
      const subTitleScale = 0.012
      this.titleSubContainer.scale.set(subTitleScale, subTitleScale, subTitleScale)
      // 局所ライトを追加
      const subTitleLight = new THREE.PointLight(0xffffff, 1.5, 10)
      subTitleLight.position.set(0, 0, 50)
      this.titleSubContainer.add(subTitleLight)
    }

    this.subtitleSprite = createTextSprite({
      text: 'あけましておめでとうございます！',
      fontSize: 40,
      color: '#ffffff',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })

    this.instructionSprite = createTextSprite({
      text: 'ゲームモードを選択',
      fontSize: 32,
      color: '#cccccc'
    })

    // ボタン作成
    const modeButtonHeight = 0.8

    // 通常モードボタン
    this.normalModeButton = new Button3D({
      text: '通常モード',
      width: 3.2,
      height: modeButtonHeight,
      fontSize: 44,
      onClick: async () => {
        this.game.audioManager.playClick()
        this.game.audioManager.resume().catch(() => {})
        await this.startGame('normal')
      }
    })

    // エンドレスモードボタン
    this.endlessModeButton = new Button3D({
      text: 'エンドレス',
      width: 3.2,
      height: modeButtonHeight,
      fontSize: 44,
      backgroundColor: 0xff6b6b,
      hoverColor: 0xff8888,
      activeColor: 0xff4444,
      borderColor: 0xcc0000,
      onClick: async () => {
        this.game.audioManager.playClick()
        this.game.audioManager.resume().catch(() => {})
        await this.startGame('endless')
      }
    })

    // 各要素の高さを取得（3Dテキストはスケール × SVG高さで推定）
    const titleHeight = this.titleContainer ? 1.3 : 0 // 推定値
    const titleSubHeight = this.titleSubContainer ? 0.85 : 0 // 推定値
    const heights = {
      title: titleHeight,
      titleSub: titleSubHeight,
      subtitle: this.subtitleSprite.scale.y,
      instruction: this.instructionSprite.scale.y,
      modeBtn: modeButtonHeight
    }

    // gap設定
    const gaps = {
      titleToSub: 0.05,      // 鏡餅 - スタッキング間（タイト）
      subToGreeting: 0.3,    // スタッキング - あけおめ間
      greetingToInst: 0.15,  // あけおめ - 説明間
      instToNormal: 0.35,    // 説明 - 通常モードボタン間
      normalToEndless: 0.2   // 通常 - エンドレスボタン間
    }

    // 全体の高さを計算
    const totalHeight =
      heights.title +
      gaps.titleToSub +
      heights.titleSub +
      gaps.subToGreeting +
      heights.subtitle +
      gaps.greetingToInst +
      heights.instruction +
      gaps.instToNormal +
      heights.modeBtn +
      gaps.normalToEndless +
      heights.modeBtn

    // 中央揃えの基準点（元のレイアウトの中心付近）
    const centerY = 0.5
    let currentY = centerY + totalHeight / 2

    // 上から順に配置
    currentY -= heights.title / 2
    if (this.titleContainer) {
      this.titleContainer.position.set(0, currentY, 0)
    }
    currentY -= heights.title / 2 + gaps.titleToSub

    currentY -= heights.titleSub / 2
    if (this.titleSubContainer) {
      this.titleSubContainer.position.set(0, currentY, 0)
    }
    currentY -= heights.titleSub / 2 + gaps.subToGreeting

    currentY -= heights.subtitle / 2
    this.subtitleSprite.position.set(0, currentY, 0)
    currentY -= heights.subtitle / 2 + gaps.greetingToInst

    currentY -= heights.instruction / 2
    this.instructionSprite.position.set(0, currentY, 0)
    currentY -= heights.instruction / 2 + gaps.instToNormal

    currentY -= heights.modeBtn / 2
    this.normalModeButton.position.set(0, currentY, 0)
    currentY -= heights.modeBtn / 2 + gaps.normalToEndless

    currentY -= heights.modeBtn / 2
    this.endlessModeButton.position.set(0, currentY, 0)

    // UIグループに追加
    if (this.titleContainer) {
      this.uiGroup.add(this.titleContainer)
    }
    if (this.titleSubContainer) {
      this.uiGroup.add(this.titleSubContainer)
    }
    this.uiGroup.add(this.subtitleSprite)
    this.uiGroup.add(this.instructionSprite)
    this.uiGroup.add(this.normalModeButton)
    this.uiGroup.add(this.endlessModeButton)
  }

  private setupEventListeners() {
    const canvas = this.game.renderer.domElement
    canvas.addEventListener('pointermove', this.boundOnPointerMove)
    canvas.addEventListener('pointerdown', this.boundOnPointerDown)
    canvas.addEventListener('pointerup', this.boundOnPointerUp)
  }

  private removeEventListeners() {
    const canvas = this.game.renderer.domElement
    canvas.removeEventListener('pointermove', this.boundOnPointerMove)
    canvas.removeEventListener('pointerdown', this.boundOnPointerDown)
    canvas.removeEventListener('pointerup', this.boundOnPointerUp)
  }

  private updateMousePosition(e: PointerEvent) {
    const rect = this.game.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  private onPointerMove(e: PointerEvent) {
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    // ボタンのホバー処理
    const buttons = this.getInteractiveButtons()
    const intersects = this.raycaster.intersectObjects(buttons.map(b => b.getMesh()))

    // 以前のホバー状態をクリア
    if (this.hoveredButton) {
      this.hoveredButton.setHovered(false)
      this.hoveredButton = null
    }

    if (intersects.length > 0) {
      const button = intersects[0].object.userData.button as Button3D | undefined
      if (button) {
        button.setHovered(true)
        this.hoveredButton = button
        this.game.renderer.domElement.style.cursor = 'pointer'
      }
    } else {
      this.game.renderer.domElement.style.cursor = 'default'
    }
  }

  private onPointerDown(e: PointerEvent) {
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    // ボタンの押下処理
    const buttons = this.getInteractiveButtons()
    const intersects = this.raycaster.intersectObjects(buttons.map(b => b.getMesh()))

    if (intersects.length > 0) {
      const button = intersects[0].object.userData.button as Button3D | undefined
      if (button) {
        button.setPressed(true)
        this.activeButton = button
      }
    }
  }

  private onPointerUp(e: PointerEvent) {
    // ボタンのクリック処理（押下時に記録したボタンを使用）
    if (this.activeButton) {
      this.activeButton.setPressed(false)
      if (this.activeButton.onClick) {
        this.activeButton.onClick()
      }
      this.activeButton = null
      return
    }

    // activeButton がない場合のフォールバック（ホバー状態のクリア用）
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    const buttons = this.getInteractiveButtons()
    buttons.forEach(b => b.setPressed(false))
  }

  private getInteractiveButtons(): Button3D[] {
    const buttons: Button3D[] = []

    if (this.normalModeButton) buttons.push(this.normalModeButton)
    if (this.endlessModeButton) buttons.push(this.endlessModeButton)

    return buttons
  }

  /**
   * ゲームを開始
   */
  private async startGame(mode: GameMode): Promise<void> {
    await this.game.sceneManager.switchTo('game', { mode })
  }

  /**
   * レイアウト変更時の調整
   */
  protected adjustLayout(layout: LayoutInfo): void {
    // カメラ調整
    if (layout.mode === 'portrait') {
      // 縦画面: カメラを遠くに配置
      const zoomOut = 1 / layout.screenAspect
      this.game.camera.position.set(0, 5, 12 + (zoomOut - 1) * 6)
    } else {
      // 横画面: 通常の設定
      this.game.camera.position.set(0, 5, 12)
    }
    this.game.camera.lookAt(0, 2, 0)

    // UIグループのスケールを調整（新しいデフォルト0.8を使用）
    if (this.uiGroup) {
      const scale = calculateLayoutScale(layout)
      this.uiGroup.scale.setScalar(scale)
    }

    // パーティクルを装飾領域に拡張
    if (this.particles) {
      redistributeParticles(this.particles, layout, {
        baseWidth: 30,
        baseHeight: 20,
        baseDepth: 30,
        yOffset: 0,
      })
    }
  }

  private animateIntro() {
    // Animate camera
    gsap.from(this.game.camera.position, {
      z: 20,
      y: 10,
      duration: 2,
      ease: 'power2.out'
    })

    // Animate kagamimochi
    if (this.decorativeMochi) {
      gsap.from(this.decorativeMochi.group.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        delay: 0.5,
        ease: 'elastic.out(1, 0.5)'
      })
    }

    // Animate UI elements
    if (this.uiGroup) {
      gsap.from(this.uiGroup.position, {
        y: 10,
        duration: 1.5,
        delay: 0.3,
        ease: 'elastic.out(1, 0.7)'
      })
    }

    // Animate 3D title with pulse
    if (this.titleContainer) {
      const baseTitleScale = this.titleContainer.scale.clone()
      const pulseAnimation = () => {
        if (!this.titleContainer) return
        gsap.to(this.titleContainer.scale, {
          x: baseTitleScale.x * 1.05,
          y: baseTitleScale.y * 1.05,
          z: baseTitleScale.z * 1.05,
          duration: 1,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1
        })
      }
      setTimeout(pulseAnimation, 1500)
    }

    // Animate 3D sub-title with pulse (slightly offset for visual interest)
    if (this.titleSubContainer) {
      const baseSubTitleScale = this.titleSubContainer.scale.clone()
      const pulseAnimation = () => {
        if (!this.titleSubContainer) return
        gsap.to(this.titleSubContainer.scale, {
          x: baseSubTitleScale.x * 1.05,
          y: baseSubTitleScale.y * 1.05,
          z: baseSubTitleScale.z * 1.05,
          duration: 1.2,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1
        })
      }
      setTimeout(pulseAnimation, 1700)
    }
  }
}
