export interface MosaicTile {
  /** Index into the values the layout was built from. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * "Where it went" as a mosaic: a squarified treemap (Bruls, Huizing & van
 * Wijk) — each value gets a rectangle whose area is its share of the total,
 * laid out in rows chosen to keep every tile as close to square as it can,
 * so even a small category stays a tappable shape rather than a sliver.
 *
 * Values should be sorted largest first (the category breakdown already
 * is); zero and negative values get no tile. The tiles exactly fill the
 * `width` × `height` box.
 */
export function squarify(values: number[], width: number, height: number): MosaicTile[] {
  const items = values.map((v, index) => ({ index, v })).filter((it) => it.v > 0);
  const total = items.reduce((s, it) => s + it.v, 0);
  if (items.length === 0 || width <= 0 || height <= 0 || total <= 0) return [];

  const scale = (width * height) / total;
  const areaOf = (v: number) => v * scale;
  const out: MosaicTile[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let rest = items;

  // The worst aspect ratio in a row laid along a side of length `side`.
  const worst = (row: typeof items, side: number) => {
    const sum = row.reduce((s, it) => s + areaOf(it.v), 0);
    let max = 0;
    let min = Infinity;
    for (const it of row) {
      const a = areaOf(it.v);
      max = Math.max(max, a);
      min = Math.min(min, a);
    }
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  while (rest.length > 0) {
    const side = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) {
      row.push(rest[i]);
      i++;
    }
    rest = rest.slice(i);
    const rowArea = row.reduce((s, it) => s + areaOf(it.v), 0);
    const last = rest.length === 0;
    if (w >= h) {
      // A column on the left, as tall as the box.
      const colW = last ? w : rowArea / h;
      let cy = y;
      row.forEach((it, k) => {
        const th = k === row.length - 1 ? y + h - cy : areaOf(it.v) / colW;
        out.push({ index: it.index, x, y: cy, width: colW, height: th });
        cy += th;
      });
      x += colW;
      w -= colW;
    } else {
      // A row along the top, as wide as the box.
      const rowH = last ? h : rowArea / w;
      let cx = x;
      row.forEach((it, k) => {
        const tw = k === row.length - 1 ? x + w - cx : areaOf(it.v) / rowH;
        out.push({ index: it.index, x: cx, y, width: tw, height: rowH });
        cx += tw;
      });
      y += rowH;
      h -= rowH;
    }
  }
  return out;
}
