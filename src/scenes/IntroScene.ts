import * as THREE from 'three'
import { gsap } from 'gsap'
import { BaseScene } from './BaseScene'
import type { Game } from '../core/Game'

export class IntroScene extends BaseScene {
  private particles: THREE.Points | null = null
  private kagamimochi: THREE.Group | null = null
  private settingsOpen = false

  constructor(game: Game) {
    super(game)
  }

  async enter() {
    this.setupScene()
    this.buildUI()
    this.setupEventListeners()
    this.animateIntro()
  }

  async exit() {
    this.game.audioManager.stopBgm()
    this.removeUI()
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
  }

  private setupScene() {
    // Background gradient
    this.scene.background = new THREE.Color(0x1a0505)

    // Fog for depth
    this.scene.fog = new THREE.FogExp2(0x1a0505, 0.05)

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.3)
    this.scene.add(ambient)

    // Main spotlight
    const spotlight = new THREE.SpotLight(0xffd700, 2, 30, Math.PI / 4, 0.5, 1)
    spotlight.position.set(0, 15, 5)
    spotlight.castShadow = true
    this.scene.add(spotlight)

    // Point lights for ambiance
    const redLight = new THREE.PointLight(0xff3333, 1, 20)
    redLight.position.set(-5, 3, -3)
    this.scene.add(redLight)

    const goldLight = new THREE.PointLight(0xffd700, 1, 20)
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

  private buildUI() {
    this.ui = this.createUI(`
      <div class="intro-content" style="display: flex; flex-direction: column; align-items: center; gap: 2rem;">
        <h1 class="title">鏡餅スタッキング</h1>
        <p class="subtitle">あけましておめでとうございます！</p>
        <p class="subtitle" style="font-size: 0.9em; opacity: 0.8;">餅を積み上げて100点を目指せ！</p>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
          <button class="btn start-btn">スタート</button>
          <button class="btn btn-secondary settings-btn">設定</button>
        </div>

        <div class="settings-panel">
          <h2>設定</h2>
          <div class="setting-row">
            <label>マスター音量</label>
            <input type="range" min="0" max="100" value="70" id="masterVolume" />
          </div>
          <div class="setting-row">
            <label>BGM音量</label>
            <input type="range" min="0" max="100" value="50" id="bgmVolume" />
          </div>
          <button class="btn" style="margin-top: 1rem; width: 100%;" id="closeSettings">閉じる</button>
        </div>
      </div>
    `)
  }

  private setupEventListeners() {
    if (!this.ui) return

    const startBtn = this.ui.querySelector('.start-btn') as HTMLButtonElement
    const settingsBtn = this.ui.querySelector('.settings-btn') as HTMLButtonElement
    const settingsPanel = this.ui.querySelector('.settings-panel') as HTMLElement
    const closeSettingsBtn = this.ui.querySelector('#closeSettings') as HTMLButtonElement
    const masterVolumeSlider = this.ui.querySelector('#masterVolume') as HTMLInputElement
    const bgmVolumeSlider = this.ui.querySelector('#bgmVolume') as HTMLInputElement

    startBtn.addEventListener('click', async () => {
      this.game.audioManager.playClick()
      await this.game.audioManager.resume()
      this.game.sceneManager.switchTo('game')
    })

    settingsBtn.addEventListener('click', () => {
      this.game.audioManager.playClick()
      this.settingsOpen = !this.settingsOpen
      settingsPanel.classList.toggle('active', this.settingsOpen)
    })

    closeSettingsBtn.addEventListener('click', async () => {
      this.game.audioManager.playClick()
      await this.game.audioManager.resume()
      this.settingsOpen = false
      settingsPanel.classList.remove('active')
      this.game.audioManager.playBgm()
    })

    masterVolumeSlider.addEventListener('input', () => {
      this.game.audioManager.setMasterVolume(parseInt(masterVolumeSlider.value) / 100)
    })

    bgmVolumeSlider.addEventListener('input', () => {
      this.game.audioManager.setBgmVolume(parseInt(bgmVolumeSlider.value) / 100)
    })
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
  }
}
