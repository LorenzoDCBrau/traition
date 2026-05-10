import * as THREE from 'three'
import type { MissionData, MissionType, GameStateManager } from '../state/GameState'

const INTERACT_RADIUS = 2.5

// Visual markers placed in the scene for each mission terminal
export class MissionSystem {
  markers: Map<string, THREE.Object3D> = new Map()

  init(scene: THREE.Scene, missions: MissionData[]) {
    for (const m of missions) {
      const marker = this._makeMarker(m.type)
      marker.position.set(m.position.x, 0.05, m.position.z)
      scene.add(marker)
      this.markers.set(m.id, marker)
    }
  }

  /** Returns the nearest incomplete mission within interact radius, or null */
  getNearMission(
    pos: THREE.Vector3,
    gsm: GameStateManager,
  ): MissionData | null {
    let best: MissionData | null = null
    let bestDist = Infinity

    for (const m of gsm.missions) {
      if (m.completed) continue
      const dx = pos.x - m.position.x
      const dz = pos.z - m.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < INTERACT_RADIUS && dist < bestDist) {
        bestDist = dist
        best = m
      }
    }
    return best
  }

  /** Assign pending missions to NPC wanderers */
  assignMissionsToNPCs(npcs: { id: string; alive: boolean; role: string; missionId: string | null; assignMission: (pos: { x: number; z: number }, id: string) => void }[], gsm: GameStateManager) {
    const pendingMissions = gsm.missions.filter(
      (m) => !m.completed && !m.workedBy,
    )

    const idleNpcs = npcs.filter(
      (n) => n.alive && n.role !== 'TRAITOR' && n.missionId === null,
    )

    for (let i = 0; i < Math.min(pendingMissions.length, idleNpcs.length); i++) {
      const mission = pendingMissions[i]
      const npc = idleNpcs[i]
      mission.workedBy = npc.id
      npc.assignMission(mission.position, mission.id)
    }
  }

  updateMarkers(gsm: GameStateManager) {
    for (const m of gsm.missions) {
      const marker = this.markers.get(m.id)
      if (!marker) continue
      // Fade out completed markers
      marker.visible = !m.completed
    }
  }

  private _makeMarker(type: MissionType): THREE.Object3D {
    const color = this._missionColor(type)
    const group = new THREE.Group()

    // Glowing ring on floor
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.9, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5,
        side: THREE.DoubleSide,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    group.add(ring)

    // Floating icon pillar (thin cylinder)
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.0,
      }),
    )
    pillar.position.y = 0.75
    group.add(pillar)

    return group
  }

  private _missionColor(type: MissionType): number {
    switch (type) {
      case 'HACK_TERMINAL':  return 0x00ffcc
      case 'FIX_GENERATOR':  return 0xffaa00
      case 'REPAIR_PANEL':   return 0xff4488
      case 'UPLOAD_DATA':    return 0x4488ff
      case 'SCAN_ID':        return 0xaaff44
    }
  }
}
