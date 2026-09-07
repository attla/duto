let hmr: WebSocket | null = null
const url = `ws${location.protocol === 'https:' ? 'ws' : ''}://${location.host}`

const connect = () => {
  hmr = new WebSocket(url, 'duto')
  hmr.onmessage = ({ data }) => data === 'reload' && location.reload()
  hmr.onerror = () => hmr?.close()
}
const reconect = () => (!hmr || hmr?.readyState === WebSocket.CLOSED) && location.reload()
connect()
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reconect())
window.addEventListener('focus', reconect)
window.addEventListener('pageshow', reconect)
