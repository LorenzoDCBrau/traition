import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'
import { NPC, NPC_NAMES } from './NPC'
import type { Role } from '../roles/RoleSystem'

const loader = new GLTFLoader()

const TARGET_HEIGHT = 2.0

const NPC_IDS = ['b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r']

export let DEBUG_NPCS_LOADED = 0

// [wx, wz, rotY] — 6 center + 3 north + 3 south + 3 east + 2 west = 17
// Room world bounds (tw(t) = t*2-7):
//   Center:  x∈[-7,7],  z∈[-7,7]
//   North:   x∈[-3,3],  z∈[-19,-13]
//   South:   x∈[-3,3],  z∈[13,19]
//   West:    x∈[-19,-13], z∈[-3,3]
//   East:    x∈[13,19],   z∈[-3,3]
const NPC_PLACEMENTS: [number, number, number][] = [
  // Center room (6)
  [-3, -3,  0],
  [ 3, -3,  Math.PI],
  [-3,  3,  Math.PI],
  [ 3,  3,  0],
  [ 0, -2,  Math.PI],
  [ 0,  2,  0],
  // North room (3)
  [-1, -15, Math.PI],
  [ 1, -15, Math.PI],
  [ 0, -17, 0],
  // South room (3)
  [-1,  15, 0],
  [ 1,  15, 0],
  [ 0,  17, Math.PI],
  // East room (3)
  [ 15, -1, -Math.PI / 2],
  [ 15,  1, -Math.PI / 2],
  [ 17,  0, -Math.PI / 2],
  // West room (2)
  [-15, -1,  Math.PI / 2],
  [-15,  1,  Math.PI / 2],
]

const _loadedIds = new Set<string>()

export async function spawnNPCs(scene: THREE.Scene, roles: Role[]): Promise<NPC[]> {
  const npcs: NPC[] = []
  DEBUG_NPCS_LOADED = 0
  _loadedIds.clear()

  const namePool = [...NPC_NAMES].sort(() => Math.random() - 0.5)

  for (let i = 0; i < NPC_IDS.length; i++) {
    const id = NPC_IDS[i]
    if (_loadedIds.has(id)) {
      console.warn(`[NPC] Skipping duplicate: character-${id}`)
      continue
    }

    const [wx, wz, rotY] = NPC_PLACEMENTS[i] ?? [i * 2 - 11, 0, 0]
    const role = roles[i] ?? 'INNOCENT'
    const name = namePool[i % namePool.length]

    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
        loader.load(
          `/assets/characters/character-${id}.glb`,
          res as never,
          undefined,
          (e) => { console.error(`[NPC] GLB error character-${id}:`, e); rej(e) },
        ),
      )

      const model = gltf.scene

      model.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          n.castShadow = true
          n.receiveShadow = true
        }
      })

      // Uniform scale normalised to TARGET_HEIGHT
      model.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(model)
      const height = box.max.y - box.min.y
      const scale = height > 0.001 ? TARGET_HEIGHT / height : 1
      model.scale.set(scale, scale, scale)
      model.updateMatrixWorld(true)

      const b2 = new THREE.Box3().setFromObject(model)
      const startY = FLOOR_LEVEL - b2.min.y

      model.position.set(wx, startY, wz)
      model.rotation.y = rotY

      const startPos = new THREE.Vector3(wx, startY, wz)
      scene.add(model)

      const npc = new NPC(`npc-${i}`, name, role, model, startPos, scene)
      npcs.push(npc)

      _loadedIds.add(id)
      DEBUG_NPCS_LOADED++
      console.log(`[NPC] ✓ character-${id} "${name}" [${role}] (total: ${DEBUG_NPCS_LOADED})`)
    } catch {
      console.warn(`[NPC] ✗ character-${id}`)
    }
  }

  return npcs
}
