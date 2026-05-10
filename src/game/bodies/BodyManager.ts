import * as THREE from 'three'
import type { BodyData } from '../state/GameState'

const REPORT_RADIUS = 2.5

export class BodyManager {
  private meshes: Map<string, THREE.Mesh> = new Map()

  addBodyMesh(body: BodyData, scene: THREE.Scene) {
    if (this.meshes.has(body.id)) return

    const geo = new THREE.PlaneGeometry(1.2, 0.5)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcc2222,
      emissive: 0x440000,
      emissiveIntensity: 0.5,
      roughness: 0.9,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(body.position.x, 0.05, body.position.z)
    mesh.castShadow = false
    mesh.receiveShadow = true

    scene.add(mesh)
    this.meshes.set(body.id, mesh)
  }

  getNearBody(
    pos: THREE.Vector3,
    bodies: BodyData[],
  ): BodyData | null {
    for (const b of bodies) {
      if (b.reported) continue
      const dx = pos.x - b.position.x
      const dz = pos.z - b.position.z
      if (Math.sqrt(dx * dx + dz * dz) <= REPORT_RADIUS) return b
    }
    return null
  }

  removeBody(id: string, scene: THREE.Scene) {
    const mesh = this.meshes.get(id)
    if (mesh) {
      scene.remove(mesh)
      this.meshes.delete(id)
    }
  }
}
