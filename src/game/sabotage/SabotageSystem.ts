import * as THREE from 'three'
import type { GameStateManager, SabotageType } from '../state/GameState'

/** Manages Three.js visual effects for active sabotages */
export class SabotageSystem {
  private blackoutMesh: THREE.Mesh | null = null
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this._buildBlackout()
  }

  private _buildBlackout() {
    const geo = new THREE.PlaneGeometry(300, 300)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.5
    mesh.renderOrder = 999
    this.scene.add(mesh)
    this.blackoutMesh = mesh
  }

  /** Call every frame to update visual effects */
  update(gsm: GameStateManager) {
    if (this.blackoutMesh) {
      const mat = this.blackoutMesh.material as THREE.MeshBasicMaterial
      mat.opacity = gsm.activeBlackout ? 0.88 : 0
    }
  }

  /** Convenience: trigger sabotage and return whether it succeeded */
  activate(type: SabotageType, gsm: GameStateManager): boolean {
    return gsm.activateSabotage(type)
  }
}
