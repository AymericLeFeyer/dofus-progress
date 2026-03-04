/**
 * Maps Dofus class names to DofusDB breed IDs for image URLs.
 * Image URL: /dofusdb/img/breeds/symbol_{id}.png
 */
const CLASS_BREED_ID: Record<string, number> = {
  'Féca':        1,
  'Osamodas':    2,
  'Enutrof':     3,
  'Sram':        4,
  'Xélor':       5,
  'Ecaflip':     6,
  'Eniripsa':    7,
  'Iop':         8,
  'Cra':         9,
  'Sadida':     10,
  'Sacrieur':   11,
  'Pandawa':    12,
  'Roublard':   13,
  'Zobal':      14,
  'Steamer':    15,
  'Eliotrope':  16,
  'Huppermage': 17,
  'Ouginak':    18,
  'Forgelance': 19,
};

export function classImageUrl(className: string): string | null {
  const id = CLASS_BREED_ID[className];
  if (!id) return null;
  return `/dofusdb/img/breeds/symbol_${id}.png`;
}
