export function isMobileDevice(): boolean {
  if (new URLSearchParams(window.location.search).has('mobile-preview')) return true // TEMP-PREVIEW
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 820px)').matches
  return coarsePointer && narrow
}

/** 读取 env(safe-area-inset-*) 的真实像素值 */
function readInset(side: 'top' | 'bottom'): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-${side},0px)`
  document.body.appendChild(probe)
  const value = Math.round(probe.getBoundingClientRect().height)
  probe.remove()
  return value
}

/**
 * 已安装的 PWA 在部分 Android 版本上会被「边到边」绘制，但 env(safe-area-inset-*) 仍返回 0，
 * 状态栏与手势条就会压住顶部/底部内容。命中该组合时写入兜底留白，其余环境保持 env() 原值。
 */
export function syncSafeAreaInsets() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  if (!standalone || !/Android/i.test(navigator.userAgent)) return
  const edgeToEdge = window.innerHeight >= window.screen.height - 8
  if (!edgeToEdge) return
  const style = document.documentElement.style
  if (readInset('top') === 0) style.setProperty('--safe-top', '28px')
  if (readInset('bottom') === 0) style.setProperty('--safe-bottom', '20px')
}