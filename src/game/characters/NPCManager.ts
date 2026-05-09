import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'

const loader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()

const TARGET_HEIGHT = 2.0

// Characters b–r = 17 NPCs (character-a is the player)
const NPC_IDS = ['b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r']

export let DEBUG_NPCS_LOADED = 0

// [worldX, worldZ, rotY] — all within main room boundary ±12, centered at origin
const NPC_PLACEMENTS: [number, number, number][] = [
  [-7, -7,  0.0],          // b — NW quadrant
  [ 7, -7,  Math.PI],      // c — NE quadrant
  [-7,  7,  0.5],          // d — SW quadrant
  [ 7,  7, -0.5],          // e — SE quadrant
  [-1, -9,  Math.PI],      // f — north wall center
  [ 1, -9,  Math.PI],      // g — north wall center
  [-9, -1, -Math.PI / 2],  // h — west wall
  [ 9, -1,  Math.PI / 2],  // i — east wall
  [-1,  9,  0],            // j — south area
  [ 1,  9,  0],            // k — south area
  [-5,  1,  Math.PI / 3],  // l — interior
  [ 5,  1, -Math.PI / 3],  // m — interior
  [-3, -7,  0],            // n — interior north
  [ 3, -7,  Math.PI / 2],  // o — interior north
  [ 7,  3,  Math.PI / 2],  // p — interior east
  [-7,  3, -Math.PI / 4],  // q — interior west
  [ 0,  7,  0],            // r — interior south
]

const _loadedIds = new Set<string>()

export async function spawnNPCs(scene: THREE.Scene): Promise<void> {
  for (let i = 0; i < NPC_IDS.length; i++) {
    const id = NPC_IDS[i]

    if (_loadedIds.has(id)) {
      console.warn(`[NPC] Skipping duplicate: character-${id}`)
      continue
    }

    const [wx, wz, rotY] = NPC_PLACEMENTS[i] ?? [i * 2 - 11, 0, 0]

    try {
      const [gltf, texture] = await Promise.all([
        new Promise<{ scene: THREE.Group }>((res, rej) =>
          loader.load(
            `/assets/characters/character-${id}.glb`,
            res as never,
            undefined,
            (e) => rej(e),
          ),
        ),
        new Promise<THREE.Texture>((res, rej) =>
          texLoader.load(`/assets/characters/texture-${id}.png`, res, undefined, rej),
        ),
      ])
      texture.colorSpace = THREE.SRGBColorSpace
      const model = gltf.scene

      model.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          n.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, metalness: 0.0 })
          n.castShadow = true
          n.receiveShadow = true
        }
      })

      // Scale to target height
      model.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(model)
      const h = b.max.y - b.min.y
      if (h > 0.001) model.scale.setScalar(TARGET_HEIGHT / h)
      model.updateMatrixWorld(true)

      // Sit on floor surface
      const b2 = new THREE.Box3().setFromObject(model)
      const startY = FLOOR_LEVEL - b2.min.y
      model.position.set(wx, startY, wz)
      model.rotation.y = rotY

      scene.add(model)
      _loadedIds.add(id)
      DEBUG_NPCS_LOADED++
      console.log(`[NPC] ✓ character-${id} (total: ${DEBUG_NPCS_LOADED})`)
    } catch {
      console.warn(`[NPC] ✗ character-${id}`)
    }
  }
}
