import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const WP_W = 220
const WP_H = 155

export class WeaponView {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera

  private blaster: THREE.Group
  private bobAngle = 0

  private constructor(blaster: THREE.Group) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x080c14)

    this.camera = new THREE.PerspectiveCamera(42, WP_W / WP_H, 0.01, 10)
    this.camera.position.set(0, 0.05, 0.9)
    this.camera.lookAt(0, 0, 0)

    // Position blaster in the lower-right of the viewport
    blaster.position.set(0.18, -0.12, 0)
    blaster.rotation.set(0.08, -0.4, 0.05)
    blaster.traverse((n) => {
      if (n instanceof THREE.Mesh) n.castShadow = true
    })
    this.blaster = blaster
    this.scene.add(blaster)

    // Weapon scene lighting
    this.scene.add(new THREE.AmbientLight(0x334466, 0.8))
    const key = new THREE.PointLight(0x88bbff, 4, 5)
    key.position.set(-0.3, 0.5, 0.8)
    this.scene.add(key)
    const rim = new THREE.PointLight(0xff4422, 2, 3)
    rim.position.set(0.5, -0.2, -0.5)
    this.scene.add(rim)
  }

  static async load(): Promise<WeaponView> {
    const url = '/assets/weapons/blaster-a.glb'
    const manager = new THREE.LoadingManager()
    manager.setURLModifier((u) => {
      if (u.includes('Textures/colormap')) return '/assets/furniture/colormap.png'
      return u
    })
    const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
      new GLTFLoader(manager).load(url, res as never, undefined, rej),
    )
    console.log(`[WeaponView] ✓ ${url}`)
    gltf.scene.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        const oldMat = n.material as THREE.MeshStandardMaterial
        n.material = new THREE.MeshBasicMaterial({
          map: oldMat.map,
          transparent: oldMat.transparent,
          alphaTest: oldMat.alphaTest,
          side: THREE.DoubleSide,
        })
        n.material.needsUpdate = true
      }
    })
    return new WeaponView(gltf.scene)
  }

  update(dt: number) {
    // Gentle idle bob
    this.bobAngle += dt * 1.8
    this.blaster.position.y = -0.12 + Math.sin(this.bobAngle) * 0.004
    this.blaster.rotation.z = 0.05 + Math.sin(this.bobAngle * 0.7) * 0.008
  }
}
