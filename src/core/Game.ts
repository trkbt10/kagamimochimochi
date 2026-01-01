import * as THREE from 'three'
import { SceneManager } from './SceneManager'
import { AudioManager } from './AudioManager'
import { LayoutManager } from './layout'
import { CameraController } from './CameraController'
import { CameraEffectsManager } from './CameraEffectsManager'
import { PostProcessManager } from '../postprocess'
import { IntroScene } from '../scenes/IntroScene'
import { GameScene } from '../scenes/GameScene'
import { ResultScene } from '../scenes/ResultScene'

export class Game {
  public renderer: THREE.WebGLRenderer
  public camera: THREE.PerspectiveCamera
  public sceneManager: SceneManager
  public audioManager: AudioManager
  public layoutManager: LayoutManager
  public cameraController: CameraController
  public cameraEffects: CameraEffectsManager | null = null
  public postProcessManager: PostProcessManager | null = null
  public clock: THREE.Clock

  private container: HTMLElement

  constructor() {
    this.container = document.getElementById('app')!
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.sceneManager = new SceneManager(this)
    this.audioManager = new AudioManager()
    this.layoutManager = new LayoutManager(this.camera)
    this.cameraController = new CameraController(this.camera)
    this.clock = new THREE.Clock()
  }

  async init() {
    this.setupRenderer()
    this.setupCamera()
    this.setupEventListeners()

    // Initialize layout
    this.layoutManager.update(window.innerWidth, window.innerHeight)

    // Register scenes
    this.sceneManager.register('intro', new IntroScene(this))
    this.sceneManager.register('game', new GameScene(this))
    this.sceneManager.register('result', new ResultScene(this))

    // Initialize post-processing (after scenes are registered)
    this.initPostProcessing()

    // Start with intro scene
    await this.sceneManager.switchTo('intro')

    // Remove loading message
    const loading = this.container.querySelector('.loading')
    if (loading) loading.remove()

    // Start animation loop
    this.animate()
  }

  private initPostProcessing() {
    const introScene = this.sceneManager.getScene('intro')
    if (introScene) {
      this.postProcessManager = new PostProcessManager(
        this.renderer,
        introScene.getThreeScene(),
        this.camera
      )
      // Initialize camera effects manager with post processing
      this.cameraEffects = new CameraEffectsManager(
        this.postProcessManager,
        this.cameraController
      )
    }
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
    this.postProcessManager?.setSize(width, height)

    // Update layout (notifies all listeners)
    this.layoutManager.update(width, height)
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this))

    const delta = this.clock.getDelta()

    // Update camera controller
    this.cameraController.update(delta)

    this.sceneManager.update(delta)

    const currentScene = this.sceneManager.getCurrentScene()
    if (currentScene) {
      if (this.postProcessManager?.enabled) {
        this.postProcessManager.setScene(currentScene.getThreeScene())
        this.postProcessManager.render()
      } else {
        this.renderer.render(currentScene.getThreeScene(), this.camera)
      }
    }
  }
}
