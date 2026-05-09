import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'

const TARGET_HEIGHT = 1.5 // world units
const SPEED = 5

export class Player {
  model: THREE.Group
  position: THREE.Vector3

  private keys = new Set<string>()
  private _keyDown: (e: KeyboardEvent) => void
  private _keyUp: (e: KeyboardEvent) => void

  private constructor(scene: THREE.Scene, model: THREE.Group) {
    // Scale character to TARGET_HEIGHT
    model.updateMatrixWorld(true)
    const b = new THREE.Box3().setFromObject(model)
    const h = b.max.y - b.min.y
    if (h > 0.001) model.scale.setScalar(TARGET_HEIGHT / h)
    model.updateMatrixWorld(true)

    // Sit on top of floor surface — bottom of character at FLOOR_LEVEL
    const b2 = new THREE.Box3().setFromObject(model)
    const startY = FLOOR_LEVEL - b2.min.y

    // Start at center of main room (tile 4.5,4.5 = world 9,9)
    this.position = new THREE.Vector3(9, startY, 9)
    model.position.copy(this.position)

    model.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        n.castShadow = true
        n.receiveShadow = true
      }
    })

    this.model = model
    scene.add(model)

    this._keyDown = (e) => this.keys.add(e.code)
    this._keyUp = (e) => this.keys.delete(e.code)
    window.addEventListener('keydown', this._keyDown)
    window.addEventListener('keyup', this._keyUp)
  }

  static async load(scene: THREE.Scene): Promise<Player> {
    const url = '/assets/characters/character-a.glb'
    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
        new GLTFLoader().load(url, res as never, undefined, rej),
      )
      console.log(`[Player] ✓ ${url}`)
      return new Player(scene, gltf.scene)
    } catch (err) {
      console.warn(`[Player] Failed to load ${url}, using fallback cube:`, err)
      // White cube placeholder: 0.6 wide × 1.5 tall
      const group = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.5, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      )
      body.position.y = 0.75
      group.add(body)
      return new Player(scene, group)
    }
  }

  update(dt: number) {
    const dir = new THREE.Vector3()
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    dir.z -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  dir.z += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  dir.x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.x += 1

    if (dir.lengthSq() > 0) {
      dir.normalize()
      this.position.x += dir.x * SPEED * dt
      this.position.z += dir.z * SPEED * dt
      this.model.position.set(this.position.x, this.position.y, this.position.z)
      this.model.rotation.y = Math.atan2(dir.x, dir.z)
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._keyDown)
    window.removeEventListener('keyup', this._keyUp)
  }
}
