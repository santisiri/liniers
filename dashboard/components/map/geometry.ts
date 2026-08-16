/** Geometría del mapa: layout circular y curvas cuadráticas con flechas. */

export interface Pt {
  x: number;
  y: number;
}

export const VIEW = { w: 920, h: 640 } as const;
export const CENTER: Pt = { x: VIEW.w / 2, y: VIEW.h / 2 };
export const RING_R = 240;

export function sub(p: Pt, q: Pt): Pt {
  return { x: p.x - q.x, y: p.y - q.y };
}

export function add(p: Pt, q: Pt): Pt {
  return { x: p.x + q.x, y: p.y + q.y };
}

export function scale(p: Pt, k: number): Pt {
  return { x: p.x * k, y: p.y * k };
}

export function len(p: Pt): number {
  return Math.hypot(p.x, p.y);
}

export function norm(p: Pt): Pt {
  const l = len(p);
  return l < 1e-6 ? { x: 0, y: 0 } : { x: p.x / l, y: p.y / l };
}

export function perp(p: Pt): Pt {
  return { x: -p.y, y: p.x };
}

/** Posición del nodo i-ésimo de n en el anillo, empezando arriba. */
export function ringPos(index: number, count: number): Pt {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(count, 1);
  return {
    x: CENTER.x + RING_R * Math.cos(angle),
    y: CENTER.y + RING_R * Math.sin(angle)
  };
}

export interface CurveSpec {
  /** Path SVG (M … Q …). */
  d: string;
  /** Triángulo de flecha en el extremo b (si se pidió). */
  arrowB: string | null;
  /** Triángulo de flecha en el extremo a (si se pidió). */
  arrowA: string | null;
  /** Punto medio de la curva (para hit/labels si hiciera falta). */
  mid: Pt;
}

function arrowAt(tip: Pt, from: Pt, size: number): string {
  const u = norm(sub(tip, from));
  const p = perp(u);
  const base = sub(tip, scale(u, size));
  const l = add(base, scale(p, size * 0.45));
  const r = sub(base, scale(p, size * 0.45));
  return `${tip.x},${tip.y} ${l.x},${l.y} ${r.x},${r.y}`;
}

/**
 * Curva cuadrática entre dos nodos, recortada a sus radios, con control
 * alejado del centro (los acordes largos se arquean para esquivar el nodo
 * central). `bowShift` desplaza el arco (para dibujar estructural y dinámica
 * en paralelo sin superponerse).
 */
export function edgeCurve(
  p1: Pt,
  r1: number,
  p2: Pt,
  r2: number,
  opts: { bowShift?: number; arrowA?: boolean; arrowB?: boolean } = {}
): CurveSpec {
  const { bowShift = 0, arrowA = false, arrowB = false } = opts;
  const mid = scale(add(p1, p2), 0.5);
  const chord = len(sub(p2, p1));

  // Dirección del arco: alejándose del centro; para acordes que pasan por el
  // centro (diámetros) cae en la perpendicular del propio acorde.
  const fromCenter = sub(mid, CENTER);
  const dist = len(fromCenter);
  let dir: Pt;
  if (dist > 12) {
    dir = norm(fromCenter);
  } else {
    dir = norm(perp(sub(p2, p1)));
  }

  const nearCenter = 1 - Math.min(dist / RING_R, 1);
  const bow = Math.min(Math.max(chord * 0.12, 14), 70) * (0.55 + 1.1 * nearCenter);
  const q = add(mid, scale(dir, bow + bowShift));

  // Recorte de extremos hacia el control (la tangente inicial apunta a Q).
  const startTrim = r1 + 3;
  const endTrim = r2 + 3;
  const a = add(p1, scale(norm(sub(q, p1)), startTrim));
  const b = add(p2, scale(norm(sub(q, p2)), endTrim));

  const arrowSize = 9;
  let pathEnd = b;
  let pathStart = a;
  let polyB: string | null = null;
  let polyA: string | null = null;
  if (arrowB) {
    // La curva termina en la base de la flecha; la punta toca el borde del nodo.
    pathEnd = add(b, scale(norm(sub(q, b)), arrowSize * 0.8));
    polyB = arrowAt(b, q, arrowSize);
  }
  if (arrowA) {
    pathStart = add(a, scale(norm(sub(q, a)), arrowSize * 0.8));
    polyA = arrowAt(a, q, arrowSize);
  }

  const curveMid = {
    x: 0.25 * pathStart.x + 0.5 * q.x + 0.25 * pathEnd.x,
    y: 0.25 * pathStart.y + 0.5 * q.y + 0.25 * pathEnd.y
  };

  return {
    d: `M ${pathStart.x.toFixed(1)} ${pathStart.y.toFixed(1)} Q ${q.x.toFixed(1)} ${q.y.toFixed(1)} ${pathEnd.x.toFixed(1)} ${pathEnd.y.toFixed(1)}`,
    arrowB: polyB,
    arrowA: polyA,
    mid: curveMid
  };
}

/** Grosor de arista por peso dinámico (escala log, acotada). */
export function edgeWidth(weight: number): number {
  if (weight <= 0) return 1;
  return Math.min(1.4 + 1.6 * Math.log2(1 + weight), 6.5);
}
