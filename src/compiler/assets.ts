const distMap: Record<string, string> = {}

// export function getDist(){
//   return distMap
// }
export function getAsset(id: string) {
  const entry = getChunk(id, 1)
  return distMap['\0'+ entry] || null
}
export function setAsset(id: string | null, val: string) {
  distMap['\0'+ normalizeId(id)] = val
}

// corririr isso...
export function getChunk(id: string, deep: number = 3, loop: number = 1) {
  if (!distMap[id]) return id

  const currentValue = distMap[id]

  if (loop < deep && distMap[currentValue] && currentValue !== id)
    return getChunk(currentValue, deep, loop + 1)

  return currentValue
}
export function setChunk(id: string | null, val: string) {
  distMap[normalizeId(id)] = val
}

export function getEntry(id: string) {
  if (id in distMap) return distMap[id]
  const key = id in distMap ? id : normalizeId(id)
  return distMap[key] || id
}
export function setEntry(id: string | null, val: string) {
  if (!id) return
  distMap[id] = normalizeId(val)
}

export function normalizeId(id?: string | null) {
  id = id?.replace(process.cwd(), '') || ''
  if (id && !id.startsWith('/')) id = '/'+ id
  return id
}
