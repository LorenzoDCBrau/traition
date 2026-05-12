import * as THREE from 'three'

// Isometric camera offset — lower Y gives a shallower angle showing characters better
const ISO = new THREE.Vector3(18, 16, 18)

// Orthographic frustum height — controls zoom. 24 units ≈ 8 tiles visible vertically.
const FRUSTUM_H = 24

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer

  private _lookTarget = new THREE.Vector3()
  private _playerLight = new THREE.PointLight(0xffffff, 1.5, 20)

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1f2e)

    const rect = canvas.getBoundingClientRect()
    const w = rect.width || window.innerWidth
    const h = rect.height || window.innerHeight
    const aspect = w / h

    this.camera = new THREE.OrthographicCamera(
      (-FRUSTUM_H * aspect) / 2,
      (FRUSTUM_H * aspect) / 2,
      FRUSTUM_H / 2,
      -FRUSTUM_H / 2,
      0.1,
      400,
    )
    this.camera.position.copy(ISO)
    this.camera.lookAt(0, 1, 0)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this._setupLights()
    window.addEventListener('resize', this._onResize)
  }

  private _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 3.0))

    const sun = new THREE.DirectionalLight(0xffffff, 4.0)
    sun.position.set(10, 20, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 150
    sun.shadow.camera.left = -40
    sun.shadow.camera.right = 40
    sun.shadow.camera.top = 40
    sun.shadow.camera.bottom = -40
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    this.scene.add(sun)

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.0))

    const center = new THREE.PointLight(0xffffff, 2.0, 30)
    center.position.set(0, 5, 0)
    this.scene.add(center)

    this._playerLight.position.set(0, 3, 0)
    this.scene.add(this._playerLight)
  }

  /** Place room-atmosphere point lights at world positions */
  addRoomLight(x: number, y: number, z: number, color = 0xffaa44, intensity = 4, dist = 16) {
    const light = new THREE.PointLight(color, intensity, dist)
    light.position.set(x, y, z)
    this.scene.add(light)
  }

  /** Instantly snap camera to player position (call once after loading) */
  snapToPlayer(pos: THREE.Vector3) {
    this.camera.position.copy(pos.clone().add(ISO))
    this._lookTarget.copy(pos)
    this.camera.lookAt(pos)
  }

  followPlayer(pos: THREE.Vector3) {
    this.camera.position.lerp(pos.clone().add(ISO), 0.08)
    this._lookTarget.lerp(pos, 0.08)
    this.camera.lookAt(this._lookTarget)
    this._playerLight.position.set(pos.x, pos.y + 3, pos.z)
  }

  render() {
    const canvas = this.renderer.domElement
    const W = canvas.clientWidth || window.innerWidth
    const H = canvas.clientHeight || window.innerHeight
    this.renderer.setViewport(0, 0, W, H)
    this.renderer.render(this.scene, this.camera)
  }

  private _onResize = () => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const aspect = rect.width / rect.height
    this.camera.left = (-FRUSTUM_H * aspect) / 2
    this.camera.right = (FRUSTUM_H * aspect) / 2
    this.camera.top = FRUSTUM_H / 2
    this.camera.bottom = -FRUSTUM_H / 2
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(rect.width, rect.height, false)
  }

  dispose() {
    window.removeEventListener('resize', this._onResize)
    this.renderer.dispose()
  }
}
