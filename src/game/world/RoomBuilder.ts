import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'

// All spacekit pieces share the same grid size
const TILE = 2 // world units per grid cell

const gltfLoader = new GLTFLoader()
const texLoader = new THREE.TextureLoader()

// ─── Loader helpers ──────────────────────────────────────────────────────────

async function tryLoadGLB(url: string): Promise<THREE.Group | null> {
  try {
    return await new Promise((res, rej) =>
      gltfLoader.load(url, (g) => res(g.scene), undefined, (e) => rej(e)),
    )
  } catch {
    console.warn(`[RoomBuilder] ✗ GLB: ${url}`)
    return null
  }
}

async function tryLoadOBJ(name: string): Promise<THREE.Group | null> {
  try {
    const mtlLoader = new MTLLoader()
    mtlLoader.setPath('/assets/maps/station/')
    mtlLoader.setResourcePath('/assets/maps/station/Textures/')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const materials: any = await new Promise((res, rej) =>
      mtlLoader.load(`${name}.mtl`, (mc) => res(mc), undefined, (e) => rej(e)),
    )
    materials.preload()

    const objLoader = new OBJLoader()
    objLoader.setMaterials(materials)
    objLoader.setPath('/assets/maps/station/')
    return await new Promise<THREE.Group>((res, rej) =>
      objLoader.load(`${name}.obj`, res, undefined, (e) => rej(e)),
    )
  } catch {
    console.warn(`[RoomBuilder] ✗ OBJ: ${name}`)
    return null
  }
}

function box3(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(obj)
}

/** Scale obj so its largest XZ dimension equals targetSize. Returns y-offset
 *  so a clone placed at that y has its bottom at world y=0. */
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
  return -box3(obj).min.y
}

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

/** Apply a texture to all MeshStandardMaterial meshes in a group. */
function applyTexture(model: THREE.Group, tex: THREE.Texture) {
  model.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      const mat = n.material
      if (Array.isArray(mat)) {
        for (const m of mat) {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.map = tex
            m.needsUpdate = true
          }
        }
      } else if (mat instanceof THREE.MeshStandardMaterial) {
        mat.map = tex
        mat.needsUpdate = true
      }
    }
  })
}

// ─── Tile map ─────────────────────────────────────────────────────────────────

const k = (tx: number, tz: number) => `${tx},${tz}`

function fillRect(set: Set<string>, tx1: number, tz1: number, tx2: number, tz2: number) {
  for (let tz = tz1; tz <= tz2; tz++)
    for (let tx = tx1; tx <= tx2; tx++)
      set.add(k(tx, tz))
}

/** Classify every walkable tile into floor / wall / corner based on neighbors.
 *
 *  corridor_wall default faces +Z (south):
 *    !N → rotY = Math.PI   (wall faces north)
 *    !S → rotY = 0         (wall faces south)
 *    !E → rotY = Math.PI/2 (wall faces east)
 *    !W → rotY = -Math.PI/2
 *
 *  corridor_wallCorner default = SE corner (walls on +Z and +X):
 *    !S && !E → rotY = 0
 *    !S && !W → rotY = -Math.PI/2
 *    !N && !E → rotY = Math.PI/2
 *    !N && !W → rotY = Math.PI
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
      if (!N)      map.set(key, { type: 'wall', rotY: Math.PI })
      else if (!S) map.set(key, { type: 'wall', rotY: 0 })
      else if (!E) map.set(key, { type: 'wall', rotY: Math.PI / 2 })
      else         map.set(key, { type: 'wall', rotY: -Math.PI / 2 })
    } else if (blocked === 2 && !(!N && !S) && !(!E && !W)) {
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

/** Floor level in world-Y after room is built. Used for placing characters. */
export let FLOOR_LEVEL = 0

export async function buildSpaceStationRoom(scene: THREE.Scene): Promise<string[]> {
  LOADED_GLBS.length = 0

  const track = async (url: string) => {
    const m = await tryLoadGLB(url)
    if (m) LOADED_GLBS.push(url)
    return m
  }

  // ── Furniture atlas texture (variation-a.png) ────────────────────────────
  const varTex = texLoader.load('/assets/furniture/variation-a.png')
  varTex.colorSpace = THREE.SRGBColorSpace

  // ── Load spacekit structure assets ───────────────────────────────────────
  const [rawFloor, rawWall, rawCorner, rawCorridor, rawCorridorCorner] = await Promise.all([
    track('/assets/maps/spacekit/corridor_open.glb'),
    track('/assets/maps/spacekit/corridor_wall.glb'),
    track('/assets/maps/spacekit/corridor_wallCorner.glb'),
    track('/assets/maps/spacekit/corridor.glb'),
    track('/assets/maps/spacekit/corridor_corner.glb'),
  ])

  // ── Load spacekit decoration assets ─────────────────────────────────────
  const [rawGenerator, rawBarrel, rawDesk, rawDeskScreen, rawStairs, rawStructure] =
    await Promise.all([
      track('/assets/maps/spacekit/machine_generator.glb'),
      track('/assets/maps/spacekit/machine_barrel.glb'),
      track('/assets/maps/spacekit/desk_computer.glb'),
      track('/assets/maps/spacekit/desk_computerScreen.glb'),
      track('/assets/maps/spacekit/stairs.glb'),
      track('/assets/maps/spacekit/structure.glb'),
    ])

  // ── Load furniture (with variation-a.png texture) ────────────────────────
  const [arcadeM, pinballM, vendingM, clawM, danceM, gamblingM] = await Promise.all([
    track('/assets/furniture/arcade-machine.glb'),
    track('/assets/furniture/pinball.glb'),
    track('/assets/furniture/vending-machine.glb'),
    track('/assets/furniture/claw-machine.glb'),
    track('/assets/furniture/dance-machine.glb'),
    track('/assets/furniture/gambling-machine.glb'),
  ])

  // Apply variation-a.png to all furniture pieces
  for (const m of [arcadeM, pinballM, vendingM, clawM, danceM, gamblingM]) {
    if (m) applyTexture(m, varTex)
  }

  // ── Load station kit OBJ pieces ──────────────────────────────────────────
  const [stationFloor, stationWall, stationCorner, stationDoor] = await Promise.all([
    tryLoadOBJ('floor'),
    tryLoadOBJ('wall'),
    tryLoadOBJ('wall-corner'),
    tryLoadOBJ('door-single'),
  ])

  // ── Prepare spacekit templates with unified scale ────────────────────────
  const floorTpl  = rawFloor  ?? makeFallback(TILE * 0.98, 0.15, TILE * 0.98, 0x334455)
  const wallTpl   = rawWall   ?? makeFallback(TILE * 0.98, 2.2,  0.15,        0x445566)
  const cornerTpl = rawCorner ?? makeFallback(0.15, 2.2, 0.15, 0x556677)

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

  const floorBox = box3(floorTpl)
  FLOOR_LEVEL = floorBox.max.y

  console.log(
    `[RoomBuilder] scale=${tileScale.toFixed(3)},` +
    ` floorY=${floorY.toFixed(3)}, floorTop=${FLOOR_LEVEL.toFixed(3)}`,
  )

  // ── Define walkable tile map ─────────────────────────────────────────────
  //   +X = east, +Z = south. World pos of tile (tx,tz) = (tx*2, 0, tz*2).
  //
  //   Main room    : tx=0..11,  tz=0..11   (12×12)
  //   North room   : tx=3..8,   tz=-6..-3  (6×4)
  //   N corridor   : tx=5..6,   tz=-2..-1  (2×2)
  //   East room    : tx=13..17, tz=3..8    (5×6)
  //   E corridor   : tx=12,     tz=5..6    (1×2)
  //   West room    : tx=-6..-2, tz=3..8    (5×6)
  //   W corridor   : tx=-1,     tz=5..6    (1×2)
  //   S corridor   : tx=5..6,   tz=12..13  (2×2) → leads to station OBJ area

  const walkable = new Set<string>()
  fillRect(walkable,  0,  0, 11, 11) // main room 12×12
  fillRect(walkable,  3, -6,  8, -3) // north room 6×4
  fillRect(walkable,  5, -2,  6, -1) // north corridor
  fillRect(walkable, 13,  3, 17,  8) // east room 5×6
  fillRect(walkable, 12,  5, 12,  6) // east corridor
  fillRect(walkable, -6,  3, -2,  8) // west room 5×6
  fillRect(walkable, -1,  5, -1,  6) // west corridor
  fillRect(walkable,  5, 12,  6, 13) // south corridor → station module

  // ── Place spacekit tiles ─────────────────────────────────────────────────
  const tileMap = buildTileMap(walkable)

  for (const [key, entry] of tileMap) {
    const [txs, tzs] = key.split(',')
    const wx = +txs * TILE
    const wz = +tzs * TILE
    if (entry.type === 'floor')  placeClone(floorTpl,  scene, wx, floorY,  wz)
    if (entry.type === 'wall')   placeClone(wallTpl,   scene, wx, wallY,   wz, entry.rotY)
    if (entry.type === 'corner') placeClone(cornerTpl, scene, wx, cornerY, wz, entry.rotY)
  }

  // ── Place corridor arch pieces at connecting entrances ───────────────────
  if (rawCorridor) {
    fitToGrid(rawCorridor, TILE * 2)
    const corrY = bottomY(rawCorridor)
    placeClone(rawCorridor, scene, 5 * TILE, corrY,  0 * TILE, 0)      // N entrance inner
    placeClone(rawCorridor, scene, 5 * TILE, corrY, 12 * TILE, 0)      // S entrance inner
  }
  if (rawCorridorCorner) {
    fitToGrid(rawCorridorCorner, TILE * 2)
    const ccY = bottomY(rawCorridorCorner)
    placeClone(rawCorridorCorner, scene, 12 * TILE, ccY, 5 * TILE, -Math.PI / 2) // E entrance
    placeClone(rawCorridorCorner, scene, -1 * TILE, ccY, 5 * TILE,  Math.PI / 2) // W entrance
  }

  // ── Spacekit decorations (main room interior) ────────────────────────────
  const DECO = 1.6

  const placeDeco = (raw: THREE.Group | null, tx: number, tz: number, rotY = 0) => {
    if (!raw) return
    const clone = raw.clone(true)
    const y = fitToGrid(clone, DECO)
    clone.position.set(tx * TILE, y, tz * TILE)
    clone.rotation.y = rotY
    enableShadows(clone)
    scene.add(clone)
  }

  // Generators — corners of the main room interior
  placeDeco(rawGenerator,   2,  2)
  placeDeco(rawGenerator,   9,  2)
  placeDeco(rawGenerator,   2,  9)
  placeDeco(rawGenerator,   9,  9)

  // Barrels — scattered along walls
  placeDeco(rawBarrel,      1,  4)
  placeDeco(rawBarrel,     10,  4)
  placeDeco(rawBarrel,      1,  7)
  placeDeco(rawBarrel,     10,  7)

  // Computer desks — north section of main room
  placeDeco(rawDesk,        4,  2,  Math.PI)
  placeDeco(rawDesk,        7,  2,  Math.PI)
  placeDeco(rawDeskScreen,  5,  2,  Math.PI)
  placeDeco(rawDeskScreen,  6,  2,  Math.PI)

  // Stairs and structures — east/west of main room
  placeDeco(rawStairs,      1,  6, -Math.PI / 2)
  placeDeco(rawStairs,     10,  6,  Math.PI / 2)
  placeDeco(rawStructure,   5,  5)
  placeDeco(rawStructure,   6,  5,  Math.PI)

  // North room decorations
  placeDeco(rawDesk,        4, -5,  Math.PI)
  placeDeco(rawDesk,        7, -5,  Math.PI)
  placeDeco(rawGenerator,   5, -4)
  placeDeco(rawBarrel,      6, -3, -Math.PI / 2)

  // East room decorations
  placeDeco(rawGenerator,  14,  4)
  placeDeco(rawBarrel,     16,  7)
  placeDeco(rawStairs,     15,  5,  Math.PI / 2)

  // West room decorations
  placeDeco(rawGenerator,  -5,  4)
  placeDeco(rawBarrel,     -3,  7)
  placeDeco(rawStairs,     -4,  5, -Math.PI / 2)

  // ── Furniture (textured with variation-a.png) ─────────────────────────────
  const FURN = 1.7

  const putFurn = (raw: THREE.Group | null, tx: number, tz: number, rotY = 0) => {
    if (!raw) return
    const clone = raw.clone(true)
    const y = fitToGrid(clone, FURN)
    clone.position.set(tx * TILE, y, tz * TILE)
    clone.rotation.y = rotY
    enableShadows(clone)
    scene.add(clone)
  }

  // Main room furniture — along walls
  putFurn(arcadeM,    1,  1,  Math.PI)
  putFurn(arcadeM,   10,  1,  Math.PI)
  putFurn(pinballM,   1, 10,  0)
  putFurn(pinballM,  10, 10,  0)
  putFurn(vendingM,   0,  5,  Math.PI / 2)
  putFurn(vendingM,  11,  5, -Math.PI / 2)
  putFurn(clawM,      5, 10,  Math.PI)
  putFurn(clawM,      6, 10,  Math.PI)
  putFurn(danceM,     3,  1,  Math.PI)
  putFurn(danceM,     8,  1,  Math.PI)
  putFurn(gamblingM,  1,  3, -Math.PI / 2)
  putFurn(gamblingM, 10,  3,  Math.PI / 2)

  // North room furniture
  putFurn(arcadeM,    4, -4,  Math.PI / 2)
  putFurn(pinballM,   7, -4, -Math.PI / 2)
  putFurn(vendingM,   5, -6,  0)
  putFurn(gamblingM,  6, -6,  0)

  // East room furniture
  putFurn(arcadeM,   14,  3, -Math.PI / 2)
  putFurn(clawM,     16,  6,  Math.PI)
  putFurn(danceM,    15,  8,  Math.PI)
  putFurn(vendingM,  13,  5,  Math.PI / 2)

  // West room furniture
  putFurn(arcadeM,   -5,  3,  Math.PI / 2)
  putFurn(pinballM,  -3,  7,  Math.PI)
  putFurn(danceM,    -4,  8,  Math.PI)
  putFurn(vendingM,  -6,  5, -Math.PI / 2)

  // ── Station OBJ module (south, tiles 4..7 × 14..17) ──────────────────────
  //   4×4 floor area south of the south corridor, with walls on 3 sides
  //   and a door at the north entrance.

  if (stationFloor) {
    fitToGrid(stationFloor, TILE)
    const sfY = bottomY(stationFloor)
    for (let tz = 14; tz <= 17; tz++) {
      for (let tx = 4; tx <= 7; tx++) {
        placeClone(stationFloor, scene, tx * TILE, sfY, tz * TILE)
      }
    }
  }

  if (stationWall) {
    fitToGrid(stationWall, TILE)
    const swY = bottomY(stationWall)
    // South wall
    for (let tx = 4; tx <= 7; tx++)
      placeClone(stationWall, scene, tx * TILE, swY, 18 * TILE, 0)
    // West wall
    for (let tz = 14; tz <= 17; tz++)
      placeClone(stationWall, scene, 3 * TILE, swY, tz * TILE, Math.PI / 2)
    // East wall
    for (let tz = 14; tz <= 17; tz++)
      placeClone(stationWall, scene, 8 * TILE, swY, tz * TILE, -Math.PI / 2)
  }

  if (stationCorner) {
    fitToGrid(stationCorner, TILE)
    const scY = bottomY(stationCorner)
    placeClone(stationCorner, scene, 3 * TILE, scY, 18 * TILE,  Math.PI / 2)  // SW
    placeClone(stationCorner, scene, 8 * TILE, scY, 18 * TILE,  Math.PI)      // SE
    placeClone(stationCorner, scene, 3 * TILE, scY, 14 * TILE,  0)            // NW
    placeClone(stationCorner, scene, 8 * TILE, scY, 14 * TILE, -Math.PI / 2)  // NE
  }

  if (stationDoor) {
    fitToGrid(stationDoor, TILE)
    const sdY = bottomY(stationDoor)
    // Door at north side center, between south corridor and station room
    placeClone(stationDoor, scene, 5 * TILE, sdY, 14 * TILE, Math.PI)
  }

  console.log(`[RoomBuilder] ${LOADED_GLBS.length} GLBs loaded:`)
  LOADED_GLBS.forEach((u) => console.log(`  ✓ ${u}`))

  return [...LOADED_GLBS]
}
