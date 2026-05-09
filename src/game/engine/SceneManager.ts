import * as THREE from 'three'
import type { WeaponView } from '../weapons/WeaponView'

// Isometric-style offset: camera sits high and behind the player
const CAM_OFFSET = new THREE.Vector3(0, 14, 10)
const CAM_LERP = 0.08

// Weapon viewport dimensions (CSS pixels, bottom-right corner)
const WP_W = 220
const WP_H = 155
const WP_MARGIN = 12

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer

  private _lookTarget = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d1117)
    this.scene.fog = new THREE.FogExp2(0x0d1117, 0.018)

    const rect = canvas.getBoundingClientRect()
    const w = rect.width || window.innerWidth
    const h = rect.height || window.innerHeight

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
    this.camera.position.copy(CAM_OFFSET)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    this._setupLights()
    window.addEventListener('resize', this._onResize)
  }

  private _setupLights() {
    // Ambient fill
    this.scene.add(new THREE.AmbientLight(0x334466, 0.9))

    // Key light (sun-like from upper-left)
    const sun = new THREE.DirectionalLight(0xffffff, 3)
    sun.position.set(12, 22, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 100
    sun.shadow.camera.left = -24
    sun.shadow.camera.right = 24
    sun.shadow.camera.top = 24
    sun.shadow.camera.bottom = -24
    sun.shadow.bias = -0.001
    this.scene.add(sun)

    // Accent point lights for atmosphere
    const blue = new THREE.PointLight(0x4488ff, 3, 18)
    blue.position.set(-6, 3, -6)
    this.scene.add(blue)

    const red = new THREE.PointLight(0xff3322, 2, 14)
    red.position.set(6, 3, 6)
    this.scene.add(red)
  }

  followPlayer(pos: THREE.Vector3) {
    this._lookTarget.copy(pos)
    const target = pos.clone().add(CAM_OFFSET)
    this.camera.position.lerp(target, CAM_LERP)
    this.camera.lookAt(this._lookTarget)
  }

  render(weaponView?: WeaponView) {
    const canvas = this.renderer.domElement
    const W = canvas.clientWidth || window.innerWidth
    const H = canvas.clientHeight || window.innerHeight

    // --- Main isometric scene ---
    this.renderer.autoClear = true
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, W, H)
    this.renderer.render(this.scene, this.camera)

    // --- Weapon viewport (bottom-right, drawn on top) ---
    if (weaponView) {
      this.renderer.autoClear = false
      this.renderer.setScissorTest(true)
      this.renderer.setScissor(W - WP_W - WP_MARGIN, WP_MARGIN, WP_W, WP_H)
      this.renderer.setViewport(W - WP_W - WP_MARGIN, WP_MARGIN, WP_W, WP_H)
      this.renderer.clearColor()
      this.renderer.clearDepth()
      this.renderer.render(weaponView.scene, weaponView.camera)
      this.renderer.setScissorTest(false)
      this.renderer.autoClear = true
    }
  }

  private _onResize = () => {
    const canvas = this.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    this.renderer.setSize(rect.width, rect.height, false)
    this.camera.aspect = rect.width / rect.height
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    window.removeEventListener('resize', this._onResize)
    this.renderer.dispose()
  }
}
