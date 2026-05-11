import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

const TILE = 2
const WORLD_OFFSET = -7
const STATION = '/assets/maps/station/'

export const LOADED_GLBS: string[] = []
export let FLOOR_LEVEL = 0

// ─── Loaders ──────────────────────────────────────────────────────────────────

const COLORMAP_URL = `${STATION}Textures/colormap.png`

async function loadOBJ(name: string): Promise<THREE.Group | null> {
  return new Promise((resolve) => {
    const mtl = new MTLLoader()
    mtl.setPath(STATION)
    mtl.setResourcePath(`${STATION}Textures/`)
    console.log(`[RoomBuilder] Loading MTL: ${STATION}${name}.mtl`)
    mtl.load(
      `${name}.mtl`,
      (materials) => {
        materials.preload()
        console.log(`[RoomBuilder] MTL OK: ${name}, materials:`, Object.keys(materials.materialsInfo))
        const obj = new OBJLoader()
        obj.setMaterials(materials)
        obj.load(
          `${STATION}${name}.obj`,
          (group) => {
            console.log(`[RoomBuilder] OBJ OK: ${name}`)
            // Force colormap texture on all meshes as fallback
            const tex = new THREE.TextureLoader().load(COLORMAP_URL)
            tex.colorSpace = THREE.SRGBColorSpace
            group.traverse((node) => {
              if (node instanceof THREE.Mesh) {
                const mat = node.material as THREE.MeshStandardMaterial
                if (!mat.map) {
                  mat.map = tex
                  mat.needsUpdate = true
                }
              }
            })
            LOADED_GLBS.push(`${name}.obj`)
            resolve(group)
          },
          undefined,
          (err) => {
            console.error(`[RoomBuilder] ✗ OBJ: ${name}`, err)
            resolve(null)
          },
        )
      },
      undefined,
      (err) => {
        console.error(`[RoomBuilder] ✗ MTL: ${name}`, err)
        resolve(null)
      },
    )
  })
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function box3(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(obj)
}

/** Return scale so the largest XZ dimension of obj (at scale=1) equals target. */
function fitScaleFactor(obj: THREE.Group, target: number): number {
  obj.position.set(0, 0, 0)
  obj.rotation.set(0, 0, 0)
  obj.scale.set(1, 1, 1)
  obj.updateMatrixWorld(true)
  const size = box3(obj).getSize(new THREE.Vector3())
  const foot = Math.max(size.x, size.z)
  return foot > 0.001 ? target / foot : 1
}

function bottomOffset(obj: THREE.Group): number {
  obj.updateMatrixWorld(true)
  return -box3(obj).min.y
}

function makeFallback(w: number, h: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group()
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color }),
  )
  m.position.y = h / 2
  g.add(m)
  return g
}

function enableShadows(obj: THREE.Object3D) {
  obj.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true
      n.receiveShadow = true
    }
  })
}

function placeClone(
  tpl: THREE.Group,
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  rotY = 0,
) {
  const c = tpl.clone(true)
  c.position.set(x, y, z)
  c.rotation.y = rotY
  enableShadows(c)
  scene.add(c)
  return c
}

// ─── Tile map ─────────────────────────────────────────────────────────────────

const k = (tx: number, tz: number) => `${tx},${tz}`

function fillRect(set: Set<string>, tx1: number, tz1: number, tx2: number, tz2: number) {
  for (let tz = tz1; tz <= tz2; tz++)
    for (let tx = tx1; tx <= tx2; tx++)
      set.add(k(tx, tz))
}

function buildTileMap(walkable: Set<string>) {
  type Entry =
    | { type: 'floor' }
    | { type: 'wall'; rotY: number }
    | { type: 'corner'; rotY: number }

  const map = new Map<string, Entry>()

  for (const key of walkable) {
    const [txs, tzs] = key.split(',')
    const tx = +txs
    const tz = +tzs
    const N = walkable.has(k(tx, tz - 1))
    const S = walkable.has(k(tx, tz + 1))
    const E = walkable.has(k(tx + 1, tz))
    const W = walkable.has(k(tx - 1, tz))
    const blocked = [!N, !S, !E, !W].filter(Boolean).length

    if (blocked === 0) {
      map.set(key, { type: 'floor' })
    } else if (blocked === 1) {
      if (!N)      map.set(key, { type: 'wall', rotY: Math.PI })
      else if (!S) map.set(key, { type: 'wall', rotY: 0 })
      else if (!E) map.set(key, { type: 'wall', rotY: Math.PI / 2 })
      else         map.set(key, { type: 'wall', rotY: -Math.PI / 2 })
    } else if (blocked === 2 && !(!N && !S) && !(!E && !W)) {
      if (!N && !W)      map.set(key, { type: 'corner', rotY: Math.PI })
      else if (!N && !E) map.set(key, { type: 'corner', rotY: Math.PI / 2 })
      else if (!S && !W) map.set(key, { type: 'corner', rotY: -Math.PI / 2 })
      else if (!S && !E) map.set(key, { type: 'corner', rotY: 0 })
      else               map.set(key, { type: 'floor' })
    } else {
      map.set(key, { type: 'floor' })
    }
  }
  return map
}

/** Convert tile coordinate to world coordinate. */
const tw = (t: number) => t * TILE + WORLD_OFFSET

// ─── Public surface ───────────────────────────────────────────────────────────

export async function buildSpaceStationRoom(scene: THREE.Scene): Promise<string[]> {
  LOADED_GLBS.length = 0
  FLOOR_LEVEL = 0

  // Load all station models in parallel (new loaders per call = no shared state)
  const [floorM, wallM, cornerM, doorM, computerM, tableM, chairM] = await Promise.all([
    loadOBJ('floor'),
    loadOBJ('wall'),
    loadOBJ('wall-corner'),
    loadOBJ('wall-door'),
    loadOBJ('computer'),
    loadOBJ('table'),
    loadOBJ('chair'),
  ])

  // ── Structural templates ─────────────────────────────────────────────────
  const floorTpl  = floorM  ?? makeFallback(TILE * 0.99, 0.12, TILE * 0.99, 0x1a2030)
  const wallTpl   = wallM   ?? makeFallback(TILE * 0.99, 2.5,  0.18,        0x2a3a50)
  const cornerTpl = cornerM ?? makeFallback(0.18, 2.5, 0.18, 0x334455)
  const doorTpl   = doorM   ?? makeFallback(TILE * 0.99, 2.5, 0.18, 0x223344)

  // Compute unified scale from the floor tile (all station pieces share the same footprint)
  const sc = fitScaleFactor(floorTpl, TILE)
  for (const tpl of [floorTpl, wallTpl, cornerTpl, doorTpl]) {
    tpl.scale.setScalar(sc)
    tpl.updateMatrixWorld(true)
  }

  const floorY  = bottomOffset(floorTpl)
  const wallY   = bottomOffset(wallTpl)
  bottomOffset(cornerTpl)  // measure only, use wallY for placement
  bottomOffset(doorTpl)    // measure only, use wallY for placement

  // Compute wall top height for ceiling placement
  wallTpl.position.set(0, wallY, 0)
  wallTpl.updateMatrixWorld(true)
  const WALL_TOP = box3(wallTpl).max.y
  wallTpl.position.set(0, 0, 0)
  wallTpl.updateMatrixWorld(true)

  // ── Furniture templates ──────────────────────────────────────────────────
  const compTpl  = computerM ?? makeFallback(0.7, 1.2, 0.5, 0x334466)
  const tableTpl = tableM   ?? makeFallback(1.4, 0.8, 0.7, 0x5a3a22)
  const chairTpl = chairM   ?? makeFallback(0.5, 0.9, 0.5, 0x3a2a18)

  // Scale furniture independently so each fits nicely within a tile
  const scFurn = 1.4  // max footprint for furniture (< TILE so there's clearance)
  for (const tpl of [compTpl, tableTpl, chairTpl]) {
    const s = fitScaleFactor(tpl, scFurn)
    tpl.scale.setScalar(s)
    tpl.updateMatrixWorld(true)
  }
  const compY  = bottomOffset(compTpl)
  const tableY = bottomOffset(tableTpl)
  const chairY = bottomOffset(chairTpl)

  // ── Walkable tile set ────────────────────────────────────────────────────
  //   Main room 8×8 centered at world origin:
  //     tile (0,0) → world (-7,-7), tile (7,7) → world (7,7)
  //   Each room has corridors (2 wide × 2 long) connecting to secondary rooms (4×4).
  const walkable = new Set<string>()
  fillRect(walkable,  0,  0,  7,  7)   // Main room 8×8
  fillRect(walkable,  3, -2,  4, -1)   // North corridor 2×2
  fillRect(walkable,  2, -6,  5, -3)   // North room 4×4
  fillRect(walkable,  3,  8,  4,  9)   // South corridor 2×2
  fillRect(walkable,  2, 10,  5, 13)   // South room 4×4
  fillRect(walkable, -2,  3, -1,  4)   // West corridor 2×2
  fillRect(walkable, -6,  2, -3,  5)   // West room 4×4
  fillRect(walkable,  8,  3,  9,  4)   // East corridor 2×2
  fillRect(walkable, 10,  2, 13,  5)   // East room 4×4

  const tileMap = buildTileMap(walkable)

  // ── Place structural tiles ───────────────────────────────────────────────
  //   Door tiles: north/south entrances of main room where corridor meets it
  const doorKeys = new Set([
    k(3, -1), k(4, -1),   // north corridor side closest to main room
    k(3,  8), k(4,  8),   // south corridor side closest to main room
    k(-1, 3), k(-1, 4),   // west corridor side closest to main room
    k( 8, 3), k( 8, 4),   // east corridor side closest to main room
  ])

  for (const [key, entry] of tileMap) {
    const [txs, tzs] = key.split(',')
    const wx = +txs * TILE + WORLD_OFFSET
    const wz = +tzs * TILE + WORLD_OFFSET

    if (entry.type === 'floor') {
      placeClone(floorTpl, scene, wx, floorY, wz, 0)
    } else if (entry.type === 'wall') {
      if (doorKeys.has(key)) {
        placeClone(doorTpl, scene, wx, wallY, wz, entry.rotY)
      } else {
        placeClone(wallTpl, scene, wx, wallY, wz, entry.rotY)
      }
    } else if (entry.type === 'corner') {
      placeClone(cornerTpl, scene, wx, wallY, wz, entry.rotY)
    }
  }

  // ── Ceiling — inverted floor tile at wall height for all floor tiles ────
  for (const [key, entry] of tileMap) {
    if (entry.type !== 'floor') continue
    const [txs, tzs] = key.split(',')
    const wx = +txs * TILE + WORLD_OFFSET
    const wz = +tzs * TILE + WORLD_OFFSET
    const ceil = floorTpl.clone(true)
    ceil.position.set(wx, WALL_TOP, wz)
    ceil.rotation.x = Math.PI
    enableShadows(ceil)
    scene.add(ceil)
  }

  // ── Furniture — main room ────────────────────────────────────────────────
  for (const tx of [2, 3, 4, 5]) {
    placeClone(compTpl, scene, tw(tx), compY, tw(1), Math.PI)
  }
  placeClone(tableTpl, scene, tw(2), tableY, tw(4), 0)
  placeClone(tableTpl, scene, tw(5), tableY, tw(4), 0)
  placeClone(tableTpl, scene, tw(2), tableY, tw(6), 0)
  placeClone(tableTpl, scene, tw(5), tableY, tw(6), 0)
  placeClone(chairTpl, scene, tw(2), chairY, tw(3), 0)
  placeClone(chairTpl, scene, tw(5), chairY, tw(3), 0)
  placeClone(chairTpl, scene, tw(2), chairY, tw(5), Math.PI)
  placeClone(chairTpl, scene, tw(5), chairY, tw(5), Math.PI)

  // ── Furniture — north room: 2 computers + 1 table ───────────────────────
  placeClone(compTpl, scene, tw(3), compY, tw(-4), 0)
  placeClone(compTpl, scene, tw(4), compY, tw(-4), 0)
  placeClone(tableTpl, scene, tw(3), tableY, tw(-5), 0)

  // ── Furniture — south room: 2 chairs + 1 table ──────────────────────────
  placeClone(chairTpl, scene, tw(3), chairY, tw(11), Math.PI)
  placeClone(chairTpl, scene, tw(4), chairY, tw(11), Math.PI)
  placeClone(tableTpl, scene, tw(3), tableY, tw(12), Math.PI)

  // ── Furniture — west room: 2 tables ─────────────────────────────────────
  placeClone(tableTpl, scene, tw(-4), tableY, tw(3), Math.PI / 2)
  placeClone(tableTpl, scene, tw(-4), tableY, tw(4), Math.PI / 2)

  // ── Furniture — east room: 1 computer + 2 chairs ────────────────────────
  placeClone(compTpl, scene, tw(11), compY, tw(3), -Math.PI / 2)
  placeClone(chairTpl, scene, tw(12), chairY, tw(3), Math.PI / 2)
  placeClone(chairTpl, scene, tw(12), chairY, tw(4), Math.PI / 2)

  console.log(`[RoomBuilder] ${LOADED_GLBS.length} station models loaded:`)
  LOADED_GLBS.forEach((n) => console.log(`  ✓ ${n}`))

  return [...LOADED_GLBS]
}
