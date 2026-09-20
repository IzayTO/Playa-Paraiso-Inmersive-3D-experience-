import * as THREE from "three";

/*
  Parte 6.1 · Biblioteca procedural ligera.

  No usa GLB ni texturas externas. Las piezas básicas comparten geometrías
  y materiales para mantener el editor rápido en iPhone y escritorio.
*/

function makeWedgeGeometry() {
  const vertices = new Float32Array([
    -0.5, 0.0, -0.5,
     0.5, 0.0, -0.5,
    -0.5, 1.0, -0.5,

    -0.5, 0.0,  0.5,
     0.5, 0.0,  0.5,
    -0.5, 1.0,  0.5,
  ]);

  const indices = [
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

const G = {
  unitBox: new THREE.BoxGeometry(1, 1, 1),
  trunk: new THREE.CylinderGeometry(0.16, 0.22, 1, 7),
  slimCylinder: new THREE.CylinderGeometry(0.055, 0.07, 1, 7),
  sphereLow: new THREE.IcosahedronGeometry(1, 1),
  sphereVeryLow: new THREE.IcosahedronGeometry(1, 0),
  sphereUnit: new THREE.SphereGeometry(0.5, 16, 10),
  cylinderUnit: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  coneUnit: new THREE.ConeGeometry(0.5, 1, 16),
  pyramidUnit: new THREE.ConeGeometry(0.72, 1, 4),
  frustumUnit: new THREE.CylinderGeometry(0.42, 0.72, 1, 4),
  wedgeUnit: makeWedgeGeometry(),
  leaf: new THREE.ConeGeometry(0.38, 1.7, 4),
  bowl: new THREE.CylinderGeometry(0.9, 1.05, 0.26, 16),
  fountainBase: new THREE.CylinderGeometry(1.25, 1.35, 0.28, 18),
  fountainStem: new THREE.CylinderGeometry(0.12, 0.15, 1, 8),
  fountainWaterLarge: new THREE.CylinderGeometry(1.02, 1.02, 0.035, 18),
  fountainWaterSmall: new THREE.CylinderGeometry(0.44, 0.44, 0.025, 16),
  lampTop: new THREE.SphereGeometry(0.13, 8, 6),
  knob: new THREE.SphereGeometry(0.045, 8, 6),
};

const M = {
  trunk: new THREE.MeshStandardMaterial({
    color: 0x8b6b4b,
    roughness: 0.95,
  }),

  trunkDark: new THREE.MeshStandardMaterial({
    color: 0x625444,
    roughness: 0.96,
  }),

  palmLeaf: new THREE.MeshStandardMaterial({
    color: 0x5d8a61,
    roughness: 0.92,
    side: THREE.DoubleSide,
  }),

  foliage: new THREE.MeshStandardMaterial({
    color: 0x6f9266,
    roughness: 0.96,
  }),

  foliageLight: new THREE.MeshStandardMaterial({
    color: 0x819f75,
    roughness: 0.96,
  }),

  shrub: new THREE.MeshStandardMaterial({
    color: 0x738d67,
    roughness: 0.98,
  }),

  metal: new THREE.MeshStandardMaterial({
    color: 0x575957,
    roughness: 0.72,
    metalness: 0.22,
  }),

  darkMetal: new THREE.MeshStandardMaterial({
    color: 0x414544,
    roughness: 0.66,
    metalness: 0.26,
  }),

  lamp: new THREE.MeshStandardMaterial({
    color: 0xf1dfad,
    emissive: 0x5c4d2b,
    emissiveIntensity: 0.22,
    roughness: 0.58,
  }),

  wallLamp: new THREE.MeshStandardMaterial({
    color: 0xf4e5bd,
    emissive: 0x6d552b,
    emissiveIntensity: 0.30,
    roughness: 0.55,
  }),

  stone: new THREE.MeshStandardMaterial({
    color: 0xb8b3aa,
    roughness: 0.93,
  }),

  concrete: new THREE.MeshStandardMaterial({
    color: 0xc2c0b9,
    roughness: 0.97,
  }),

  neutral: new THREE.MeshStandardMaterial({
    color: 0xbfc3c2,
    roughness: 0.90,
  }),

  neutralDark: new THREE.MeshStandardMaterial({
    color: 0x8f9492,
    roughness: 0.90,
  }),

  whiteTrim: new THREE.MeshStandardMaterial({
    color: 0xe5e4df,
    roughness: 0.88,
  }),

  door: new THREE.MeshStandardMaterial({
    color: 0x8a5c36,
    roughness: 0.82,
  }),

  glass: new THREE.MeshStandardMaterial({
    color: 0x91b7c4,
    roughness: 0.20,
    metalness: 0.03,
    transparent: true,
    opacity: 0.50,
  }),

  fountainWater: new THREE.MeshStandardMaterial({
    color: 0x87bbc4,
    roughness: 0.35,
    transparent: true,
    opacity: 0.82,
  }),

  bridgeDeck: new THREE.MeshStandardMaterial({
    color: 0xa58d72,
    roughness: 0.94,
  }),

  bridgeRail: new THREE.MeshStandardMaterial({
    color: 0x796856,
    roughness: 0.93,
  }),

  path: new THREE.MeshStandardMaterial({
    color: 0xc7beb1,
    roughness: 1,
  }),

  water: new THREE.MeshStandardMaterial({
    color: 0x8fc2ca,
    roughness: 0.28,
    transparent: true,
    opacity: 0.78,
  }),
};

export const PROP_CATALOG = Object.freeze({
  palm: {
    label: "Palmera",
    kind: "vegetation",
    scalePolicy: "uniform",
    defaultName: "Palmera",
  },
  tree: {
    label: "Árbol",
    kind: "vegetation",
    scalePolicy: "uniform",
    defaultName: "Árbol",
  },
  shrub: {
    label: "Arbusto",
    kind: "vegetation",
    scalePolicy: "uniform",
    defaultName: "Arbusto",
  },

  lamp: {
    label: "Poste",
    kind: "fixture",
    scalePolicy: "uniform",
    defaultName: "Poste",
  },
  fountain: {
    label: "Fuente",
    kind: "fixture",
    scalePolicy: "uniform",
    defaultName: "Fuente",
  },
  wallLamp: {
    label: "Lámpara muro",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Lámpara muro",
    allowY: true,
    defaultY: 2.2,
  },

  bridge: {
    label: "Puente",
    kind: "structure",
    scalePolicy: "free",
    defaultName: "Puente",
  },
  archedBridge: {
    label: "Puente arco",
    kind: "structure",
    scalePolicy: "free",
    defaultName: "Puente arco",
  },

  path: {
    label: "Camino",
    kind: "surface",
    scalePolicy: "free",
    defaultName: "Camino",
  },
  water: {
    label: "Agua",
    kind: "surface",
    scalePolicy: "free",
    defaultName: "Zona de agua",
  },

  boxShape: {
    label: "Bloque",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Bloque",
    allowY: true,
  },
  sphereShape: {
    label: "Esfera",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Esfera",
    allowY: true,
  },
  cylinderShape: {
    label: "Cilindro",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Cilindro",
    allowY: true,
  },
  coneShape: {
    label: "Cono",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Cono",
    allowY: true,
  },
  pyramidShape: {
    label: "Pirámide",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Pirámide",
    allowY: true,
  },
  frustumShape: {
    label: "Pirámide cortada",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Pirámide cortada",
    allowY: true,
  },
  wedgeShape: {
    label: "Triángulo 3D",
    kind: "geometry",
    scalePolicy: "free",
    defaultName: "Triángulo 3D",
    allowY: true,
  },

  window: {
    label: "Ventana",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Ventana",
    allowY: true,
    defaultY: 1.5,
  },
  door: {
    label: "Puerta",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Puerta",
    allowY: true,
  },
  column: {
    label: "Columna",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Columna",
  },
  pillar: {
    label: "Pilar",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Pilar",
  },
  railing: {
    label: "Barandal",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Barandal",
  },
  lowWall: {
    label: "Muro bajo",
    kind: "architecture",
    scalePolicy: "free",
    defaultName: "Muro bajo",
  },

  stairsStraight: {
    label: "Escalera recta",
    kind: "stairs",
    scalePolicy: "free",
    defaultName: "Escalera recta",
    parametric: "stairs",
  },
  stairsL: {
    label: "Escalera en L",
    kind: "stairs",
    scalePolicy: "free",
    defaultName: "Escalera en L",
    parametric: "stairs",
  },
  stairsU: {
    label: "Escalera en U",
    kind: "stairs",
    scalePolicy: "free",
    defaultName: "Escalera en U",
    parametric: "stairs",
  },
});

function mesh(geometry, material) {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = false;
  result.receiveShadow = false;
  return result;
}

function addBox(root, {
  x = 0,
  y = 0,
  z = 0,
  sx = 1,
  sy = 1,
  sz = 1,
  material = M.neutral,
} = {}) {
  const item = mesh(G.unitBox, material);
  item.scale.set(sx, sy, sz);
  item.position.set(x, y, z);
  root.add(item);
  return item;
}

function prepareRoot(type) {
  const info = PROP_CATALOG[type];
  const root = new THREE.Group();

  root.userData.editorType = "prop";
  root.userData.propType = type;
  root.userData.kind = info.kind;
  root.userData.scalePolicy = info.scalePolicy;
  root.userData.allowY = Boolean(info.allowY);
  root.userData.defaultY = Number(info.defaultY) || 0;
  root.userData.parametric = info.parametric || null;
  root.userData.defaultScale = 1;

  return root;
}

function tagEditorRoot(root) {
  root.traverse((object) => {
    object.userData.editorRoot = root;
  });
}

function updateBaseDimensions(root) {
  const savedPosition = root.position.clone();
  const savedScale = root.scale.clone();
  const savedQuaternion = root.quaternion.clone();

  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.quaternion.identity();
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  root.userData.baseDimensions = {
    x: Math.max(0.001, size.x),
    y: Math.max(0.001, size.y),
    z: Math.max(0.001, size.z),
  };

  root.position.copy(savedPosition);
  root.scale.copy(savedScale);
  root.quaternion.copy(savedQuaternion);
  root.updateMatrixWorld(true);
}

function centerChildrenXZ(root) {
  const savedPosition = root.position.clone();
  const savedScale = root.scale.clone();
  const savedQuaternion = root.quaternion.clone();

  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.quaternion.identity();
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());

  for (const child of root.children) {
    child.position.x -= center.x;
    child.position.z -= center.z;
  }

  root.position.copy(savedPosition);
  root.scale.copy(savedScale);
  root.quaternion.copy(savedQuaternion);
  root.updateMatrixWorld(true);
}

function clearParametricChildren(root) {
  for (const child of [...root.children]) {
    child.traverse((nested) => {
      if (
        nested.material &&
        nested.userData.editorMaterialLocal
      ) {
        const materials = Array.isArray(nested.material)
          ? nested.material
          : [nested.material];

        for (const material of materials) {
          material.dispose?.();
        }
      }
    });

    root.remove(child);
  }
}

function makePalm() {
  const root = prepareRoot("palm");

  const trunk = mesh(G.trunk, M.trunk);
  trunk.scale.set(1, 4.4, 1);
  trunk.position.y = 2.2;
  root.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 4.45;

  for (let i = 0; i < 6; i += 1) {
    const leaf = mesh(G.leaf, M.palmLeaf);

    leaf.scale.set(1, 1, 0.42);
    leaf.rotation.z = Math.PI / 2.5;
    leaf.rotation.y = (Math.PI * 2 * i) / 6;
    leaf.position.set(
      Math.cos(leaf.rotation.y) * 0.55,
      0.05,
      Math.sin(leaf.rotation.y) * 0.55
    );

    crown.add(leaf);
  }

  const center = mesh(G.sphereVeryLow, M.foliage);
  center.scale.setScalar(0.42);
  crown.add(center);

  root.add(crown);
  root.userData.baseHeight = 5.1;
  return root;
}

function makeTree() {
  const root = prepareRoot("tree");

  const trunk = mesh(G.trunk, M.trunkDark);
  trunk.scale.set(1.15, 2.6, 1.15);
  trunk.position.y = 1.3;
  root.add(trunk);

  const crownA = mesh(G.sphereLow, M.foliage);
  crownA.scale.set(1.25, 1.35, 1.18);
  crownA.position.set(-0.42, 3.05, 0);
  root.add(crownA);

  const crownB = mesh(G.sphereLow, M.foliageLight);
  crownB.scale.set(1.12, 1.22, 1.1);
  crownB.position.set(0.55, 3.18, 0.25);
  root.add(crownB);

  const crownC = mesh(G.sphereVeryLow, M.foliage);
  crownC.scale.set(1.05, 1.05, 1.05);
  crownC.position.set(0.08, 3.72, -0.22);
  root.add(crownC);

  root.userData.baseHeight = 4.8;
  return root;
}

function makeShrub() {
  const root = prepareRoot("shrub");

  const a = mesh(G.sphereLow, M.shrub);
  a.scale.set(0.82, 0.56, 0.74);
  a.position.set(-0.42, 0.52, 0);
  root.add(a);

  const b = mesh(G.sphereVeryLow, M.foliageLight);
  b.scale.set(0.72, 0.52, 0.68);
  b.position.set(0.42, 0.48, 0.14);
  root.add(b);

  const c = mesh(G.sphereVeryLow, M.shrub);
  c.scale.set(0.58, 0.45, 0.62);
  c.position.set(0, 0.68, -0.33);
  root.add(c);

  root.userData.baseHeight = 1.25;
  return root;
}

function makeLamp() {
  const root = prepareRoot("lamp");

  const pole = mesh(G.slimCylinder, M.metal);
  pole.scale.set(1, 3.4, 1);
  pole.position.y = 1.7;
  root.add(pole);

  const top = mesh(G.lampTop, M.lamp);
  top.position.y = 3.5;
  root.add(top);

  addBox(root, {
    y: 3.35,
    sx: 0.32,
    sy: 0.08,
    sz: 0.32,
    material: M.metal,
  });

  root.userData.baseHeight = 3.7;
  return root;
}

function makeWallLamp() {
  const root = prepareRoot("wallLamp");

  addBox(root, {
    z: 0,
    sx: 0.32,
    sy: 0.48,
    sz: 0.08,
    material: M.darkMetal,
  });

  addBox(root, {
    z: 0.16,
    sx: 0.08,
    sy: 0.08,
    sz: 0.28,
    material: M.darkMetal,
  });

  const glow = mesh(G.lampTop, M.wallLamp);
  glow.scale.set(1.25, 1.25, 1.25);
  glow.position.z = 0.34;
  root.add(glow);

  root.userData.baseDimensions = {
    x: 0.38,
    y: 0.52,
    z: 0.48,
  };

  return root;
}

function makeFountain() {
  const root = prepareRoot("fountain");

  const base = mesh(G.fountainBase, M.stone);
  base.position.y = 0.14;
  root.add(base);

  const water = mesh(G.fountainWaterLarge, M.fountainWater);
  water.position.y = 0.31;
  root.add(water);

  const stem = mesh(G.fountainStem, M.stone);
  stem.scale.set(1, 0.95, 1);
  stem.position.y = 0.77;
  root.add(stem);

  const bowl = mesh(G.bowl, M.stone);
  bowl.scale.set(0.52, 0.52, 0.52);
  bowl.position.y = 1.18;
  root.add(bowl);

  const topWater = mesh(G.fountainWaterSmall, M.fountainWater);
  topWater.position.y = 1.27;
  root.add(topWater);

  root.userData.baseHeight = 1.35;
  return root;
}

function makeBridge() {
  const root = prepareRoot("bridge");

  addBox(root, {
    y: 0.5,
    sx: 4.8,
    sy: 0.22,
    sz: 1.65,
    material: M.bridgeDeck,
  });

  addBox(root, {
    y: 1.0,
    z: -0.78,
    sx: 4.8,
    sy: 0.08,
    sz: 0.08,
    material: M.bridgeRail,
  });

  addBox(root, {
    y: 1.0,
    z: 0.78,
    sx: 4.8,
    sy: 0.08,
    sz: 0.08,
    material: M.bridgeRail,
  });

  for (const x of [-2.25, -0.75, 0.75, 2.25]) {
    for (const z of [-0.78, 0.78]) {
      addBox(root, {
        x,
        y: 0.82,
        z,
        sx: 0.08,
        sy: 0.78,
        sz: 0.08,
        material: M.bridgeRail,
      });
    }
  }

  root.userData.baseDimensions = {
    x: 4.8,
    y: 1.25,
    z: 1.65,
  };

  return root;
}

function makeArchedBridge() {
  const root = prepareRoot("archedBridge");

  const segments = 9;
  const totalLength = 6.4;
  const width = 1.75;
  const segmentLength = totalLength / segments;

  for (let i = 0; i < segments; i += 1) {
    const t = (i + 0.5) / segments;
    const normalized = t * 2 - 1;
    const x = -totalLength / 2 + segmentLength * (i + 0.5);
    const arch = 0.38 + 0.92 * (1 - normalized * normalized);
    const slope = -1.84 * normalized / totalLength;
    const angle = Math.atan(slope * totalLength * 0.62);

    const deck = addBox(root, {
      x,
      y: arch,
      sx: segmentLength * 1.06,
      sy: 0.20,
      sz: width,
      material: M.bridgeDeck,
    });
    deck.rotation.z = angle;

    for (const z of [-width * 0.46, width * 0.46]) {
      const rail = addBox(root, {
        x,
        y: arch + 0.58,
        z,
        sx: segmentLength * 1.06,
        sy: 0.07,
        sz: 0.07,
        material: M.bridgeRail,
      });
      rail.rotation.z = angle;
    }

    if (i % 2 === 0) {
      for (const z of [-width * 0.46, width * 0.46]) {
        addBox(root, {
          x,
          y: arch + 0.30,
          z,
          sx: 0.07,
          sy: 0.62,
          sz: 0.07,
          material: M.bridgeRail,
        });
      }
    }
  }

  addBox(root, {
    x: -totalLength / 2 + 0.2,
    y: 0.23,
    sx: 0.55,
    sy: 0.45,
    sz: width * 1.05,
    material: M.stone,
  });

  addBox(root, {
    x: totalLength / 2 - 0.2,
    y: 0.23,
    sx: 0.55,
    sy: 0.45,
    sz: width * 1.05,
    material: M.stone,
  });

  root.userData.baseDimensions = {
    x: totalLength,
    y: 1.95,
    z: width,
  };

  return root;
}

function makePath() {
  const root = prepareRoot("path");

  addBox(root, {
    y: 0.04,
    sx: 5.5,
    sy: 0.08,
    sz: 1.6,
    material: M.path,
  });

  root.userData.baseDimensions = {
    x: 5.5,
    y: 0.08,
    z: 1.6,
  };

  return root;
}

function makeWater() {
  const root = prepareRoot("water");

  addBox(root, {
    y: 0.03,
    sx: 5.5,
    sy: 0.06,
    sz: 4.0,
    material: M.water,
  });

  root.userData.baseDimensions = {
    x: 5.5,
    y: 0.06,
    z: 4.0,
  };

  return root;
}

function makePrimitive(type, geometry, material = M.neutral) {
  const root = prepareRoot(type);
  const item = mesh(geometry, material);

  if (type !== "wedgeShape") {
    item.position.y = 0.5;
  }

  root.add(item);
  root.userData.baseDimensions = {
    x: 1,
    y: 1,
    z: 1,
  };

  return root;
}

function makeBoxShape() {
  return makePrimitive("boxShape", G.unitBox, M.neutral);
}

function makeSphereShape() {
  return makePrimitive("sphereShape", G.sphereUnit, M.neutral);
}

function makeCylinderShape() {
  return makePrimitive("cylinderShape", G.cylinderUnit, M.neutralDark);
}

function makeConeShape() {
  return makePrimitive("coneShape", G.coneUnit, M.neutralDark);
}

function makePyramidShape() {
  return makePrimitive("pyramidShape", G.pyramidUnit, M.concrete);
}

function makeFrustumShape() {
  return makePrimitive("frustumShape", G.frustumUnit, M.concrete);
}

function makeWedgeShape() {
  return makePrimitive("wedgeShape", G.wedgeUnit, M.concrete);
}

function makeWindow() {
  const root = prepareRoot("window");

  addBox(root, {
    sx: 1.60,
    sy: 0.10,
    sz: 0.12,
    y: 0.60,
    material: M.whiteTrim,
  });

  addBox(root, {
    sx: 1.60,
    sy: 0.10,
    sz: 0.12,
    y: -0.60,
    material: M.whiteTrim,
  });

  addBox(root, {
    sx: 0.10,
    sy: 1.30,
    sz: 0.12,
    x: -0.75,
    material: M.whiteTrim,
  });

  addBox(root, {
    sx: 0.10,
    sy: 1.30,
    sz: 0.12,
    x: 0.75,
    material: M.whiteTrim,
  });

  addBox(root, {
    sx: 0.08,
    sy: 1.20,
    sz: 0.11,
    material: M.whiteTrim,
  });

  addBox(root, {
    sx: 1.40,
    sy: 1.10,
    sz: 0.06,
    z: 0.02,
    material: M.glass,
  });

  root.userData.baseDimensions = {
    x: 1.60,
    y: 1.30,
    z: 0.12,
  };

  return root;
}

function makeDoor() {
  const root = prepareRoot("door");

  addBox(root, {
    y: 1.05,
    sx: 0.95,
    sy: 2.10,
    sz: 0.12,
    material: M.door,
  });

  const knob = mesh(G.knob, M.metal);
  knob.position.set(0.32, 1.02, 0.09);
  root.add(knob);

  root.userData.baseDimensions = {
    x: 0.95,
    y: 2.10,
    z: 0.18,
  };

  return root;
}

function makeColumn() {
  const root = prepareRoot("column");

  const column = mesh(G.cylinderUnit, M.concrete);
  column.scale.set(0.58, 3.0, 0.58);
  column.position.y = 1.5;
  root.add(column);

  addBox(root, {
    y: 0.10,
    sx: 0.82,
    sy: 0.20,
    sz: 0.82,
    material: M.stone,
  });

  addBox(root, {
    y: 2.90,
    sx: 0.78,
    sy: 0.20,
    sz: 0.78,
    material: M.stone,
  });

  root.userData.baseDimensions = {
    x: 0.82,
    y: 3.0,
    z: 0.82,
  };

  return root;
}

function makePillar() {
  const root = prepareRoot("pillar");

  addBox(root, {
    y: 1.5,
    sx: 0.68,
    sy: 3.0,
    sz: 0.68,
    material: M.concrete,
  });

  root.userData.baseDimensions = {
    x: 0.68,
    y: 3.0,
    z: 0.68,
  };

  return root;
}

function makeRailing() {
  const root = prepareRoot("railing");
  const length = 3.2;

  addBox(root, {
    y: 1.02,
    sx: length,
    sy: 0.08,
    sz: 0.08,
    material: M.darkMetal,
  });

  addBox(root, {
    y: 0.58,
    sx: length,
    sy: 0.05,
    sz: 0.05,
    material: M.darkMetal,
  });

  for (const x of [-1.55, -0.78, 0, 0.78, 1.55]) {
    addBox(root, {
      x,
      y: 0.52,
      sx: 0.06,
      sy: 1.0,
      sz: 0.06,
      material: M.darkMetal,
    });
  }

  root.userData.baseDimensions = {
    x: length,
    y: 1.08,
    z: 0.10,
  };

  return root;
}

function makeLowWall() {
  const root = prepareRoot("lowWall");

  addBox(root, {
    y: 0.42,
    sx: 3.0,
    sy: 0.84,
    sz: 0.24,
    material: M.concrete,
  });

  addBox(root, {
    y: 0.88,
    sx: 3.08,
    sy: 0.08,
    sz: 0.30,
    material: M.stone,
  });

  root.userData.baseDimensions = {
    x: 3.08,
    y: 0.92,
    z: 0.30,
  };

  return root;
}

function addSolidStep(root, {
  x,
  z,
  widthX,
  widthZ,
  height,
}) {
  addBox(root, {
    x,
    y: height * 0.5,
    z,
    sx: widthX,
    sy: height,
    sz: widthZ,
    material: M.stone,
  });
}

function buildStraightStairs(root, steps) {
  const rise = 0.18;
  const tread = 0.29;
  const width = 1.45;
  const length = steps * tread;

  for (let i = 0; i < steps; i += 1) {
    addSolidStep(root, {
      x: -length / 2 + tread * (i + 0.5),
      z: 0,
      widthX: tread * 1.02,
      widthZ: width,
      height: rise * (i + 1),
    });
  }
}

function buildLStairs(root, steps) {
  const rise = 0.18;
  const tread = 0.29;
  const width = 1.35;
  const first = Math.max(2, Math.ceil(steps / 2));
  const second = Math.max(2, steps - first);

  for (let i = 0; i < first; i += 1) {
    addSolidStep(root, {
      x: tread * (i + 0.5),
      z: 0,
      widthX: tread * 1.02,
      widthZ: width,
      height: rise * (i + 1),
    });
  }

  const cornerX = first * tread;

  addBox(root, {
    x: cornerX + width * 0.5,
    y: rise * first - 0.08,
    z: width * 0.5,
    sx: width,
    sy: 0.18,
    sz: width,
    material: M.stone,
  });

  for (let j = 0; j < second; j += 1) {
    const height = rise * (first + j + 1);

    addSolidStep(root, {
      x: cornerX + width * 0.5,
      z: width + tread * (j + 0.5),
      widthX: width,
      widthZ: tread * 1.02,
      height,
    });
  }

  centerChildrenXZ(root);
}

function buildUStairs(root, steps) {
  const rise = 0.18;
  const tread = 0.29;
  const width = 1.25;
  const gap = 0.32;
  const first = Math.max(2, Math.ceil(steps / 2));
  const second = Math.max(2, steps - first);
  const length = Math.max(first, second) * tread;

  for (let i = 0; i < first; i += 1) {
    addSolidStep(root, {
      x: -length / 2 + tread * (i + 0.5),
      z: -(width + gap) * 0.5,
      widthX: tread * 1.02,
      widthZ: width,
      height: rise * (i + 1),
    });
  }

  addBox(root, {
    x: length / 2 + width * 0.45,
    y: rise * first - 0.08,
    z: 0,
    sx: width * 0.90,
    sy: 0.18,
    sz: width * 2 + gap,
    material: M.stone,
  });

  for (let j = 0; j < second; j += 1) {
    addSolidStep(root, {
      x: length / 2 - tread * (j + 0.5),
      z: (width + gap) * 0.5,
      widthX: tread * 1.02,
      widthZ: width,
      height: rise * (first + j + 1),
    });
  }

  centerChildrenXZ(root);
}

function makeParametricStairs(type) {
  const root = prepareRoot(type);
  root.userData.params = { steps: 10 };
  updateParametricProp(root, root.userData.params);
  return root;
}

function makeStairsStraight() {
  return makeParametricStairs("stairsStraight");
}

function makeStairsL() {
  return makeParametricStairs("stairsL");
}

function makeStairsU() {
  return makeParametricStairs("stairsU");
}

const FACTORIES = {
  palm: makePalm,
  tree: makeTree,
  shrub: makeShrub,
  lamp: makeLamp,
  fountain: makeFountain,
  wallLamp: makeWallLamp,
  bridge: makeBridge,
  archedBridge: makeArchedBridge,
  path: makePath,
  water: makeWater,

  boxShape: makeBoxShape,
  sphereShape: makeSphereShape,
  cylinderShape: makeCylinderShape,
  coneShape: makeConeShape,
  pyramidShape: makePyramidShape,
  frustumShape: makeFrustumShape,
  wedgeShape: makeWedgeShape,

  window: makeWindow,
  door: makeDoor,
  column: makeColumn,
  pillar: makePillar,
  railing: makeRailing,
  lowWall: makeLowWall,

  stairsStraight: makeStairsStraight,
  stairsL: makeStairsL,
  stairsU: makeStairsU,
};

export function updateParametricProp(root, params = {}) {
  if (!root || root.userData.parametric !== "stairs") {
    return false;
  }

  const steps = THREE.MathUtils.clamp(
    Math.round(Number(params.steps) || 10),
    3,
    30
  );

  clearParametricChildren(root);

  if (root.userData.propType === "stairsStraight") {
    buildStraightStairs(root, steps);
  }

  if (root.userData.propType === "stairsL") {
    buildLStairs(root, steps);
  }

  if (root.userData.propType === "stairsU") {
    buildUStairs(root, steps);
  }

  root.userData.params = { steps };

  updateBaseDimensions(root);
  tagEditorRoot(root);

  return true;
}

export function createProp(type) {
  const factory = FACTORIES[type];

  if (!factory) {
    throw new Error(`Tipo de prop desconocido: ${type}`);
  }

  const root = factory();
  const info = PROP_CATALOG[type];

  root.name = info.defaultName;

  if (!root.userData.baseDimensions && info.scalePolicy === "free") {
    updateBaseDimensions(root);
  }

  tagEditorRoot(root);
  return root;
}

export function disposePropLibrary() {
  const geometries = new Set(Object.values(G));
  const materials = new Set(Object.values(M));

  for (const geometry of geometries) {
    geometry.dispose?.();
  }

  for (const material of materials) {
    material.dispose?.();
  }
}

