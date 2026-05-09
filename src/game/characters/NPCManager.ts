import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FLOOR_LEVEL } from '../world/RoomBuilder'

const loader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()

const TARGET_HEIGHT = 1.5

// Characters b–r = 17 NPCs (character-a is the player)
const NPC_IDS = ['b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r']

// [worldX, worldZ, rotY] — spread across main room (world 0–22, 0–22),
// north room (world 6–16, -12– -6), east room (world 26–34, 6–16),
// and west room (world -12– -4, 6–16).
const NPC_PLACEMENTS: [number, number, number][] = [
  // Main room
  [ 4,  4,  0.0],          // b — NW quadrant
  [18,  4,  Math.PI],      // c — NE quadrant
  [ 4, 18,  0.5],          // d — SW quadrant
  [18, 18, -0.5],          // e — SE quadrant
  [10,  2,  Math.PI],      // f — north wall center
  [12,  2,  Math.PI],      // g — north wall center
  [ 2, 10, -Math.PI / 2],  // h — west wall
  [20, 10,  Math.PI / 2],  // i — east wall
  [10, 20,  0],            // j — south area
  [12, 20,  0],            // k — south area
  [ 6, 12,  Math.PI / 3],  // l — interior
  [16, 12, -Math.PI / 3],  // m — interior
  // North room (world x≈6–16, z≈-12– -6)
  [10, -8,  0],            // n
  [14,-10,  Math.PI / 2],  // o
  // East room (world x≈26–34, z≈6–16)
  [28, 10,  Math.PI / 2],  // p
  [32, 14, -Math.PI / 4],  // q
  // West room (world x≈-12– -4, z≈6–16)
  [-8, 10, -Math.PI / 2],  // r
]

export async function spawnNPCs(scene: THREE.Scene): Promise<void> {
  for (let i = 0; i < NPC_IDS.length; i++) {
    const id = NPC_IDS[i]
    const [wx, wz, rotY] = NPC_PLACEMENTS[i] ?? [i * 2, 0, 0]

    try {
      const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
        loader.load(
          `/assets/characters/character-${id}.glb`,
          res as never,
          undefined,
          (e) => rej(e),
        ),
      )
      const model = gltf.scene

      // Apply matching texture
      const tex = texLoader.load(`/assets/characters/texture-${id}.png`)
      tex.colorSpace = THREE.SRGBColorSpace
      model.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          const mat = n.material as THREE.MeshStandardMaterial
          mat.map = tex
          mat.needsUpdate = true
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
      console.log(`[NPC] ✓ character-${id}`)
    } catch {
      console.warn(`[NPC] ✗ character-${id}`)
    }
  }
}
