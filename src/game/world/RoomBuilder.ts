import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// All spacekit pieces share the same grid size
const TILE = 2 // world units per grid cell

// Centers the 12×12 main room at world origin: tile 0→-11, tile 11→11, outer edges ±12
const WORLD_OFFSET = -11

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

/** Replace every mesh material with a new MeshStandardMaterial using the given texture. */
function applyTexture(model: THREE.Group, tex: THREE.Texture) {
  model.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.0 })
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
      map.set(key, { type: 'floor' })
    }
  }
  return map
}

// ─── Public surface ───────────────────────────────────────────────────────────

export const LOADED_GLBS: string[] = []

/** Floor level in world-Y. Flat plane at y=0. */
export let FLOOR_LEVEL = 0

export async function buildSpaceStationRoom(scene: THREE.Scene): Promise<string[]> {
  LOADED_GLBS.length = 0

  const track = async (url: string) => {
    const m = await tryLoadGLB(url)
    if (m) LOADED_GLBS.push(url)
    return m
  }

  // ── Furniture atlas texture ──────────────────────────────────────────────
  const varTex = texLoader.load('/assets/furniture/variation-a.png')
  varTex.colorSpace = THREE.SRGBColorSpace

  // ── Load spacekit structure assets ───────────────────────────────────────
  // rawFloor used only for unified scale computation (not tiled — has holes)
  const [rawFloor, rawWall, rawCorner] = await Promise.all([
    track('/assets/maps/spacekit/corridor_open.glb'),
    track('/assets/maps/spacekit/corridor_wall.glb'),
    track('/assets/maps/spacekit/corridor_wallCorner.glb'),
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

  // ── Load furniture ───────────────────────────────────────────────────────
  const [arcadeM, pinballM, vendingM, clawM, danceM, gamblingM] = await Promise.all([
    track('/assets/furniture/arcade-machine.glb'),
    track('/assets/furniture/pinball.glb'),
    track('/assets/furniture/vending-machine.glb'),
    track('/assets/furniture/claw-machine.glb'),
    track('/assets/furniture/dance-machine.glb'),
    track('/assets/furniture/gambling-machine.glb'),
  ])

  for (const m of [arcadeM, pinballM, vendingM, clawM, danceM, gamblingM]) {
    if (m) applyTexture(m, varTex)
  }

  // ── Compute unified scale from floor tile (same family as walls/corners) ─
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

  const wallY   = bottomY(wallTpl)
  const cornerY = bottomY(cornerTpl)

  FLOOR_LEVEL = 0 // flat PlaneGeometry floor sits at y=0

  console.log(
    `[RoomBuilder] scale=${tileScale.toFixed(3)},` +
    ` wallY=${wallY.toFixed(3)}, FLOOR_LEVEL=${FLOOR_LEVEL}`,
  )

  // ── Solid floor plane — replaces corridor_open.glb tiles ─────────────────
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.8, metalness: 0.1 }),
  )
  floorMesh.rotation.x = -Math.PI / 2
  floorMesh.receiveShadow = true
  scene.add(floorMesh)

  const grid = new THREE.GridHelper(24, 12, 0x2a3050, 0x2a3050)
  grid.position.y = 0.01 // avoid z-fighting
  scene.add(grid)

  // ── Main room only: 12×12 (tiles 0..11, 0..11) ───────────────────────────
  //   Centered at origin via WORLD_OFFSET = -11:
  //   tile 0 → world -11, tile 11 → world 11, outer wall edges ±12
  const walkable = new Set<string>()
  fillRect(walkable, 0, 0, 11, 11)

  const tileMap = buildTileMap(walkable)

  for (const [key, entry] of tileMap) {
    const [txs, tzs] = key.split(',')
    const wx = +txs * TILE + WORLD_OFFSET
    const wz = +tzs * TILE + WORLD_OFFSET
    if (entry.type === 'wall')   placeClone(wallTpl,   scene, wx, wallY,   wz, entry.rotY)
    if (entry.type === 'corner') placeClone(cornerTpl, scene, wx, cornerY, wz, entry.rotY)
  }

  // ── Decorations (tile coords 0..11 → world via WORLD_OFFSET) ────────────
  const DECO = 1.6

  const placeDeco = (raw: THREE.Group | null, tx: number, tz: number, rotY = 0) => {
    if (!raw) return
    const clone = raw.clone(true)
    const y = fitToGrid(clone, DECO)
    clone.position.set(tx * TILE + WORLD_OFFSET, y, tz * TILE + WORLD_OFFSET)
    clone.rotation.y = rotY
    enableShadows(clone)
    scene.add(clone)
  }

  // Generators — corners of the main room interior
  placeDeco(rawGenerator, 2, 2)
  placeDeco(rawGenerator, 9, 2)
  placeDeco(rawGenerator, 2, 9)
  placeDeco(rawGenerator, 9, 9)

  // Barrels — scattered along walls
  placeDeco(rawBarrel, 1, 4)
  placeDeco(rawBarrel, 10, 4)
  placeDeco(rawBarrel, 1, 7)
  placeDeco(rawBarrel, 10, 7)

  // Computer desks — north section
  placeDeco(rawDesk,       4, 2, Math.PI)
  placeDeco(rawDesk,       7, 2, Math.PI)
  placeDeco(rawDeskScreen, 5, 2, Math.PI)
  placeDeco(rawDeskScreen, 6, 2, Math.PI)

  // Stairs and structures
  placeDeco(rawStairs,    1, 6, -Math.PI / 2)
  placeDeco(rawStairs,   10, 6,  Math.PI / 2)
  placeDeco(rawStructure, 5, 5)
  placeDeco(rawStructure, 6, 5, Math.PI)

  // ── Furniture ────────────────────────────────────────────────────────────
  const FURN = 2.5

  const putFurn = (raw: THREE.Group | null, tx: number, tz: number, rotY = 0) => {
    if (!raw) return
    const clone = raw.clone(true)
    const y = fitToGrid(clone, FURN)
    clone.position.set(tx * TILE + WORLD_OFFSET, y, tz * TILE + WORLD_OFFSET)
    clone.rotation.y = rotY
    enableShadows(clone)
    scene.add(clone)
  }

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

  console.log(`[RoomBuilder] ${LOADED_GLBS.length} GLBs loaded:`)
  LOADED_GLBS.forEach((u) => console.log(`  ✓ ${u}`))

  return [...LOADED_GLBS]
}
