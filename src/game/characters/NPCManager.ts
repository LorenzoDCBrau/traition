import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'
import { NPC, NPC_NAMES } from './NPC'
import type { Role } from '../roles/RoleSystem'

const loader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()

const TARGET_HEIGHT = 2.0

const NPC_IDS = ['b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r']

export let DEBUG_NPCS_LOADED = 0

const NPC_PLACEMENTS: [number, number, number][] = [
  [-7, -7,  0.0],
  [ 7, -7,  Math.PI],
  [-7,  7,  0.5],
  [ 7,  7, -0.5],
  [-1, -9,  Math.PI],
  [ 1, -9,  Math.PI],
  [-9, -1, -Math.PI / 2],
  [ 9, -1,  Math.PI / 2],
  [-1,  9,  0],
  [ 1,  9,  0],
  [-5,  1,  Math.PI / 3],
  [ 5,  1, -Math.PI / 3],
  [-3, -7,  0],
  [ 3, -7,  Math.PI / 2],
  [ 7,  3,  Math.PI / 2],
  [-7,  3, -Math.PI / 4],
  [ 0,  7,  0],
]

const _loadedIds = new Set<string>()

export async function spawnNPCs(scene: THREE.Scene, roles: Role[]): Promise<NPC[]> {
  const npcs: NPC[] = []
  DEBUG_NPCS_LOADED = 0
  _loadedIds.clear()

  // Shuffle NPC_NAMES for this session
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
      const texPath = `/assets/characters/texture-${id}.png`
      console.log(`[NPC] Loading texture: ${texPath}`)

      const [gltf, texture] = await Promise.all([
        new Promise<{ scene: THREE.Group }>((res, rej) =>
          loader.load(
            `/assets/characters/character-${id}.glb`,
            res as never,
            undefined,
            (e) => { console.error(`[NPC] GLB error character-${id}:`, e); rej(e) },
          ),
        ),
        new Promise<THREE.Texture>((res, rej) =>
          texLoader.load(
            texPath,
            (tex) => { console.log(`[NPC] Texture OK: ${texPath}`, tex); res(tex) },
            undefined,
            (err) => { console.error(`[NPC] Texture error: ${texPath}`, err); rej(err) },
          ),
        ),
      ])

      // GLB UVs use bottom-left origin — must disable flipY to match
      texture.flipY = false
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true

      const model = gltf.scene

      model.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          const oldMat = n.material as THREE.MeshStandardMaterial
          n.material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: oldMat.transparent,
            alphaTest: oldMat.alphaTest,
            side: THREE.DoubleSide,
          })
          n.material.needsUpdate = true
          n.castShadow = true
          n.receiveShadow = true
        }
      })

      model.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(model)
      const h = b.max.y - b.min.y
      if (h > 0.001) model.scale.setScalar(TARGET_HEIGHT / h)
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
