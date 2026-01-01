import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { gsap } from 'gsap'
import { MotionBlurShader } from './MotionBlurShader'
import { ZoomLinesShader } from './ZoomLinesShader'

export class PostProcessManager {
  private composer: EffectComposer
  private renderPass: RenderPass
  private motionBlurPass: ShaderPass
  private zoomLinesPass: ShaderPass
  private _enabled = false
  private isMobile: boolean

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.isMobile = this.detectMobile()

    this.composer = new EffectComposer(renderer)

    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)

    this.motionBlurPass = new ShaderPass(MotionBlurShader)
    this.motionBlurPass.enabled = false
    this.composer.addPass(this.motionBlurPass)

    this.zoomLinesPass = new ShaderPass(ZoomLinesShader)
    this.zoomLinesPass.enabled = false
    this.composer.addPass(this.zoomLinesPass)
  }

  private detectMobile(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
  }

  setScene(scene: THREE.Scene) {
    this.renderPass.scene = scene
  }

  setCamera(camera: THREE.Camera) {
    this.renderPass.camera = camera
  }

  enableMotionBlur(intensity: number = 0.6, duration: number = 0.8) {
    if (this.isMobile) return

    this.motionBlurPass.uniforms.intensity.value = intensity
    this.motionBlurPass.enabled = true
    this._enabled = true

    gsap.to(this.motionBlurPass.uniforms.intensity, {
      value: 0,
      duration: duration,
      ease: 'power2.out',
      onComplete: () => {
        this.motionBlurPass.enabled = false
        this.updateEnabledState()
      }
    })
  }

  enableZoomLines(intensity: number = 0.7, duration: number = 0.5) {
    if (this.isMobile) return

    this.zoomLinesPass.uniforms.intensity.value = intensity
    this.zoomLinesPass.enabled = true
    this._enabled = true

    gsap.to(this.zoomLinesPass.uniforms.intensity, {
      value: 0,
      duration: duration,
      ease: 'power2.out',
      onComplete: () => {
        this.zoomLinesPass.enabled = false
        this.updateEnabledState()
      }
    })
  }

  private updateEnabledState() {
    this._enabled = this.motionBlurPass.enabled || this.zoomLinesPass.enabled
  }

  get enabled(): boolean {
    return this._enabled
  }

  render() {
    this.composer.render()
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height)
  }

  dispose() {
    this.composer.dispose()
  }
}
