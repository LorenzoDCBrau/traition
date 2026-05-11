import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'
import { NPC, NPC_NAMES } from './NPC'
import type { Role } from '../roles/RoleSystem'

const loader = new GLTFLoader()

const NPC_IDS = ['b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r']

export let DEBUG_NPCS_LOADED = 0

const MAX_BOUND = 11

// [wx, wz, rotY] — spread across all rooms
const NPC_PLACEMENTS: [number, number, number][] = [
  // Main room
  [-3, -3,  0],
  [-1, -2,  Math.PI / 4],
  [ 1, -3,  Math.PI],
  [ 3, -2, -Math.PI / 4],
  [-2,  0,  Math.PI / 2],
  [ 2,  0, -Math.PI / 2],
  [-3,  2,  Math.PI / 3],
  [ 0,  3, -Math.PI / 6],
  [ 3,  2,  Math.PI],
  // North room
  [-1, -9,  Math.PI],
  [ 1, -9,  Math.PI],
  [ 0, -11, Math.PI],
  // South room
  [-1,  9,  0],
  [ 1,  9,  0],
  [ 0,  11, 0],
  // East room
  [ 9, -1,  Math.PI / 2],
  [ 9,  1,  Math.PI / 2],
  // West room
  [-9, -1, -Math.PI / 2],
  [-9,  1, -Math.PI / 2],
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

      // Uniform scale — GLBs are pre-sized correctly
      model.scale.setScalar(1.0)
      model.updateMatrixWorld(true)

      const b2 = new THREE.Box3().setFromObject(model)
      const startY = FLOOR_LEVEL - b2.min.y

      // Clamp spawn within walkable bounds
      const clampedX = Math.max(-MAX_BOUND, Math.min(MAX_BOUND, wx))
      const clampedZ = Math.max(-MAX_BOUND, Math.min(MAX_BOUND, wz))

      model.position.set(clampedX, startY, clampedZ)
      model.rotation.y = rotY

      const startPos = new THREE.Vector3(clampedX, startY, clampedZ)
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
