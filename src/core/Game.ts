import * as THREE from 'three'
import { SceneManager } from './SceneManager'
import { AudioManager } from './AudioManager'
import { IntroScene } from '../scenes/IntroScene'
import { GameScene } from '../scenes/GameScene'
import { ResultScene } from '../scenes/ResultScene'

export class Game {
  public renderer: THREE.WebGLRenderer
  public camera: THREE.PerspectiveCamera
  public sceneManager: SceneManager
  public audioManager: AudioManager
  public clock: THREE.Clock

  private container: HTMLElement

  constructor() {
    this.container = document.getElementById('app')!
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.sceneManager = new SceneManager(this)
    this.audioManager = new AudioManager()
    this.clock = new THREE.Clock()
  }

  async init() {
    this.setupRenderer()
    this.setupCamera()
    this.setupEventListeners()

    // Register scenes
    this.sceneManager.register('intro', new IntroScene(this))
    this.sceneManager.register('game', new GameScene(this))
    this.sceneManager.register('result', new ResultScene(this))

    // Start with intro scene
    await this.sceneManager.switchTo('intro')

    // Remove loading message
    const loading = this.container.querySelector('.loading')
    if (loading) loading.remove()

    // Start animation loop
    this.animate()
  }

  private setupRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    this.container.insertBefore(this.renderer.domElement, this.container.firstChild)
  }

  private setupCamera() {
    this.camera.position.set(0, 5, 12)
    this.camera.lookAt(0, 2, 0)
  }

  private setupEventListeners() {
    window.addEventListener('resize', this.onResize.bind(this))
  }

  private onResize() {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this))

    const delta = this.clock.getDelta()
    this.sceneManager.update(delta)

    const currentScene = this.sceneManager.getCurrentScene()
    if (currentScene) {
      this.renderer.render(currentScene.getThreeScene(), this.camera)
    }
  }
}
