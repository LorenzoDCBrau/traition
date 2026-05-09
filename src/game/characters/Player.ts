import * as THREE from 'three'

export class Player {
  object: THREE.Group
  velocity = new THREE.Vector3()
  speed = 5

  private keys = new Set<string>()

  constructor(scene: THREE.Scene) {
    this.object = new THREE.Group()

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x0066ff }),
    )
    body.position.y = 0.9
    body.castShadow = true
    this.object.add(body)

    scene.add(this.object)

    window.addEventListener('keydown', (e) => this.keys.add(e.code))
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
  }

  update(dt: number, camera: THREE.Camera) {
    const dir = new THREE.Vector3()
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dir.z -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dir.z += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dir.x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.x += 1

    if (dir.lengthSq() > 0) {
      dir.normalize()
      dir.applyEuler(new THREE.Euler(0, camera.rotation.y, 0))
      this.object.position.addScaledVector(dir, this.speed * dt)
    }

    camera.position.copy(this.object.position).add(new THREE.Vector3(0, 1.7, 0))
  }

  dispose() {
    window.removeEventListener('keydown', (e) => this.keys.add(e.code))
    window.removeEventListener('keyup', (e) => this.keys.delete(e.code))
  }
}
