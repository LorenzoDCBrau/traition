import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'

const TARGET_HEIGHT = 2.0
const SPEED = 5

// Room bounding boxes derived from tile layout (tw(t) = t*2-7)
function isWalkable(x: number, z: number): boolean {
  if (x >= -8 && x <= 8  && z >= -8 && z <= 8)   return true  // main room
  if (x >= -2 && x <= 2  && z >= -12 && z <= -8)  return true  // north corridor
  if (x >= -4 && x <= 4  && z >= -20 && z <= -12) return true  // north room
  if (x >= -2 && x <= 2  && z >= 8   && z <= 12)  return true  // south corridor
  if (x >= -4 && x <= 4  && z >= 12  && z <= 20)  return true  // south room
  if (x >= -12 && x <= -8 && z >= -2 && z <= 2)   return true  // west corridor
  if (x >= -20 && x <= -12 && z >= -4 && z <= 4)  return true  // west room
  if (x >= 8  && x <= 12 && z >= -2 && z <= 2)    return true  // east corridor
  if (x >= 12 && x <= 20 && z >= -4 && z <= 4)    return true  // east room
  return false
}

export class Player {
  model: THREE.Group
  position: THREE.Vector3

  onInteract?: () => void
  onReport?: () => void

  private keys = new Set<string>()
  private _keyDown: (e: KeyboardEvent) => void
  private _keyUp: (e: KeyboardEvent) => void

  private constructor(scene: THREE.Scene, model: THREE.Group) {
    model.updateMatrixWorld(true)
    const b = new THREE.Box3().setFromObject(model)
    const h = b.max.y - b.min.y
    if (h > 0.001) model.scale.setScalar(TARGET_HEIGHT / h)
    model.updateMatrixWorld(true)

    const b2 = new THREE.Box3().setFromObject(model)
    const startY = FLOOR_LEVEL - b2.min.y

    this.position = new THREE.Vector3(0, startY, 0)
    model.position.copy(this.position)

    model.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        n.castShadow = true
        n.receiveShadow = true
      }
    })

    this.model = model
    scene.add(model)

    this._keyDown = (e) => {
      this.keys.add(e.code)
      if (e.code === 'KeyE') this.onInteract?.()
      if (e.code === 'KeyF') this.onReport?.()
    }
    this._keyUp = (e) => this.keys.delete(e.code)
    window.addEventListener('keydown', this._keyDown)
    window.addEventListener('keyup', this._keyUp)
  }

  static async load(scene: THREE.Scene): Promise<Player> {
    const glbUrl = '/assets/characters/character-a.glb'
    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
        new GLTFLoader().load(glbUrl, res as never, undefined, rej),
      )
      console.log(`[Player] ✓ ${glbUrl}`)
      return new Player(scene, gltf.scene)
    } catch (err) {
      console.warn(`[Player] Failed to load ${glbUrl}, using fallback cube:`, err)
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
      const newX = this.position.x + dir.x * SPEED * dt
      const newZ = this.position.z + dir.z * SPEED * dt
      if (isWalkable(newX, this.position.z)) this.position.x = newX
      if (isWalkable(this.position.x, newZ)) this.position.z = newZ
      this.model.rotation.y = Math.atan2(dir.x, dir.z)
    }

    this.model.position.set(this.position.x, this.position.y, this.position.z)
  }

  dispose() {
    window.removeEventListener('keydown', this._keyDown)
    window.removeEventListener('keyup', this._keyUp)
  }
}
