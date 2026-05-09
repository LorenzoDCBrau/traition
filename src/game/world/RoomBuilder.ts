import * as THREE from 'three'

export function buildTestRoom(scene: THREE.Scene) {
  const floorGeo = new THREE.PlaneGeometry(20, 20)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x222222 })
  const wallConfigs = [
    { pos: [0, 2.5, -10] as [number, number, number], rot: [0, 0, 0] as [number, number, number] },
    { pos: [0, 2.5, 10] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number] },
    { pos: [-10, 2.5, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number] },
    { pos: [10, 2.5, 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number] },
  ]
  for (const { pos, rot } of wallConfigs) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), wallMat)
    wall.position.set(...pos)
    wall.rotation.set(...rot)
    wall.receiveShadow = true
    scene.add(wall)
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.3)
  scene.add(ambient)

  const spot = new THREE.SpotLight(0xffffff, 2)
  spot.position.set(0, 8, 0)
  spot.castShadow = true
  scene.add(spot)
}
