import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Kenney Space Kit tiles are 2 units × 2 units
const TILE = 2

const loader = new GLTFLoader()

function loadGLB(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) =>
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(new Error(`Failed to load ${url}: ${err}`)),
    ),
  )
}

function enableShadows(obj: THREE.Object3D) {
  obj.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true
      n.receiveShadow = true
    }
  })
}

function place(
  template: THREE.Group,
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  rotY = 0,
) {
  const obj = template.clone(true)
  obj.position.set(x, y, z)
  obj.rotation.y = rotY
  enableShadows(obj)
  scene.add(obj)
  return obj
}

export const LOADED_GLBS: string[] = []

// Room layout:
//   5×5 open floor tiles in the center
//   wall segments around the perimeter
//   corner pieces at the 4 corners
//   scattered props inside
export async function buildSpaceStationRoom(scene: THREE.Scene): Promise<string[]> {
  LOADED_GLBS.length = 0

  const paths = {
    floor:    '/assets/maps/spacekit/corridor_open.glb',
    wall:     '/assets/maps/spacekit/corridor_wall.glb',
    corner:   '/assets/maps/spacekit/corridor_wallCorner.glb',
    corridor: '/assets/maps/spacekit/corridor.glb',
    desk:     '/assets/maps/spacekit/desk_computer.glb',
    gen:      '/assets/maps/spacekit/machine_generator.glb',
    barrels:  '/assets/maps/spacekit/barrels.glb',
    stairs:   '/assets/maps/spacekit/stairs.glb',
  }

  const results = await Promise.allSettled(
    Object.entries(paths).map(([key, url]) =>
      loadGLB(url).then((glb) => ({ key, url, glb })),
    ),
  )

  const models: Partial<Record<keyof typeof paths, THREE.Group>> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { key, url, glb } = r.value
      models[key as keyof typeof paths] = glb
      LOADED_GLBS.push(url)
      console.log(`[RoomBuilder] ✓ ${url}`)
    } else {
      console.warn(`[RoomBuilder] ✗ ${r.reason}`)
    }
  }

  const { floor, wall, corner, corridor, desk, gen, barrels, stairs } = models

  // ── Floor: 5×5 open tiles ──────────────────────────────────────────────
  if (floor) {
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        place(floor, scene, col * TILE, 0, row * TILE)
      }
    }
  }

  // ── North wall (z = -3*TILE, facing south) ────────────────────────────
  if (wall) {
    for (let col = -2; col <= 2; col++) {
      place(wall, scene, col * TILE, 0, -3 * TILE, 0)
    }
    // South wall
    for (let col = -2; col <= 2; col++) {
      place(wall, scene, col * TILE, 0, 3 * TILE, Math.PI)
    }
    // West wall
    for (let row = -2; row <= 2; row++) {
      place(wall, scene, -3 * TILE, 0, row * TILE, -Math.PI / 2)
    }
    // East wall
    for (let row = -2; row <= 2; row++) {
      place(wall, scene, 3 * TILE, 0, row * TILE, Math.PI / 2)
    }
  }

  // ── Corners ───────────────────────────────────────────────────────────
  if (corner) {
    place(corner, scene, -3 * TILE, 0, -3 * TILE, 0)
    place(corner, scene,  3 * TILE, 0, -3 * TILE,  Math.PI / 2)
    place(corner, scene,  3 * TILE, 0,  3 * TILE,  Math.PI)
    place(corner, scene, -3 * TILE, 0,  3 * TILE, -Math.PI / 2)
  }

  // ── Side corridors (extend north and south) ───────────────────────────
  if (corridor) {
    // North corridor stub (exits the main room)
    place(corridor, scene, 0, 0, -4 * TILE, 0)
    // South corridor stub
    place(corridor, scene, 0, 0,  4 * TILE, Math.PI)
  }

  // ── Props (task stations) ──────────────────────────────────────────────
  if (desk) {
    place(desk, scene, -TILE, 0, -2 * TILE, Math.PI)
    place(desk, scene,  TILE, 0, -2 * TILE, Math.PI)
  }
  if (gen) {
    place(gen, scene,  2 * TILE, 0, 2 * TILE, -Math.PI / 2)
  }
  if (barrels) {
    place(barrels, scene, -2 * TILE, 0, 2 * TILE)
  }
  if (stairs) {
    place(stairs, scene, 2 * TILE, 0, -2 * TILE, Math.PI / 2)
  }

  console.log(`[RoomBuilder] Loaded ${LOADED_GLBS.length}/${Object.keys(paths).length} GLBs`)
  return [...LOADED_GLBS]
}
