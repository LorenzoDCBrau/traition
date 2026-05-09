import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// All spacekit pieces share the same grid size
const TILE = 2 // world units per grid cell

const loader = new GLTFLoader()

// ─── Loader helpers ──────────────────────────────────────────────────────────

async function tryLoad(url: string): Promise<THREE.Group | null> {
  try {
    return await new Promise((res, rej) =>
      loader.load(url, (g) => res(g.scene), undefined, rej),
    )
  } catch {
    console.warn(`[RoomBuilder] ✗ ${url}`)
    return null
  }
}

function box3(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(obj)
}

/** Scale obj so its largest XZ dimension equals targetSize. Returns the y-offset
 *  needed to place it with its bottom sitting exactly at y=0. */
function fitToGrid(obj: THREE.Group, targetSize = TILE): number {
  obj.position.set(0, 0, 0)
  obj.rotation.set(0, 0, 0)
  obj.updateMatrixWorld(true)
  const b = box3(obj)
  const s = b.getSize(new THREE.Vector3())
  const footprint = Math.max(s.x, s.z)
  if (footprint > 0.001) {
    obj.scale.setScalar(targetSize / footprint)
    obj.updateMatrixWorld(true)
  }
  return -box3(obj).min.y // y-offset so clone placed at this y has bottom at 0
}

/** Apply the same uniform scale to a set of models (to keep kit pieces consistent). */
function applyUnifiedScale(models: THREE.Group[], scale: number) {
  for (const m of models) {
    m.scale.setScalar(scale)
    m.updateMatrixWorld(true)
  }
}

function bottomY(obj: THREE.Group): number {
  return -box3(obj).min.y
}

function enableShadows(obj: THREE.Object3D) {
  obj.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true
      n.receiveShadow = true
    }
  })
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

/** For each walkable tile, determine which piece to place based on neighbors.
 *
 *  Wall orientation assumption (Kenney corridor_wall default faces +Z / south):
 *    !hasN (north missing) → wall faces north  → rotY = Math.PI
 *    !hasS (south missing) → wall faces south  → rotY = 0
 *    !hasE (east missing)  → wall faces east   → rotY = Math.PI / 2
 *    !hasW (west missing)  → wall faces west   → rotY = -Math.PI / 2
 *
 *  Corner assumption (default = SE corner, walls on +Z and +X):
 *    !hasS && !hasE → rotY = 0         (SE)
 *    !hasS && !hasW → rotY = -Math.PI/2 (SW)
 *    !hasN && !hasE → rotY = Math.PI/2  (NE)
 *    !hasN && !hasW → rotY = Math.PI    (NW)
 */
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
      if (!N) map.set(key, { type: 'wall', rotY: Math.PI })
      else if (!S) map.set(key, { type: 'wall', rotY: 0 })
      else if (!E) map.set(key, { type: 'wall', rotY: Math.PI / 2 })
      else map.set(key, { type: 'wall', rotY: -Math.PI / 2 })
    } else if (blocked === 2 && !(!N && S && !E && W) && !(!S && N && !W && E)) {
      // Two perpendicular blocked sides → corner
      if (!N && !W)      map.set(key, { type: 'corner', rotY: Math.PI })
      else if (!N && !E) map.set(key, { type: 'corner', rotY: Math.PI / 2 })
      else if (!S && !W) map.set(key, { type: 'corner', rotY: -Math.PI / 2 })
      else if (!S && !E) map.set(key, { type: 'corner', rotY: 0 })
      else               map.set(key, { type: 'floor' })
    } else {
      // Opposite blocked sides (corridor or peninsula) → floor
      map.set(key, { type: 'floor' })
    }
  }
  return map
}

// ─── Public surface ───────────────────────────────────────────────────────────

export const LOADED_GLBS: string[] = []

/** Floor level in world-Y after room is built. Useful for placing characters. */
export let FLOOR_LEVEL = 0

export async function buildSpaceStationRoom(
  scene: THREE.Scene,
): Promise<string[]> {
  LOADED_GLBS.length = 0

  const track = async (url: string) => {
    const m = await tryLoad(url)
    if (m) LOADED_GLBS.push(url)
    return m
  }

  // ── Load assets ──────────────────────────────────────────────────────────
  const [rawFloor, rawWall, rawCorner] = await Promise.all([
    track('/assets/maps/spacekit/corridor_open.glb'),
    track('/assets/maps/spacekit/corridor_wall.glb'),
    track('/assets/maps/spacekit/corridor_wallCorner.glb'),
  ])

  const [arcadeM, pinballM, vendingM, deskM, cashM, clawM] = await Promise.all([
    track('/assets/furniture/arcade-machine.glb'),
    track('/assets/furniture/pinball.glb'),
    track('/assets/furniture/vending-machine.glb'),
    track('/assets/furniture/cash-register.glb'),
    track('/assets/furniture/claw-machine.glb'),
    track('/assets/furniture/dance-machine.glb'),
  ])

  // ── Prepare spacekit templates with unified scale ────────────────────────
  // Measure native floor footprint, apply that same scale to wall + corner
  // so all pieces from the same kit tessellate correctly.
  const floorTpl = rawFloor ?? makeFallback(TILE * 0.98, 0.15, TILE * 0.98, 0x334455)
  const wallTpl  = rawWall  ?? makeFallback(TILE * 0.98, 2.2,  0.15,        0x445566)
  const cornerTpl = rawCorner ?? makeFallback(0.15, 2.2, 0.15, 0x556677)

  // Determine scale from floor tile
  floorTpl.position.set(0, 0, 0)
  floorTpl.rotation.set(0, 0, 0)
  floorTpl.updateMatrixWorld(true)
  const floorNative = box3(floorTpl).getSize(new THREE.Vector3())
  const nativeFootprint = Math.max(floorNative.x, floorNative.z)
  const tileScale = nativeFootprint > 0.001 ? TILE / nativeFootprint : 1

  applyUnifiedScale([floorTpl, wallTpl, cornerTpl], tileScale)

  const floorY  = bottomY(floorTpl)
  const wallY   = bottomY(wallTpl)
  const cornerY = bottomY(cornerTpl)

  // Compute floor top surface for character placement
  const floorBox = box3(floorTpl)
  FLOOR_LEVEL = floorBox.max.y

  console.log(
    `[RoomBuilder] tile footprint=${nativeFootprint.toFixed(3)} → scale=${tileScale.toFixed(3)},` +
    ` floorY=${floorY.toFixed(3)}, floorTop=${FLOOR_LEVEL.toFixed(3)}`,
  )

  // ── Define walkable tile map ─────────────────────────────────────────────
  //   Tile coordinates: each tile = TILE world units. +X = east, +Z = south.
  //   World position of tile (tx,tz) = (tx*TILE, 0, tz*TILE)
  //
  //   Layout:
  //     Main room:    tx=0..9,   tz=0..9   (10×10)
  //     North room:   tx=3..6,   tz=-6..-3 (4×4)
  //     N corridor:   tx=4..5,   tz=-2..-1 (2×2)
  //     East room:    tx=11..15, tz=3..6   (5×4)
  //     E corridor:   tx=10,     tz=4..5   (1×2)
  //     West room:    tx=-6..-2, tz=3..6   (5×4)
  //     W corridor:   tx=-1,     tz=4..5   (1×2)

  const walkable = new Set<string>()
  fillRect(walkable,  0,  0,  9,  9) // main room
  fillRect(walkable,  3, -6,  6, -3) // north room
  fillRect(walkable,  4, -2,  5, -1) // north corridor
  fillRect(walkable, 11,  3, 15,  6) // east room
  fillRect(walkable, 10,  4, 10,  5) // east corridor
  fillRect(walkable, -6,  3, -2,  6) // west room
  fillRect(walkable, -1,  4, -1,  5) // west corridor

  // ── Place tiles ──────────────────────────────────────────────────────────
  const tileMap = buildTileMap(walkable)

  for (const [key, entry] of tileMap) {
    const [txs, tzs] = key.split(',')
    const wx = +txs * TILE
    const wz = +tzs * TILE
    if (entry.type === 'floor')  placeClone(floorTpl,  scene, wx, floorY,  wz)
    if (entry.type === 'wall')   placeClone(wallTpl,   scene, wx, wallY,   wz, entry.rotY)
    if (entry.type === 'corner') placeClone(cornerTpl, scene, wx, cornerY, wz, entry.rotY)
  }

  // ── Prepare furniture templates (each scaled independently) ───────────────
  const furnitureSize = 1.7 // target XZ footprint for furniture pieces

  const prepFurniture = (m: THREE.Group | null): [THREE.Group, number] | null => {
    if (!m) return null
    const y = fitToGrid(m, furnitureSize)
    return [m, y]
  }

  const arcade  = prepFurniture(arcadeM)
  const pinball = prepFurniture(pinballM)
  const vending = prepFurniture(vendingM)
  const desk    = prepFurniture(deskM)
  const cash    = prepFurniture(cashM)
  const claw    = prepFurniture(clawM)

  // Helper — place furniture at tile (tx, tz), optionally rotated
  const putFurn = (
    item: [THREE.Group, number] | null,
    tx: number,
    tz: number,
    rotY = 0,
  ) => {
    if (!item) return
    const [tpl, y] = item
    placeClone(tpl, scene, tx * TILE, y, tz * TILE, rotY)
  }

  // Main room furniture (10×10, center at tile 4.5)
  putFurn(arcade,  1, 1,  Math.PI)
  putFurn(arcade,  8, 1,  Math.PI)
  putFurn(pinball, 1, 8,  0)
  putFurn(pinball, 8, 8,  0)
  putFurn(vending, 1, 4,  Math.PI / 2)
  putFurn(vending, 8, 4, -Math.PI / 2)
  putFurn(cash,    4, 1,  0)
  putFurn(claw,    5, 8,  Math.PI)

  // North room (tiles 3..6, -6..-3)
  putFurn(desk,    4, -5,  Math.PI)
  putFurn(desk,    5, -5,  Math.PI)
  putFurn(arcade,  3, -4,  Math.PI / 2)
  putFurn(pinball, 6, -4, -Math.PI / 2)

  // East room (tiles 11..15, 3..6)
  putFurn(arcade,  12, 4,  -Math.PI / 2)
  putFurn(claw,    14, 5,   Math.PI)
  putFurn(pinball, 13, 3,   0)
  putFurn(vending, 11, 4,   Math.PI / 2)

  // West room (tiles -6..-2, 3..6)
  putFurn(arcade,  -5, 4,  Math.PI / 2)
  putFurn(pinball, -3, 5,  Math.PI)
  putFurn(desk,    -4, 3,  0)
  putFurn(vending, -6, 4, -Math.PI / 2)

  console.log(`[RoomBuilder] ${LOADED_GLBS.length} GLBs loaded:`)
  LOADED_GLBS.forEach((u) => console.log(`  ✓ ${u}`))

  return [...LOADED_GLBS]
}
