import * as THREE from 'three';
import * as xb from 'xrblocks';

export class ForestScene extends xb.Script {
  init() {
    this._buildLighting();
    this._buildGround();
    this._buildTrees();
    this._buildFog();
  }

  _buildLighting() {
    // Luz ambiental cálida (cielo azul-verde, suelo marrón)
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a3728, 1.5);
    this.add(hemi);

    // Luz direccional cálida simulando sol rasante
    const sun = new THREE.DirectionalLight(0xffd580, 2.0);
    sun.position.set(-3, 5, -3);
    this.add(sun);
  }

  _buildGround() {
    const geometry = new THREE.PlaneGeometry(40, 40);
    const material = new THREE.MeshPhongMaterial({ color: 0x3d6b35 });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.add(ground);
  }

  _buildTrees() {
    // 20 árboles en posiciones aleatorias alrededor del usuario
    const rng = this._seededRng(42);
    for (let i = 0; i < 20; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 4 + rng() * 8; // entre 4m y 12m de distancia
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.7 + rng() * 0.6;
      this._spawnTree(x, 0, z, scale, rng);
    }
  }

  _spawnTree(x, y, z, scale = 1, rng = Math.random) {
    const tree = new THREE.Group();

    // Tronco
    const trunkGeo = new THREE.CylinderGeometry(
      0.08 * scale, 0.12 * scale, 1.2 * scale, 8
    );
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5c3a1e });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.6 * scale;
    tree.add(trunk);

    // Copa (esfera verde con variación de color)
    const greenVariant = new THREE.Color().setHSL(
      0.28 + (rng() - 0.5) * 0.05,
      0.6,
      0.25 + rng() * 0.1
    );
    const canopyGeo = new THREE.SphereGeometry(0.5 * scale, 8, 6);
    const canopyMat = new THREE.MeshPhongMaterial({ color: greenVariant });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 1.4 * scale;
    tree.add(canopy);

    tree.position.set(x, y, z);
    this.add(tree);
    return tree;
  }

  _buildFog() {
    if (xb.core?.scene) {
      xb.core.scene.fog = new THREE.FogExp2(0x1a2e1a, 0.06);
      xb.core.scene.background = new THREE.Color(0x1a2e1a);
    }
  }

  // Generador de números pseudoaleatorios con semilla (para árboles reproducibles)
  _seededRng(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
}
