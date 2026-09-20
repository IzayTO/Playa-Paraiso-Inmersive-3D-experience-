// Geometry adapter from the user's Wizard Map Design v7 export.
import * as THREE from "three";

const EPS = 1e-6;
const MAX_CONNECTIONS = 5000;

export function isPathObject(object) {
  return object?.userData?.propType === "path";
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function pairKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function baseDimensions(object) {
  const base = object?.userData?.baseDimensions || {};
  return {
    x: Math.max(EPS, finite(base.x, 5.5)),
    y: Math.max(EPS, finite(base.y, 0.08)),
    z: Math.max(EPS, finite(base.z, 1.6)),
  };
}

function worldPoint(object, x, y, z) {
  return object.localToWorld(new THREE.Vector3(x, y, z));
}

function endpointDescriptor(object, sign) {
  const base = baseDimensions(object);
  object.updateWorldMatrix(true, true);

  const scaleX = Math.max(EPS, Math.abs(finite(object.scale.x, 1)));
  const overlapWorld = Math.min(0.24, Math.max(0.10, base.z * Math.abs(finite(object.scale.z, 1)) * 0.10));
  const overlapLocal = Math.min(base.x * 0.20, overlapWorld / scaleX);

  const endX = sign * base.x * 0.5;
  const insideX = sign * Math.max(0, base.x * 0.5 - overlapLocal);
  const halfZ = base.z * 0.5;

  const center = worldPoint(object, endX, base.y, 0);
  const topA = worldPoint(object, insideX, base.y, -halfZ);
  const topB = worldPoint(object, insideX, base.y, halfZ);
  const bottomA = worldPoint(object, insideX, 0, -halfZ);
  const bottomB = worldPoint(object, insideX, 0, halfZ);

  return {
    object,
    sign,
    center,
    top: [topA, topB],
    bottom: [bottomA, bottomB],
    widthWorld: topA.distanceTo(topB),
    heightWorld: Math.max(
      0.02,
      (topA.distanceTo(bottomA) + topB.distanceTo(bottomB)) * 0.5
    ),
  };
}

function nearestEndpointPair(a, b) {
  const aEnds = [endpointDescriptor(a, -1), endpointDescriptor(a, 1)];
  const bEnds = [endpointDescriptor(b, -1), endpointDescriptor(b, 1)];
  let best = null;

  for (const ea of aEnds) {
    for (const eb of bEnds) {
      const horizontal = Math.hypot(
        ea.center.x - eb.center.x,
        ea.center.z - eb.center.z
      );
      const vertical = Math.abs(ea.center.y - eb.center.y);
      const score = horizontal + vertical * 3;

      if (!best || score < best.score) {
        best = { a: ea, b: eb, score, horizontal, vertical };
      }
    }
  }

  return best;
}

function convexHullXZ(points) {
  const unique = [];
  const seen = new Set();

  for (const point of points) {
    const key = `${point.x.toFixed(5)}:${point.z.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ x: point.x, z: point.z });
  }

  if (unique.length < 3) return [];

  unique.sort((p, q) => p.x === q.x ? p.z - q.z : p.x - q.x);

  const cross = (o, a, b) =>
    (a.x - o.x) * (b.z - o.z) -
    (a.z - o.z) * (b.x - o.x);

  const lower = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= EPS) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= EPS) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function polygonAreaXZ(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area) * 0.5;
}

function sourcePathMaterial(object) {
  let source = null;

  object?.traverse?.((child) => {
    if (source || !child?.isMesh || child.userData?.isOutlinePart) return;
    const candidate = Array.isArray(child.material)
      ? child.material.find(Boolean)
      : child.material;
    if (candidate) source = candidate;
  });

  let material;
  if (source?.clone) {
    material = source.clone();
  } else {
    material = new THREE.MeshStandardMaterial({
      color: 0xc7beb1,
      roughness: 1,
    });
  }

  material.transparent = Boolean(material.transparent || material.opacity < 0.999);
  material.depthTest = true;
  material.depthWrite = material.opacity >= 0.999;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
  return material;
}

export function buildBridgeMesh(a, b) {
  const nearest = nearestEndpointPair(a, b);
  if (!nearest) {
    return { ok: false, message: "No se pudieron localizar los extremos de los caminos." };
  }

  const maxGap = Math.max(
    2.4,
    (nearest.a.widthWorld + nearest.b.widthWorld) * 1.35
  );

  if (nearest.horizontal > maxGap) {
    return {
      ok: false,
      message: "Los extremos están demasiado lejos. Acércalos antes de unirlos.",
    };
  }

  const maxVertical = Math.max(0.22, nearest.a.heightWorld + nearest.b.heightWorld);
  if (nearest.vertical > maxVertical) {
    return {
      ok: false,
      message: "Los caminos están a alturas distintas. Alinéalos en Y antes de unirlos.",
    };
  }

  const hull = convexHullXZ([
    ...nearest.a.top,
    ...nearest.b.top,
  ]);

  if (hull.length < 3 || polygonAreaXZ(hull) < 0.002) {
    return {
      ok: false,
      message: "Los caminos ya están prácticamente unidos o la unión sería demasiado pequeña.",
    };
  }

  const allTopY = [...nearest.a.top, ...nearest.b.top].map((p) => p.y);
  const allBottomY = [...nearest.a.bottom, ...nearest.b.bottom].map((p) => p.y);

  // A tiny lift hides coplanar seams/z-fighting without becoming visible as a step.
  const topY = Math.max(...allTopY) + 0.0035;
  const bottomY = Math.min(...allBottomY);
  const n = hull.length;
  const positions = [];
  const indices = [];

  for (const p of hull) positions.push(p.x, topY, p.z);
  for (const p of hull) positions.push(p.x, bottomY, p.z);

  // Hull is CCW in X/Z. Reverse top winding so normal points +Y.
  for (let i = 1; i < n - 1; i += 1) {
    indices.push(0, i + 1, i);
  }

  // Bottom.
  for (let i = 1; i < n - 1; i += 1) {
    indices.push(n, n + i, n + i + 1);
  }

  // Walls.
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    indices.push(i, j, n + j);
    indices.push(i, n + j, n + i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = sourcePathMaterial(a);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "RMB_PATH_CONNECTION_PATCH";
  mesh.renderOrder = 40;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  mesh.userData.isPathConnectionPatch = true;

  return {
    ok: true,
    mesh,
    message: "Unión creada. Los dos caminos se conservan y la pieza central cubre el hueco o el solape.",
  };
}


