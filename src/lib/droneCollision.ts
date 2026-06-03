import { EditorObject3D } from '@/types/editor';
import { DroneAssignment } from '@/types/drone';
import { anchorWorldPosition } from './anchorGeometry';

export type Vec3 = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Find the resolved time of an assignment: explicit `time` or fall back to the shape's `shapeTime`. */
const assignmentTime = (a: DroneAssignment, shapes: EditorObject3D[]): number => {
  const shape = shapes.find(s => s.id === a.shapeId);
  return a.time ?? shape?.shapeTime ?? 0;
};

const anchorWorld = (shape: EditorObject3D, anchorId: string): Vec3 | null => {
  const anchor = shape.anchors?.find(a => a.id === anchorId);
  if (!anchor) return null;
  return anchorWorldPosition(shape, anchor);
};

/**
 * Compute drone target positions at a given time.
 * For each drone, sort assignments by time and interpolate between the surrounding anchors.
 * Then apply a simple pairwise repulsion pass to avoid collisions.
 */
export const computeDronePositions = (
  drones: EditorObject3D[],
  shapes: EditorObject3D[],
  assignments: DroneAssignment[],
  currentTime: number,
  safeRadius = 0.4,
): Map<string, Vec3> => {
  const positions = new Map<string, Vec3>();

  drones.forEach(drone => {
    const droneAssignments = assignments
      .filter(a => a.droneId === drone.id)
      .map(a => ({ a, t: assignmentTime(a, shapes) }))
      .sort((x, y) => x.t - y.t);

    // Default position: editor placement (Z-up -> Three Y-up)
    const defaultPos: Vec3 = [
      drone.properties.x / 100,
      drone.properties.z / 100,
      -drone.properties.y / 100,
    ];

    if (droneAssignments.length === 0) {
      positions.set(drone.id, defaultPos);
      return;
    }

    // Before first assignment: hold at first anchor
    if (currentTime <= droneAssignments[0].t) {
      const first = anchorWorld(
        shapes.find(s => s.id === droneAssignments[0].a.shapeId)!,
        droneAssignments[0].a.anchorId,
      );
      positions.set(drone.id, first ?? defaultPos);
      return;
    }

    // After last assignment: hold at last anchor
    const last = droneAssignments[droneAssignments.length - 1];
    if (currentTime >= last.t) {
      const lastPos = anchorWorld(
        shapes.find(s => s.id === last.a.shapeId)!,
        last.a.anchorId,
      );
      positions.set(drone.id, lastPos ?? defaultPos);
      return;
    }

    // Find surrounding assignments
    for (let i = 0; i < droneAssignments.length - 1; i++) {
      const cur = droneAssignments[i];
      const next = droneAssignments[i + 1];
      if (currentTime >= cur.t && currentTime <= next.t) {
        const a = anchorWorld(shapes.find(s => s.id === cur.a.shapeId)!, cur.a.anchorId);
        const b = anchorWorld(shapes.find(s => s.id === next.a.shapeId)!, next.a.anchorId);
        if (!a || !b) { positions.set(drone.id, defaultPos); return; }
        const span = Math.max(1, next.t - cur.t);
        const t = easeInOut((currentTime - cur.t) / span);
        positions.set(drone.id, [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
        return;
      }
    }
    positions.set(drone.id, defaultPos);
  });

  // Collision avoidance: simple pairwise repulsion (2 iterations)
  for (let iter = 0; iter < 2; iter++) {
    const ids = Array.from(positions.keys());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pa = positions.get(ids[i])!;
        const pb = positions.get(ids[j])!;
        const dx = pa[0] - pb[0];
        const dy = pa[1] - pb[1];
        const dz = pa[2] - pb[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0 && d < safeRadius) {
          const push = (safeRadius - d) / 2;
          const nx = dx / d, ny = dy / d, nz = dz / d;
          positions.set(ids[i], [pa[0] + nx * push, pa[1] + ny * push, pa[2] + nz * push]);
          positions.set(ids[j], [pb[0] - nx * push, pb[1] - ny * push, pb[2] - nz * push]);
        }
      }
    }
  }

  return positions;
};

/** Build a list of trajectory polylines (one per drone) for visualization. */
export const computeDroneTrajectories = (
  drones: EditorObject3D[],
  shapes: EditorObject3D[],
  assignments: DroneAssignment[],
): { droneId: string; color: string; points: Vec3[] }[] => {
  return drones.map(drone => {
    const points = assignments
      .filter(a => a.droneId === drone.id)
      .map(a => ({ a, t: assignmentTime(a, shapes) }))
      .sort((x, y) => x.t - y.t)
      .map(({ a }) => {
        const shape = shapes.find(s => s.id === a.shapeId);
        if (!shape) return null;
        return anchorWorld(shape, a.anchorId);
      })
      .filter((p): p is Vec3 => !!p);
    return { droneId: drone.id, color: drone.properties.color || '#88ccff', points };
  });
};