import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import type { LayoutInfo } from '../core/layout'
import { redistributeParticles, calculateLayoutScale } from '../core/layout'
import { createTextSprite, createPachinkoTextSprite } from '../ui/text-sprite'
import { Button3D } from '../ui/button-3d'
import { Slider3D } from '../ui/slider-3d'
import { createPanel3D } from '../ui/panel-3d'
import { createMochiGeometry } from './game/mochi-handler'
import { SkyGradient } from '../effects/SkyGradient'
import { SnowEffect } from '../effects/SnowEffect'
import { Kadomatsu } from '../objects/Kadomatsu'
import { MountainFuji } from '../objects/MountainFuji'

export class IntroScene extends BaseScene {
  private particles: THREE.Points | null = null
  private kagamimochi: THREE.Group | null = null
  private settingsOpen = false

  // お正月演出
  private skyGradient: SkyGradient | null = null
  private snowEffect: SnowEffect | null = null
  private kadomatsuLeft: Kadomatsu | null = null
  private kadomatsuRight: Kadomatsu | null = null
  private mountain: MountainFuji | null = null

  // UI要素
  private uiGroup: THREE.Group | null = null
  private titleSprite: THREE.Sprite | null = null
  private titleSubSprite: THREE.Sprite | null = null
  private subtitleSprite: THREE.Sprite | null = null
  private instructionSprite: THREE.Sprite | null = null
  private startButton: Button3D | null = null
  private settingsButton: Button3D | null = null

  // 設定パネル
  private settingsGroup: THREE.Group | null = null
  private settingsPanel: THREE.Mesh | null = null
  private masterVolumeSlider: Slider3D | null = null
  private closeSettingsButton: Button3D | null = null

  // Raycaster
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hoveredButton: Button3D | null = null
  private activeSlider: Slider3D | null = null
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
    this.snowEffect?.dispose()
    this.kadomatsuLeft?.dispose()
    this.kadomatsuRight?.dispose()
    this.mountain?.dispose()
    this.skyGradient = null
    this.snowEffect = null
    this.kadomatsuLeft = null
    this.kadomatsuRight = null
    this.mountain = null

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

    // Gentle float animation for kagamimochi
    if (this.kagamimochi) {
      this.kagamimochi.position.y = 0.5 + Math.sin(Date.now() * 0.002) * 0.2
      this.kagamimochi.rotation.y += delta * 0.3
    }

    // UIをカメラに向ける
    if (this.uiGroup) {
      this.uiGroup.lookAt(this.game.camera.position)
    }

    // 設定パネルもカメラに向ける
    if (this.settingsGroup && this.settingsOpen) {
      this.settingsGroup.lookAt(this.game.camera.position)
    }
  }

  private setupScene() {
    // グラデーション空（夜空）
    this.skyGradient = new SkyGradient()
    this.skyGradient.timeOfDay = 0 // 夜空
    this.skyGradient.addToScene(this.scene)

    // 背景色は使わない（空で覆う）
    this.scene.background = null

    // 霧を薄く - 夜空に合わせた色
    this.scene.fog = new THREE.FogExp2(0x0a0a1e, 0.008)

    // 月明かり（青白い光）
    const moonLight = new THREE.DirectionalLight(0x8888ff, 0.4)
    moonLight.position.set(-10, 15, -5)
    this.scene.add(moonLight)

    // Ambient light - 夜なので少し暗め
    const ambient = new THREE.AmbientLight(0x6666aa, 0.3)
    this.scene.add(ambient)

    // Main spotlight - ゴールドで鏡餅を照らす
    const spotlight = new THREE.SpotLight(0xffd700, 3, 40, Math.PI / 4, 0.5, 1)
    spotlight.position.set(0, 15, 5)
    spotlight.castShadow = true
    this.scene.add(spotlight)

    // Additional front light for UI visibility
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.4)
    frontLight.position.set(0, 5, 10)
    this.scene.add(frontLight)

    // Point lights for ambiance - 赤とゴールドでお正月感
    const redLight = new THREE.PointLight(0xff3333, 1.2, 25)
    redLight.position.set(-5, 3, -3)
    this.scene.add(redLight)

    const goldLight = new THREE.PointLight(0xffd700, 1.2, 25)
    goldLight.position.set(5, 3, -3)
    this.scene.add(goldLight)

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
    this.kagamimochi = new THREE.Group()

    // Dai (stand)
    const daiGeometry = new THREE.CylinderGeometry(1.8, 2, 0.3, 32)
    const daiMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.6,
      metalness: 0.2
    })
    const dai = new THREE.Mesh(daiGeometry, daiMaterial)
    dai.position.y = -1.5
    dai.castShadow = true
    dai.receiveShadow = true
    this.kagamimochi.add(dai)

    // Bottom mochi（下が広い鏡餅型）
    const bottomMochiGeometry = createMochiGeometry(1.5, 0.75)
    const mochiMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8e7,
      roughness: 0.9,
      metalness: 0.0
    })
    const bottomMochi = new THREE.Mesh(bottomMochiGeometry, mochiMaterial)
    bottomMochi.position.y = -0.9
    bottomMochi.castShadow = true
    this.kagamimochi.add(bottomMochi)

    // Top mochi（下が広い鏡餅型）
    const topMochiGeometry = createMochiGeometry(1.1, 0.55)
    const topMochi = new THREE.Mesh(topMochiGeometry, mochiMaterial)
    topMochi.position.y = -0.2
    topMochi.castShadow = true
    this.kagamimochi.add(topMochi)

    // Mikan
    const mikanGeometry = new THREE.SphereGeometry(0.5, 32, 24)
    const mikanMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.8,
      metalness: 0.0
    })
    const mikan = new THREE.Mesh(mikanGeometry, mikanMaterial)
    mikan.position.y = 0.5
    mikan.castShadow = true
    this.kagamimochi.add(mikan)

    // Leaf on mikan
    const leafGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.15)
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 })
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial)
    leaf.position.set(0, 0.75, 0)
    leaf.rotation.z = Math.PI / 6
    this.kagamimochi.add(leaf)

    this.kagamimochi.position.y = 0.5
    this.scene.add(this.kagamimochi)
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

    // パチンコ風スタイル設定
    const pachinkoStyle = {
      outlines: [
        { color: '#000000', width: 12 },
        { color: '#8B0000', width: 9 },
        { color: '#FF4500', width: 6 },
        { color: '#FFD700', width: 3 }
      ],
      gradientColors: ['#FFFACD', '#FFD700', '#DAA520', '#B8860B'],
      bevelHighlight: 'rgba(255,255,255,0.9)',
      bevelShadow: 'rgba(0,0,0,0.5)',
      glowColor: '#FFD700',
      glowBlur: 15
    }
    const titleScale = 1.0

    // スプライト作成（位置は後で計算）
    this.titleSprite = createPachinkoTextSprite({
      text: '鏡餅',
      fontSize: 110,
      ...pachinkoStyle
    })
    this.titleSprite.scale.multiplyScalar(titleScale)

    this.titleSubSprite = createPachinkoTextSprite({
      text: 'スタッキング',
      fontSize: 70,
      ...pachinkoStyle
    })
    this.titleSubSprite.scale.multiplyScalar(titleScale)

    this.subtitleSprite = createTextSprite({
      text: 'あけましておめでとうございます！',
      fontSize: 40,
      color: '#ffffff',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })

    this.instructionSprite = createTextSprite({
      text: '餅を積み上げて100点を目指せ！',
      fontSize: 32,
      color: '#cccccc'
    })

    // ボタン作成
    const startButtonHeight = 0.9
    const settingsButtonHeight = 0.7
    this.startButton = new Button3D({
      text: 'スタート',
      width: 3.2,
      height: startButtonHeight,
      fontSize: 48,
      onClick: async () => {
        this.game.audioManager.playClick()

        // Audio 処理は非同期で実行（待たない）- iOS で永久 pending になる問題を回避
        this.game.audioManager.resume().catch(() => {})

        // シーン遷移を即座に実行
        await this.game.sceneManager.switchTo('game')
      }
    })
    this.settingsButton = new Button3D({
      text: '設定',
      width: 2.8,
      height: settingsButtonHeight,
      fontSize: 40,
      backgroundColor: 0xdddddd,
      hoverColor: 0xeeeeee,
      activeColor: 0xcccccc,
      borderColor: 0x666666,
      textColor: '#333333',
      onClick: () => {
        this.game.audioManager.playClick()
        this.toggleSettings()
      }
    })

    // 各要素の高さを取得
    const heights = {
      title: this.titleSprite.scale.y,
      titleSub: this.titleSubSprite.scale.y,
      subtitle: this.subtitleSprite.scale.y,
      instruction: this.instructionSprite.scale.y,
      startBtn: startButtonHeight,
      settingsBtn: settingsButtonHeight
    }

    // gap設定
    const gaps = {
      titleToSub: 0.05,      // 鏡餅 - スタッキング間（タイト）
      subToGreeting: 0.3,    // スタッキング - あけおめ間
      greetingToInst: 0.15,  // あけおめ - 説明間
      instToStart: 0.4,      // 説明 - スタートボタン間
      startToSettings: 0.25  // スタート - 設定ボタン間
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
      gaps.instToStart +
      heights.startBtn +
      gaps.startToSettings +
      heights.settingsBtn

    // 中央揃えの基準点（元のレイアウトの中心付近）
    const centerY = 0.5
    let currentY = centerY + totalHeight / 2

    // 上から順に配置
    currentY -= heights.title / 2
    this.titleSprite.position.set(0, currentY, 0)
    currentY -= heights.title / 2 + gaps.titleToSub

    currentY -= heights.titleSub / 2
    this.titleSubSprite.position.set(0, currentY, 0)
    currentY -= heights.titleSub / 2 + gaps.subToGreeting

    currentY -= heights.subtitle / 2
    this.subtitleSprite.position.set(0, currentY, 0)
    currentY -= heights.subtitle / 2 + gaps.greetingToInst

    currentY -= heights.instruction / 2
    this.instructionSprite.position.set(0, currentY, 0)
    currentY -= heights.instruction / 2 + gaps.instToStart

    currentY -= heights.startBtn / 2
    this.startButton.position.set(0, currentY, 0)
    currentY -= heights.startBtn / 2 + gaps.startToSettings

    currentY -= heights.settingsBtn / 2
    this.settingsButton.position.set(0, currentY, 0)

    // UIグループに追加
    this.uiGroup.add(this.titleSprite)
    this.uiGroup.add(this.titleSubSprite)
    this.uiGroup.add(this.subtitleSprite)
    this.uiGroup.add(this.instructionSprite)
    this.uiGroup.add(this.startButton)
    this.uiGroup.add(this.settingsButton)

    // 設定パネルを作成
    this.buildSettingsPanel()
  }

  private buildSettingsPanel() {
    this.settingsGroup = new THREE.Group()
    this.settingsGroup.position.set(0, 3, 4)
    this.settingsGroup.visible = false
    this.scene.add(this.settingsGroup)

    // パネル背景
    this.settingsPanel = createPanel3D({
      width: 5.5,
      height: 4.5,
      color: 0x000000,
      opacity: 0.9,
      borderColor: 0xffd700
    })
    this.settingsGroup.add(this.settingsPanel)

    // タイトル
    const settingsTitleSprite = createTextSprite({
      text: '設定',
      fontSize: 56,
      color: '#FFD700'
    })
    settingsTitleSprite.position.set(0, 1.5, 0.1)
    this.settingsGroup.add(settingsTitleSprite)

    // マスター音量スライダー
    this.masterVolumeSlider = new Slider3D({
      label: 'マスター',
      width: 2.8,
      initialValue: 0.7,
      onChange: (value) => {
        this.game.audioManager.setMasterVolume(value)
      }
    })
    this.masterVolumeSlider.position.set(0.3, 0.5, 0.1)
    this.settingsGroup.add(this.masterVolumeSlider)

    // 閉じるボタン
    this.closeSettingsButton = new Button3D({
      text: '閉じる',
      width: 2.4,
      height: 0.7,
      fontSize: 40,
      onClick: () => {
        this.game.audioManager.playClick()
        this.toggleSettings()
      }
    })
    this.closeSettingsButton.position.set(0, -1.4, 0.1)
    this.settingsGroup.add(this.closeSettingsButton)
  }

  private toggleSettings() {
    this.settingsOpen = !this.settingsOpen
    if (this.settingsGroup) {
      if (this.settingsOpen) {
        this.settingsGroup.visible = true
        gsap.from(this.settingsGroup.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.3,
          ease: 'back.out(1.5)'
        })
      } else {
        gsap.to(this.settingsGroup.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            if (this.settingsGroup) {
              this.settingsGroup.visible = false
              this.settingsGroup.scale.set(1, 1, 1)
            }
          }
        })
      }
    }
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

    // スライダーのドラッグ処理
    if (this.activeSlider) {
      const sliderPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.activeSlider.position.z - (this.settingsGroup?.position.z || 0))
      const intersection = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(sliderPlane, intersection)

      if (intersection) {
        const localX = intersection.x - (this.settingsGroup?.position.x || 0) - this.activeSlider.position.x
        const normalizedX = (localX + this.activeSlider.getWidth() / 2) / this.activeSlider.getWidth()
        this.activeSlider.setValueFromPosition(Math.max(0, Math.min(1, normalizedX)))
      }
      return
    }

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

    // スライダーのホバー処理
    const sliders = this.getInteractiveSliders()
    const sliderHandles = sliders.map(s => s.getHandle())
    const sliderIntersects = this.raycaster.intersectObjects(sliderHandles)

    if (sliderIntersects.length > 0) {
      this.game.renderer.domElement.style.cursor = 'pointer'
    }
  }

  private onPointerDown(e: PointerEvent) {
    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    // スライダーのドラッグ開始
    const sliders = this.getInteractiveSliders()
    const sliderMeshes = sliders.flatMap(s => [s.getHandle(), s.getTrack()])
    const sliderIntersects = this.raycaster.intersectObjects(sliderMeshes)

    if (sliderIntersects.length > 0) {
      const slider = sliderIntersects[0].object.userData.slider as Slider3D | undefined
      if (slider) {
        this.activeSlider = slider
        slider.setDragging(true)

        // クリック位置で値を設定
        const sliderPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -slider.position.z - (this.settingsGroup?.position.z || 0))
        const intersection = new THREE.Vector3()
        this.raycaster.ray.intersectPlane(sliderPlane, intersection)

        if (intersection) {
          const localX = intersection.x - (this.settingsGroup?.position.x || 0) - slider.position.x
          const normalizedX = (localX + slider.getWidth() / 2) / slider.getWidth()
          slider.setValueFromPosition(Math.max(0, Math.min(1, normalizedX)))
        }
        return
      }
    }

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
    // スライダーのドラッグ終了
    if (this.activeSlider) {
      this.activeSlider.setDragging(false)
      this.activeSlider = null
      return
    }

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

    if (!this.settingsOpen) {
      if (this.startButton) buttons.push(this.startButton)
      if (this.settingsButton) buttons.push(this.settingsButton)
    } else {
      if (this.closeSettingsButton) buttons.push(this.closeSettingsButton)
    }

    return buttons
  }

  private getInteractiveSliders(): Slider3D[] {
    const sliders: Slider3D[] = []

    if (this.settingsOpen) {
      if (this.masterVolumeSlider) sliders.push(this.masterVolumeSlider)
    }

    return sliders
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
    if (this.kagamimochi) {
      gsap.from(this.kagamimochi.scale, {
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

    // Animate title with pulse
    if (this.titleSprite) {
      const baseTitleScale = this.titleSprite.scale.clone()
      const pulseAnimation = () => {
        if (!this.titleSprite) return
        gsap.to(this.titleSprite.scale, {
          x: baseTitleScale.x * 1.05,
          y: baseTitleScale.y * 1.05,
          duration: 1,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1
        })
      }
      setTimeout(pulseAnimation, 1500)
    }

    // Animate titleSubSprite with pulse (slightly offset for visual interest)
    if (this.titleSubSprite) {
      const baseSubTitleScale = this.titleSubSprite.scale.clone()
      const pulseAnimation = () => {
        if (!this.titleSubSprite) return
        gsap.to(this.titleSubSprite.scale, {
          x: baseSubTitleScale.x * 1.05,
          y: baseSubTitleScale.y * 1.05,
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
