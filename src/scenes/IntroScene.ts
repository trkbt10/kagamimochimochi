import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'
import { createTextSprite, Button3D, Slider3D, createPanel3D } from '../ui/ThreeUI'

export class IntroScene extends BaseScene {
  private particles: THREE.Points | null = null
  private kagamimochi: THREE.Group | null = null
  private settingsOpen = false

  // UI要素
  private uiGroup: THREE.Group | null = null
  private titleSprite: THREE.Sprite | null = null
  private subtitleSprite: THREE.Sprite | null = null
  private instructionSprite: THREE.Sprite | null = null
  private startButton: Button3D | null = null
  private settingsButton: Button3D | null = null

  // 設定パネル
  private settingsGroup: THREE.Group | null = null
  private settingsPanel: THREE.Mesh | null = null
  private masterVolumeSlider: Slider3D | null = null
  private bgmVolumeSlider: Slider3D | null = null
  private closeSettingsButton: Button3D | null = null

  // Raycaster
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hoveredButton: Button3D | null = null
  private activeSlider: Slider3D | null = null

  // イベントハンドラ
  private boundOnPointerMove: (e: PointerEvent) => void
  private boundOnPointerDown: (e: PointerEvent) => void
  private boundOnPointerUp: (e: PointerEvent) => void
  private boundOnResize: () => void

  constructor(game: Game) {
    super(game)
    this.boundOnPointerMove = this.onPointerMove.bind(this)
    this.boundOnPointerDown = this.onPointerDown.bind(this)
    this.boundOnPointerUp = this.onPointerUp.bind(this)
    this.boundOnResize = this.adjustForScreenSize.bind(this)
  }

  async enter() {
    this.setupScene()
    this.buildUI3D()
    this.setupEventListeners()
    this.adjustForScreenSize()
    this.animateIntro()
  }

  async exit() {
    this.game.audioManager.stopBgm()
    this.removeEventListeners()
    this.clearScene()
  }

  update(delta: number) {
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
    // Background gradient - slightly brighter
    this.scene.background = new THREE.Color(0x2d1010)

    // Fog for depth - reduced density for better visibility
    this.scene.fog = new THREE.FogExp2(0x2d1010, 0.02)

    // Ambient light - brighter for better visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    // Main spotlight - increased intensity
    const spotlight = new THREE.SpotLight(0xffd700, 3, 40, Math.PI / 4, 0.5, 1)
    spotlight.position.set(0, 15, 5)
    spotlight.castShadow = true
    this.scene.add(spotlight)

    // Additional front light for UI visibility
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.5)
    frontLight.position.set(0, 5, 10)
    this.scene.add(frontLight)

    // Point lights for ambiance - increased intensity
    const redLight = new THREE.PointLight(0xff3333, 1.5, 25)
    redLight.position.set(-5, 3, -3)
    this.scene.add(redLight)

    const goldLight = new THREE.PointLight(0xffd700, 1.5, 25)
    goldLight.position.set(5, 3, -3)
    this.scene.add(goldLight)

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

    // Bottom mochi
    const bottomMochiGeometry = new THREE.SphereGeometry(1.5, 32, 24)
    bottomMochiGeometry.scale(1, 0.5, 1)
    const mochiMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8e7,
      roughness: 0.9,
      metalness: 0.0
    })
    const bottomMochi = new THREE.Mesh(bottomMochiGeometry, mochiMaterial)
    bottomMochi.position.y = -0.9
    bottomMochi.castShadow = true
    this.kagamimochi.add(bottomMochi)

    // Top mochi
    const topMochiGeometry = new THREE.SphereGeometry(1.1, 32, 24)
    topMochiGeometry.scale(1, 0.5, 1)
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

    // タイトル
    this.titleSprite = createTextSprite({
      text: '鏡餅スタッキング',
      fontSize: 72,
      color: '#FFD700',
      glowColor: '#FFD700',
      glowBlur: 20,
      shadowColor: '#8B0000',
      shadowBlur: 8
    })
    this.titleSprite.position.set(0, 2, 0)
    this.titleSprite.scale.multiplyScalar(1.5)
    this.uiGroup.add(this.titleSprite)

    // サブタイトル
    this.subtitleSprite = createTextSprite({
      text: 'あけましておめでとうございます！',
      fontSize: 32,
      color: '#ffffff',
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 4
    })
    this.subtitleSprite.position.set(0, 1.2, 0)
    this.uiGroup.add(this.subtitleSprite)

    // 説明テキスト
    this.instructionSprite = createTextSprite({
      text: '餅を積み上げて100点を目指せ！',
      fontSize: 24,
      color: '#cccccc'
    })
    this.instructionSprite.position.set(0, 0.7, 0)
    this.uiGroup.add(this.instructionSprite)

    // スタートボタン
    this.startButton = new Button3D({
      text: 'スタート',
      width: 3,
      height: 0.8,
      fontSize: 40,
      onClick: async () => {
        this.game.audioManager.playClick()
        await this.game.audioManager.resume()
        this.game.sceneManager.switchTo('game')
      }
    })
    this.startButton.position.set(0, -0.3, 0)
    this.uiGroup.add(this.startButton)

    // 設定ボタン
    this.settingsButton = new Button3D({
      text: '設定',
      width: 2.5,
      height: 0.6,
      fontSize: 32,
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
    this.settingsButton.position.set(0, -1.2, 0)
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
      width: 5,
      height: 4,
      color: 0x000000,
      opacity: 0.9,
      borderColor: 0xffd700
    })
    this.settingsGroup.add(this.settingsPanel)

    // タイトル
    const settingsTitleSprite = createTextSprite({
      text: '設定',
      fontSize: 48,
      color: '#FFD700'
    })
    settingsTitleSprite.position.set(0, 1.4, 0.1)
    this.settingsGroup.add(settingsTitleSprite)

    // マスター音量スライダー
    this.masterVolumeSlider = new Slider3D({
      label: 'マスター',
      width: 2.5,
      initialValue: 0.7,
      onChange: (value) => {
        this.game.audioManager.setMasterVolume(value)
      }
    })
    this.masterVolumeSlider.position.set(0.3, 0.5, 0.1)
    this.settingsGroup.add(this.masterVolumeSlider)

    // BGM音量スライダー
    this.bgmVolumeSlider = new Slider3D({
      label: 'BGM',
      width: 2.5,
      initialValue: 0.5,
      onChange: (value) => {
        this.game.audioManager.setBgmVolume(value)
      }
    })
    this.bgmVolumeSlider.position.set(0.3, -0.2, 0.1)
    this.settingsGroup.add(this.bgmVolumeSlider)

    // 閉じるボタン
    this.closeSettingsButton = new Button3D({
      text: '閉じる',
      width: 2,
      height: 0.6,
      fontSize: 32,
      onClick: async () => {
        this.game.audioManager.playClick()
        await this.game.audioManager.resume()
        this.toggleSettings()
        this.game.audioManager.playBgm()
      }
    })
    this.closeSettingsButton.position.set(0, -1.3, 0.1)
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
    window.addEventListener('resize', this.boundOnResize)
  }

  private removeEventListeners() {
    const canvas = this.game.renderer.domElement
    canvas.removeEventListener('pointermove', this.boundOnPointerMove)
    canvas.removeEventListener('pointerdown', this.boundOnPointerDown)
    canvas.removeEventListener('pointerup', this.boundOnPointerUp)
    window.removeEventListener('resize', this.boundOnResize)
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

    this.updateMousePosition(e)
    this.raycaster.setFromCamera(this.mouse, this.game.camera)

    const buttons = this.getInteractiveButtons()
    const intersects = this.raycaster.intersectObjects(buttons.map(b => b.getMesh()))

    // すべてのボタンの押下状態をクリア
    buttons.forEach(b => b.setPressed(false))

    if (intersects.length > 0) {
      const button = intersects[0].object.userData.button as Button3D | undefined
      if (button && button.onClick) {
        button.onClick()
      }
    }
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
      if (this.bgmVolumeSlider) sliders.push(this.bgmVolumeSlider)
    }

    return sliders
  }

  private adjustForScreenSize() {
    const aspect = window.innerWidth / window.innerHeight

    // モバイル（縦長画面）の場合、カメラを引いてUIを収める
    if (aspect < 1) {
      // 縦画面: カメラを遠くに配置
      const zoomOut = 1 / aspect
      this.game.camera.position.set(0, 5, 12 + (zoomOut - 1) * 8)
      this.game.camera.lookAt(0, 2, 0)

      // UIグループのスケールを調整
      if (this.uiGroup) {
        const scale = Math.max(0.6, aspect)
        this.uiGroup.scale.set(scale, scale, scale)
      }
    } else {
      // 横画面: 通常の設定
      this.game.camera.position.set(0, 5, 12)
      this.game.camera.lookAt(0, 2, 0)

      if (this.uiGroup) {
        this.uiGroup.scale.set(1, 1, 1)
      }
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
      const pulseAnimation = () => {
        if (!this.titleSprite) return
        gsap.to(this.titleSprite.scale, {
          x: this.titleSprite.scale.x * 1.05,
          y: this.titleSprite.scale.y * 1.05,
          duration: 1,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1
        })
      }
      setTimeout(pulseAnimation, 1500)
    }
  }
}
