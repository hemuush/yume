/** Soft avatar colours, picked by id: a person (or a goal) gets the same one everywhere it appears. */
export const AVATAR_COLORS = ['#E2846A', '#7A9BE8', '#5FB58A', '#B08AD8', '#D9A441', '#5AAFC0', '#D97BA6'];

export function hueFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
