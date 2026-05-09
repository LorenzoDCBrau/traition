import * as THREE from 'three'

export class Blaster {
  mesh: THREE.Group

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.mesh = new THREE.Group()

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 }),
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.z = -0.2

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 }),
    )

    this.mesh.add(barrel, body)
    this.mesh.position.set(0.25, -0.2, -0.4)
    camera.add(this.mesh)
    scene.add(camera)
  }

  fire(scene: THREE.Scene, camera: THREE.Camera) {
    const projectile = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x00ffff }),
    )
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    projectile.position.copy(camera.position).addScaledVector(dir, 0.5)

    const vel = dir.multiplyScalar(20)
    scene.add(projectile)

    let life = 2
    const tick = (dt: number) => {
      life -= dt
      projectile.position.addScaledVector(vel, dt)
      if (life <= 0) {
        scene.remove(projectile)
        return false
      }
      return true
    }
    return tick
  }
}
