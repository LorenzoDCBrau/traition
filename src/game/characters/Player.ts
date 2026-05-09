import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const SPEED = 5

export class Player {
  model: THREE.Group
  position = new THREE.Vector3(0, 0, 0)

  private keys = new Set<string>()
  private _keyDown: (e: KeyboardEvent) => void
  private _keyUp: (e: KeyboardEvent) => void

  private constructor(scene: THREE.Scene, model: THREE.Group) {
    this.model = model
    this.model.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        n.castShadow = true
        n.receiveShadow = true
      }
    })
    scene.add(this.model)

    this._keyDown = (e) => this.keys.add(e.code)
    this._keyUp = (e) => this.keys.delete(e.code)
    window.addEventListener('keydown', this._keyDown)
    window.addEventListener('keyup', this._keyUp)
  }

  static async load(scene: THREE.Scene): Promise<Player> {
    const url = '/assets/characters/character-a.glb'
    const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
      new GLTFLoader().load(url, res as never, undefined, rej),
    )
    console.log(`[Player] ✓ ${url}`)
    return new Player(scene, gltf.scene)
  }

  update(dt: number) {
    const dir = new THREE.Vector3()
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    dir.z -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  dir.z += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  dir.x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.x += 1

    if (dir.lengthSq() > 0) {
      dir.normalize()
      this.position.addScaledVector(dir, SPEED * dt)
      this.model.position.copy(this.position)
      // Rotate model to face movement direction
      this.model.rotation.y = Math.atan2(dir.x, dir.z)
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._keyDown)
    window.removeEventListener('keyup', this._keyUp)
  }
}
