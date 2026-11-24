export function isMobileDevice(): boolean {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 820px)').matches
  return coarsePointer && narrow
}