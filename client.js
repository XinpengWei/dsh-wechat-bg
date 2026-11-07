/**
 * 微信扫码换背景 — 浏览器半区
 *
 * - 背景：在 shell.overlay 里渲染一个全局 <style>，把照片铺到 :root 上，
 *   同时把 DSH 的 --dsw-alias-bg-base 调成半透明，让各个面板透出照片。
 * - 入口：设置面板里的「背景图」一页，页内直接显示二维码与当前背景。
 * - 状态：轮询同源 /api/dsh-wechat-bg/state，手机上传后几秒内自动生效。
 */
window.__ModuleLoader__.load({
  id: 'dsh-wechat-bg',
  factory(require) {
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useRef, useSyncExternalStore } = React

    const NS = 'wechat-bg'
    const API = '/api/dsh-wechat-bg'

    const ZH = {
      title: '微信扫码换背景',
      subtitle: '用手机相册里的照片做 DSH 背景',
      nav: '背景图',
      step1: '打开手机微信，扫描上面的二维码',
      step2: '从相册选一张照片，点「设为 DSH 背景」',
      waiting: '等待手机上传…',
      waitingHint: '这个窗口会自动刷新，不用手动操作',
      current: '当前背景',
      strength: '背景浓度',
      sidebar: '侧栏浓度',
      display: '显示方式',
      fill: '铺满',
      whole: '完整',
      crop: '裁剪',
      library: '照片库',
      libraryCount: '共 {n} 张',
      selectPhoto: '设为背景',
      deletePhoto: '删除',
      confirmDelete: '确认删除',
      emptyLibrary: '图库还是空的，用上面的二维码从手机传一张。',
      cropTarget: '当前这张',
      cropHint: '滚轮缩放照片，拖动白框选择要保留的区域；方向键可微调。',
      noSourceHint: '当前背景是旧数据、没有留原图。重新扫一次码上传一次，之后裁剪就总是以原图为底了。',
      cropZoom: '缩放',
      cropMode: '取景框',
      modeWindow: '窗口比例',
      modeWhole: '整张照片',
      cropWholeHint: '取景框就是整张照片，保存后按原比例完整显示。',
      cropApply: '用框内区域',
      useOriginal: '用整张原图',
      cancel: '取消',
      cropWheel: '滚轮 / 触控板缩放',
      zoomIn: '放大',
      zoomOut: '缩小',
      cropFailed: '裁剪失败：{message}',
      empty: '还没有设置背景图',
      copy: '复制链接',
      copied: '已复制',
      refresh: '换一个二维码',
      refreshing: '正在刷新…',
      clear: '移除背景',
      confirmClear: '确认移除？',
      noNetwork: '没有找到局域网地址，请确认这台电脑已连接 Wi-Fi。',
      notReady: '上传服务还没启动，请稍等…',
      loading: '正在读取状态…',
      updated: '更新于 {time}',
      failed: '读取状态失败：{message}',
      retry: '重试',
      tip: '手机与电脑需在同一 Wi-Fi；照片只保存在这台电脑上。',
      qrAlt: '手机上传二维码',
    }

    const EN = {
      title: 'Set background by phone',
      subtitle: 'Use a photo from your phone as the DSH background',
      nav: 'Background',
      step1: 'Open WeChat on your phone and scan the QR code',
      step2: 'Pick a photo and tap “Set as DSH background”',
      waiting: 'Waiting for your phone…',
      waitingHint: 'This panel refreshes itself. No need to reload.',
      current: 'Current background',
      strength: 'Photo strength',
      sidebar: 'Sidebar strength',
      display: 'Display',
      fill: 'Fill',
      whole: 'Whole',
      crop: 'Crop',
      library: 'Photo library',
      libraryCount: '{n} photos',
      selectPhoto: 'Use as background',
      deletePhoto: 'Delete',
      confirmDelete: 'Confirm delete',
      emptyLibrary: 'The library is empty. Upload one with the QR code above.',
      cropTarget: 'This photo',
      cropHint: 'Scroll to zoom the photo, drag the frame to choose what to keep; arrow keys nudge it.',
      noSourceHint: 'This background predates original-photo storage. Upload once more from the phone and every later crop will start from the original.',
      cropZoom: 'Zoom',
      cropMode: 'Frame',
      modeWindow: 'Window shape',
      modeWhole: 'Whole photo',
      cropWholeHint: 'The frame is the whole photo; after saving it is shown in full.',
      cropApply: 'Use this area',
      useOriginal: 'Use the whole photo',
      cancel: 'Cancel',
      cropWheel: 'Scroll or pinch to zoom',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      cropFailed: 'Crop failed: {message}',
      empty: 'No background set yet',
      copy: 'Copy link',
      copied: 'Copied',
      refresh: 'New QR code',
      refreshing: 'Refreshing…',
      clear: 'Remove background',
      confirmClear: 'Remove it?',
      noNetwork: 'No LAN address found. Make sure this computer is on Wi-Fi.',
      notReady: 'The upload service is starting…',
      loading: 'Loading…',
      updated: 'Updated {time}',
      failed: 'Could not read status: {message}',
      retry: 'Retry',
      tip: 'Phone and computer must share a Wi-Fi network. The photo stays on this computer.',
      qrAlt: 'Phone upload QR code',
    }

    const CSS = `
.dsh-wbg-section{box-sizing:border-box;width:100%;max-width:560px;color:var(--dsw-alias-label-primary,#111);font-size:13px;line-height:1.55}
.dsh-wbg-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.dsh-wbg-headText{flex:1;min-width:0}
.dsh-wbg-head h2{margin:0 0 3px;font-size:15px;line-height:1.35;font-weight:650}
.dsh-wbg-head p{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary,#666)}
.dsh-wbg-qrBox{box-sizing:border-box;width:100%;max-width:238px;margin:0 auto;aspect-ratio:1/1;overflow:hidden;background:#fff;border-radius:14px;padding:10px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center}
.dsh-wbg-qrBox svg{width:100%;height:100%;max-width:100%;max-height:100%;display:block;border-radius:6px}
.dsh-wbg-qrEmpty{width:100%;max-width:238px;margin:0 auto;aspect-ratio:1/1;border-radius:14px;border:1px dashed var(--dsw-alias-border-l2,rgba(0,0,0,.2));display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary,#666);text-align:center;padding:20px;font-size:12px}
.dsh-wbg-steps{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.dsh-wbg-steps li{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--dsw-alias-label-secondary,#555)}
.dsh-wbg-num{flex:none;width:18px;height:18px;margin-top:1px;border-radius:50%;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#111);font-size:11px;font-weight:650;display:inline-flex;align-items:center;justify-content:center}
.dsh-wbg-linkRow{display:flex;align-items:center;gap:8px;margin-top:14px;padding:5px 5px 5px 10px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05))}
.dsh-wbg-link{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--dsw-alias-label-secondary,#666);user-select:text}
.dsh-wbg-btn{flex:none;height:29px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#111);font:inherit;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-wbg-btn:hover{filter:brightness(.97)}
.dsh-wbg-btn:disabled{opacity:.5;cursor:default;filter:none}
.dsh-wbg-btn.primary{background:var(--dsw-alias-brand-primary,#2f6fed);border-color:transparent;color:#fff}
.dsh-wbg-btn.danger{color:var(--dsw-alias-state-error-primary,#c0392b);border-color:var(--dsw-alias-border-l1,rgba(0,0,0,.12))}
.dsh-wbg-status{margin-top:16px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));display:flex;align-items:center;gap:10px}
.dsh-wbg-thumb{width:42px;height:42px;flex:none;border-radius:9px;object-fit:cover;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06))}
.dsh-wbg-statusText{flex:1;min-width:0}
.dsh-wbg-statusText strong{display:block;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-wbg-statusText span{display:block;font-size:11.5px;color:var(--dsw-alias-label-secondary,#666);margin-top:1px}
.dsh-wbg-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#22a06b);flex:none;animation:dsh-wbg-pulse 1.6s ease-in-out infinite}
@keyframes dsh-wbg-pulse{0%,100%{opacity:.3}50%{opacity:1}}
.dsh-wbg-strength{display:flex;align-items:center;gap:10px;margin-top:12px}
.dsh-wbg-strengthLabel{font-size:12px;color:var(--dsw-alias-label-secondary,#666);flex:none}
.dsh-wbg-range{flex:1;min-width:0;height:16px;accent-color:var(--dsw-alias-brand-primary,#0b7a5a);cursor:pointer}
.dsh-wbg-strengthValue{flex:none;min-width:42px;text-align:center;font-size:11.5px;color:var(--dsw-alias-label-secondary,#666);font-variant-numeric:tabular-nums}
.dsh-wbg-seg{display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06))}
.dsh-wbg-segBtn{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#666);font:inherit;font-size:12px;line-height:1.5;padding:3px 12px;border-radius:6px;cursor:pointer}
.dsh-wbg-segBtn.on{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#111);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.dsh-wbg-lib{margin-top:16px}
.dsh-wbg-libHead{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}
.dsh-wbg-libCount{font-size:11.5px;color:var(--dsw-alias-label-secondary,#666);font-variant-numeric:tabular-nums}
.dsh-wbg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}
.dsh-wbg-thumb{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.05));border:1.5px solid transparent;transition:border-color .12s ease}
.dsh-wbg-thumb.on{border-color:var(--dsw-alias-brand-primary,#0a7cff)}
.dsh-wbg-thumbBtn{display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer}
.dsh-wbg-thumbBtn img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.dsh-wbg-thumbDel{position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:9px;border:0;padding:0;cursor:pointer;font-size:12px;line-height:1;color:#fff;background:rgba(12,14,18,.55);opacity:0;transition:opacity .12s ease}
.dsh-wbg-thumb:hover .dsh-wbg-thumbDel,.dsh-wbg-thumbDel:focus-visible,.dsh-wbg-thumbDel.arm{opacity:1}
.dsh-wbg-thumbDel.arm{background:var(--dsw-alias-state-error-primary,#d93025)}
.dsh-wbg-thumbTag{position:absolute;left:3px;bottom:3px;padding:1px 5px;border-radius:5px;font-size:10px;line-height:1.5;color:#fff;background:rgba(12,14,18,.55)}
.dsh-wbg-emptyLib{margin-top:14px;font-size:12px;color:var(--dsw-alias-label-secondary,#666)}
.dsh-wbg-cropHint{margin:0 0 10px;font-size:12px;color:var(--dsw-alias-label-secondary,#666)}
.dsh-wbg-cropWheelHint{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary,#888);white-space:nowrap}
.dsh-wbg-stage{position:relative;width:100%;overflow:hidden;border-radius:12px;background:#080a0c;touch-action:none;user-select:none;-webkit-user-select:none;cursor:default}
.dsh-wbg-stage:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2f6fed);outline-offset:2px}
.dsh-wbg-cropImg{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:fill;pointer-events:none;max-width:none;max-height:none;user-select:none}
.dsh-wbg-frame{position:absolute;box-sizing:border-box;border:1px solid rgba(255,255,255,.95);border-radius:2px;box-shadow:0 0 0 9999px rgba(6,8,10,.56),0 0 0 1px rgba(0,0,0,.35);cursor:move;touch-action:none}
.dsh-wbg-frame::before,.dsh-wbg-frame::after{content:'';position:absolute;width:10px;height:10px;border:2px solid #fff;pointer-events:none}
.dsh-wbg-frame::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.dsh-wbg-frame::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.dsh-wbg-footRow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}
.dsh-wbg-tip{margin:14px 0 0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#777)}
.dsh-wbg-error{margin:0 0 12px;padding:9px 11px;border-radius:10px;font-size:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c0392b) 10%,transparent);color:var(--dsw-alias-state-error-primary,#c0392b)}
.dsh-wbg-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:36px 0;color:var(--dsw-alias-label-secondary,#666);font-size:12.5px}
.dsh-wbg-spin{width:13px;height:13px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:dsh-wbg-spin .8s linear infinite}
@keyframes dsh-wbg-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dsh-wbg-dot,.dsh-wbg-spin{animation:none}}
`

    /* ── store ───────────────────────────────────────────────────── */

    const STRENGTH_KEY = 'dsh-wechat-bg:strength'
    const FIT_KEY = 'dsh-wechat-bg:fit'
    const SIDEBAR_KEY = 'dsh-wechat-bg:sidebar'

    let state = {
      snap: null,
      error: null,
      busy: null,
      copied: false,
      confirmClear: false,
      strength: readStrength(),
      sidebar: readSidebar(),
      fit: readFit(),
      cropping: false,
      pendingDelete: null,
    }
    const listeners = new Set()
    const getState = () => state
    const setState = (patch) => {
      state = { ...state, ...patch }
      for (const listener of listeners) listener()
    }
    const subscribe = (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    const useStore = () => useSyncExternalStore(subscribe, getState, getState)

    function readStrength() {
      try {
        const stored = window.localStorage.getItem(STRENGTH_KEY)
        const raw = Number(stored)
        if (stored !== null && stored !== '' && Number.isFinite(raw) && raw >= 0 && raw <= 100) return raw
      } catch {
        /* 隐私模式下 localStorage 不可用 */
      }
      return 60
    }

    function setStrength(value) {
      const next = Math.max(0, Math.min(100, Math.round(value / 5) * 5))
      setState({ strength: next })
      try {
        window.localStorage.setItem(STRENGTH_KEY, String(next))
      } catch {
        /* 存不下也不影响当次效果 */
      }
    }

    function readSidebar() {
      try {
        const stored = window.localStorage.getItem(SIDEBAR_KEY)
        const raw = Number(stored)
        if (stored !== null && stored !== '' && Number.isFinite(raw) && raw >= 0 && raw <= 100) return raw
      } catch {
        /* 隐私模式下 localStorage 不可用 */
      }
      return 60
    }

    function setSidebar(value) {
      const next = Math.max(0, Math.min(100, Math.round(value / 5) * 5))
      setState({ sidebar: next })
      try {
        window.localStorage.setItem(SIDEBAR_KEY, String(next))
      } catch {
        /* 存不下也不影响当次效果 */
      }
    }

    function readFit() {
      try {
        const raw = window.localStorage.getItem(FIT_KEY)
        if (raw === 'cover' || raw === 'contain') return raw
      } catch (err) {
        /* 读不到就按铺满处理 */
      }
      return 'cover'
    }

    function setFit(value) {
      const next = value === 'contain' ? 'contain' : 'cover'
      setState({ fit: next })
      try {
        window.localStorage.setItem(FIT_KEY, next)
      } catch (err) {
        /* 存不下也不影响当次效果 */
      }
    }

    let translate = (key) => key

    /* 语言兜底：DSH 的语言包在热更新后可能丢掉本命名空间的词条，
       所以翻译失败时退回内置表，界面不会露出 key。 */
    const builtin = () => {
      try {
        const lang = (document.documentElement && document.documentElement.lang) || navigator.language || 'zh'
        return String(lang).toLowerCase().startsWith('zh') ? ZH : EN
      } catch (err) {
        return ZH
      }
    }

    const t = (key, vars) => {
      let text = translate(key)
      if (typeof text !== 'string' || text === key) text = builtin()[key]
      if (typeof text !== 'string') text = key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split('{' + name + '}').join(String(value))
        }
      }
      return text
    }

    function applySnapshot(snap) {
      setState({ snap, error: null })
    }

    async function refresh() {
      try {
        const res = await fetch(API + '/state', { cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        applySnapshot(await res.json())
      } catch (err) {
        setState({ error: err && err.message ? err.message : String(err) })
      }
    }

    const cropUrl = (store) =>
      API + '/crop' + (store.snap && store.snap.currentId ? '?id=' + encodeURIComponent(store.snap.currentId) : '')

    async function post(path, payload) {
      setState({ busy: path })
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload ?? {}),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data || !data.ok) {
          throw new Error((data && data.message) || 'HTTP ' + res.status)
        }
        setState({ busy: null, confirmClear: false })
        applySnapshot(data)
        return true
      } catch (err) {
        setState({ busy: null, error: err && err.message ? err.message : String(err) })
        return false
      }
    }

    async function copyLink(text) {
      try {
        await navigator.clipboard.writeText(text)
        setState({ copied: true })
        setTimeout(() => setState({ copied: false }), 2200)
      } catch {
        window.prompt(t('copy'), text)
      }
    }

    /* ── 背景 ───────────────────────────────────────────────────── */

    function backgroundCss(url, strength, fit, sidebar) {
      const s = Math.max(0, Math.min(100, Number(strength) || 0)) / 100
      /* 一条曲线两处共用，端点写死：0 完全不透明（背景一点都看不到），
         100 完全透明（照片保持原样，连压暗都没有）。 */
      const a = Math.pow(1 - s, 0.8)
      const sb = Math.max(0, Math.min(100, Number(sidebar) || 0)) / 100
      const as = Math.pow(1 - sb, 0.8)
      /* 100% 时不能再叠任何渐变，否则照片被压暗，就不是"原样"了 */
      const bare = s >= 0.999
      const round = (n) => Math.round(n * 100) / 100
      /* 铺满：按 cover 裁到窗口；完整：整张照片放进窗口，两侧留深色底。
         完整模式下照片不能再被窗口裁一次，所以背景色承担留白的底色。 */
      const imageRule =
        fit === 'contain'
          ? 'html{background-color:#0b0e11 !important;background-image:url("' +
            url +
            '") !important;background-size:contain !important;background-position:center center !important;background-repeat:no-repeat !important;background-attachment:fixed !important}'
          : 'html{background-color:#e9eef2 !important;background-image:' +
            (bare ? '' : 'linear-gradient(180deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.02) 34%,rgba(8,12,16,.12) 100%),') +
            'url("' +
            url +
            '") !important;background-size:cover !important;background-position:center center !important;background-repeat:no-repeat !important;background-attachment:fixed !important}'
      return [
        imageRule,
        'body{background-color:transparent !important}',
        '#root{background-color:transparent !important}',
        'body{--dsw-alias-bg-base:rgba(255,255,255,' + round(a) + ') !important;--dsw-alias-bg-layer-1:rgba(255,255,255,' + round(Math.min(1, a + .08)) + ') !important;--dsw-alias-bg-layer-2:rgba(255,255,255,' + round(Math.min(1, a + .2)) + ') !important;--dsw-alias-bg-overlay:rgba(255,255,255,' + round(Math.min(1, a + .44)) + ') !important;--dsw-specific-sidebar-fill:rgba(248,249,250,' + round(as) + ') !important}',
        'body[data-ds-dark-theme]{--dsw-alias-bg-base:rgba(20,22,26,' + round(Math.min(1, a + .05)) + ') !important;--dsw-alias-bg-layer-1:rgba(28,30,35,' + round(Math.min(1, a + .12)) + ') !important;--dsw-alias-bg-layer-2:rgba(38,40,46,' + round(Math.min(1, a + .22)) + ') !important;--dsw-alias-bg-overlay:rgba(28,30,34,' + round(Math.min(1, a + .42)) + ') !important;--dsw-specific-sidebar-fill:rgba(26,28,32,' + round(as) + ') !important}',
        // 左栏：DSH 的 darwin 规则会再乘 90% 透明，导致浓度 0 也压不到全实。
        // 这里直接给侧栏列上底色，浓度 0 就是真正的不透明，和正文一致。
        '[class*="sidebarCol"]{background:rgba(248,249,250,' + round(as) + ') !important;background-image:none !important}',
        'body[data-ds-dark-theme] [class*="sidebarCol"]{background:rgba(26,28,32,' + round(as) + ') !important;background-image:none !important}',
        // 设置面板是覆盖在当前页面上的模态窗口；让它保持不透明，
        // 否则背景照片会透过面板，强度和主题越透明越难阅读。
        'div[data-shortcut-modal="settings"]{background:#fff !important;background-image:none !important}',
        'body[data-ds-dark-theme] div[data-shortcut-modal="settings"]{background:#26282e !important;background-image:none !important}',
      ].join('\n')
    }

    function Background() {
      const store = useStore()
      const url = store.snap && store.snap.imageUrl
      if (!url) return null
      return h('style', { 'data-dsh-wechat-bg': 'background' }, backgroundCss(url, store.strength, store.fit, store.sidebar))
    }

    function Slider(props) {
      return h(
        'div',
        { className: 'dsh-wbg-strength' },
        h('span', { className: 'dsh-wbg-strengthLabel' }, props.label),
        h('input', {
          className: 'dsh-wbg-range',
          type: 'range',
          min: 0,
          max: 100,
          step: 5,
          value: props.value,
          'aria-label': props.label,
          onChange: (event) => props.onChange(Number(event.target.value)),
        }),
        h('span', { className: 'dsh-wbg-strengthValue' }, props.value + '%'),
      )
    }

    function Styles() {
      return h('style', { 'data-dsh-wechat-bg': 'ui' }, CSS)
    }

    /* ── 裁剪 ───────────────────────────────────────────────────── */

    function CropEditor() {
      const store = useStore()
      const [box, setBox] = React.useState(null)
      const [zoom, setZoom] = React.useState(1)
      const [mode, setMode] = React.useState('window')
      const whole = mode === 'whole'
      const [offset, setOffset] = React.useState({ x: 0, y: 0 })
      const [frame, setFrame] = React.useState({ x: 0, y: 0 })
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const stageRef = React.useRef(null)
      const imgRef = React.useRef(null)
      const dragRef = React.useRef(null)

      const ratio = React.useMemo(() => {
        const w = window.innerWidth || 1600
        const h = window.innerHeight || 900
        const value = h > 0 ? w / h : 1.6
        return Number.isFinite(value) ? Math.max(1, Math.min(2.6, value)) : 1.6
      }, [])

      /* 取景框固定为窗口比例，大小取整图等比缩放后的 80%。 */
      const frameBase = box
        ? box.iw / box.ih >= ratio
          ? { w: box.ih * ratio, h: box.ih }
          : { w: box.iw, h: box.iw / ratio }
        : { w: 0, h: 0 }
      const fw = frameBase.w
      const fh = frameBase.h
      const zoomEff = whole ? 1 : zoom
      const iw = box ? box.iw * zoomEff : 0
      const ih = box ? box.ih * zoomEff : 0
      const offsetEff = whole && box ? { x: (box.W - iw) / 2, y: (box.H - ih) / 2 } : offset
      /* 整张照片模式：取景框直接等于照片本身，不需要再摆位置。 */
      const active = whole && box ? { x: offsetEff.x, y: offsetEff.y, w: iw, h: ih } : frame

      const clampOffset = (next, frameRect, size) => ({
        x: Math.min(frameRect.x, Math.max(frameRect.x + frameRect.w - size.w, next.x)),
        y: Math.min(frameRect.y, Math.max(frameRect.y + frameRect.h - size.h, next.y)),
      })

      const measure = React.useCallback(() => {
        const el = stageRef.current
        const img = imgRef.current
        if (!el || !img || !img.naturalWidth || !img.naturalHeight) return
        const W = el.clientWidth || Math.min(720, window.innerWidth || 720)
        if (!W) return
        const H = el.clientHeight || Math.round(W / ratio)
        const imageRatio = img.naturalWidth / img.naturalHeight
        let w = W
        let h = W / imageRatio
        if (h > H) {
          h = H
          w = H * imageRatio
        }
        const nextBox = { W, H, iw: w, ih: h }
        const base =
          w / h >= ratio ? { w: h * ratio, h } : { w, h: w / ratio }
        const nextFrame = {
          x: (W - base.w) / 2,
          y: (H - base.h) / 2,
          w: base.w,
          h: base.h,
        }
        setBox(nextBox)
        setFrame(nextFrame)
        setZoom(1)
        setOffset({ x: (W - w) / 2, y: (H - h) / 2 })
      }, [ratio])

      React.useLayoutEffect(() => {
        measure()
        const el = imgRef.current
        if (el && el.complete && el.naturalWidth) measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [measure])

      /* 滚轮缩放：以指针（或取景框中心）为锚点，保证框始终落在图内。 */
      const applyZoom = (factor, anchor) => {
        if (!box || whole) return
        const next = Math.max(1, Math.min(6, zoom * factor))
        if (Math.abs(next - zoom) < 0.001) return
        const cx = anchor ? anchor.x : frame.x + fw / 2
        const cy = anchor ? anchor.y : frame.y + fh / 2
        const px = Math.min(1, Math.max(0, (cx - offset.x) / (box.iw * zoom)))
        const py = Math.min(1, Math.max(0, (cy - offset.y) / (box.ih * zoom)))
        const w = box.iw * next
        const h = box.ih * next
        setOffset(clampOffset({ x: cx - px * w, y: cy - py * h }, frame, { w, h }))
        setZoom(next)
      }

      const zoomRef = React.useRef(applyZoom)
      zoomRef.current = applyZoom

      useEffect(() => {
        const el = stageRef.current
        if (!el || !box) return
        const onWheel = (event) => {
          event.preventDefault()
          if (whole) return
          const rect = el.getBoundingClientRect()
          zoomRef.current(Math.exp(-event.deltaY * 0.0015), {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          })
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
      }, [box, whole])

      const clampFrame = (next) => {
        const minX = Math.max(0, offsetEff.x)
        const minY = Math.max(0, offsetEff.y)
        const maxX = Math.min(box ? box.W : 0, offsetEff.x + iw) - fw
        const maxY = Math.min(box ? box.H : 0, offsetEff.y + ih) - fh
        return {
          x: Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), next.x)),
          y: Math.max(Math.min(minY, maxY), Math.min(Math.max(minY, maxY), next.y)),
          w: fw,
          h: fh,
        }
      }

      const startDrag = (event) => {
        if (whole) return
        event.preventDefault()
        event.stopPropagation()
        dragRef.current = { x: event.clientX, y: event.clientY, fx: frame.x, fy: frame.y }
        try {
          if (stageRef.current && stageRef.current.setPointerCapture) {
            stageRef.current.setPointerCapture(event.pointerId)
          }
        } catch (err) {
          /* capture 只是保险，指针仍在 stage 内时一样能收到 move */
        }
      }

      const onPointerMove = (event) => {
        const start = dragRef.current
        if (!start) return
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        setFrame(clampFrame({ x: start.fx + dx, y: start.fy + dy, w: fw, h: fh }))
      }

      const onPointerUp = () => {
        dragRef.current = null
      }

      const onKeyDown = (event) => {
        if (whole) return
        const step = event.shiftKey ? 32 : 8
        const moves = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }
        const move = moves[event.key]
        if (!move) return
        event.preventDefault()
        setFrame((prev) => clampFrame({ x: prev.x + move[0], y: prev.y + move[1], w: fw, h: fh }))
      }

      const apply = async () => {
        const img = imgRef.current
        if (!img || !img.naturalWidth || !box || busy || !iw || !ih) return
        setBusy(true)
        setError(null)
        try {
          const sx = ((active.x - offsetEff.x) / iw) * img.naturalWidth
          const sy = ((active.y - offsetEff.y) / ih) * img.naturalHeight
          const sw = (active.w / iw) * img.naturalWidth
          const sh = (active.h / ih) * img.naturalHeight
          const scale = Math.min(1, 2560 / Math.max(sw, sh))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(sw * scale))
          canvas.height = Math.max(1, Math.round(sh * scale))
          const g = canvas.getContext('2d')
          g.imageSmoothingQuality = 'high'
          g.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
          if (!blob) throw new Error('canvas is not exportable')
          const res = await fetch(cropUrl(store), {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob,
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data || !data.ok) {
            throw new Error((data && (data.message || data.error)) || 'HTTP ' + res.status)
          }
          applySnapshot(data)
          setFit(whole ? 'contain' : 'cover')
          setState({ cropping: false })
        } catch (err) {
          setError(err && err.message ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      const useOriginal = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
          const res = await fetch(store.snap.sourceUrl || store.snap.imageUrl, { cache: 'no-store' })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const blob = await res.blob()
          const saved = await fetch(cropUrl(store), {
            method: 'POST',
            headers: { 'Content-Type': blob.type || 'image/jpeg' },
            body: blob,
          })
          const data = await saved.json().catch(() => null)
          if (!saved.ok || !data || !data.ok) {
            throw new Error((data && (data.message || data.error)) || 'HTTP ' + saved.status)
          }
          applySnapshot(data)
          setState({ cropping: false })
        } catch (err) {
          setError(err && err.message ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      return h(
        'div',
        { className: 'dsh-wbg-crop' },
        h('p', { className: 'dsh-wbg-cropHint' }, whole ? t('cropWholeHint') : t('cropHint')),
        !store.snap.hasSource
          ? h('p', { className: 'dsh-wbg-error' }, t('noSourceHint'))
          : null,
        h(
          'div',
          { className: 'dsh-wbg-strength' },
          h('span', { className: 'dsh-wbg-strengthLabel' }, t('cropMode')),
          h(
            'div',
            { className: 'dsh-wbg-seg' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-wbg-segBtn' + (whole ? '' : ' on'),
                onClick: () => setMode('window'),
              },
              t('modeWindow'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-wbg-segBtn' + (whole ? ' on' : ''),
                onClick: () => setMode('whole'),
              },
              t('modeWhole'),
            ),
          ),
        ),
        h(
          'div',
          {
            className: 'dsh-wbg-stage',
            ref: stageRef,
            style: { aspectRatio: String(ratio) },
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onKeyDown,
            tabIndex: 0,
            role: 'group',
            'aria-label': t('cropHint'),
          },
          h('img', {
            className: 'dsh-wbg-cropImg',
            ref: imgRef,
            src: store.snap.sourceUrl || store.snap.imageUrl,
            alt: '',
            draggable: false,
            onLoad: measure,
            style: box
              ? {
                  left: offsetEff.x + 'px',
                  top: offsetEff.y + 'px',
                  width: iw + 'px',
                  height: ih + 'px',
                }
              : undefined,
          }),
          box
            ? h('div', {
                className: 'dsh-wbg-frame',
                style: {
                  left: active.x + 'px',
                  top: active.y + 'px',
                  width: active.w + 'px',
                  height: active.h + 'px',
                },
                onPointerDown: startDrag,
              })
            : null,
        ),
        whole
          ? null
          : h(
          'div',
          { className: 'dsh-wbg-strength' },
          h('span', { className: 'dsh-wbg-strengthLabel' }, t('cropZoom')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-wbg-btn',
              onClick: () => applyZoom(1 / 1.2),
              'aria-label': t('zoomOut'),
            },
            '−',
          ),
          h('span', { className: 'dsh-wbg-strengthValue' }, Math.round(zoom * 100) + '%'),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-wbg-btn',
              onClick: () => applyZoom(1.2),
              'aria-label': t('zoomIn'),
            },
            '+',
          ),
          h('span', { className: 'dsh-wbg-cropWheelHint' }, t('cropWheel')),
        ),
        error ? h('p', { className: 'dsh-wbg-error' }, t('cropFailed', { message: error })) : null,
        h(
          'div',
          { className: 'dsh-wbg-footRow' },
          h(
            'button',
            { type: 'button', className: 'dsh-wbg-btn', onClick: () => setState({ cropping: false }) },
            t('cancel'),
          ),
          store.snap.hasSource
            ? h(
                'button',
                { type: 'button', className: 'dsh-wbg-btn', disabled: busy, onClick: useOriginal },
                t('useOriginal'),
              )
            : null,
          h(
            'button',
            { type: 'button', className: 'dsh-wbg-btn primary', disabled: busy, onClick: apply },
            busy ? t('refreshing') : t('cropApply'),
          ),
        ),
      )
    }

    /* ── 设置面板 ───────────────────────────────────────────────── */

    function Section() {
      useEffect(() => {
        refresh()
        const id = setInterval(refresh, 2500)
        return () => clearInterval(id)
      }, [])

      const store = useStore()

      return h(
        'section',
        { className: 'dsh-wbg-section', 'aria-label': t('title') },
        h(
          'header',
          { className: 'dsh-wbg-head' },
          h(
            'div',
            { className: 'dsh-wbg-headText' },
            h('h2', null, t('title')),
            h('p', null, t('subtitle')),
          ),
        ),
        renderBody(store, store.snap, store.busy),
        h('p', { className: 'dsh-wbg-tip' }, t('tip')),
      )
    }

    function renderBody(store, snap, busy) {
      const time = snap && snap.updatedAt ? new Date(snap.updatedAt).toLocaleString() : ''
      if (store.cropping && snap && snap.hasImage) return h(CropEditor)
      if (!snap) {
        if (store.error) {
          return h(
            'div',
            null,
            h('p', { className: 'dsh-wbg-error' }, t('failed', { message: store.error })),
            h(
              'button',
              { type: 'button', className: 'dsh-wbg-btn', onClick: refresh },
              t('retry'),
            ),
          )
        }
        return h(
          'div',
          { className: 'dsh-wbg-loading' },
          h('span', { className: 'dsh-wbg-spin' }),
          t('loading'),
        )
      }

      const qr =
        snap.qrSvg && snap.uploadUrl && !snap.loopbackOnly
          ? h('div', {
              className: 'dsh-wbg-qrBox',
              role: 'img',
              'aria-label': t('qrAlt'),
              dangerouslySetInnerHTML: { __html: snap.qrSvg },
            })
          : h(
              'div',
              { className: 'dsh-wbg-qrEmpty' },
              !snap.ready ? t('notReady') : snap.loopbackOnly ? t('noNetwork') : t('waiting'),
            )

      const link = snap.uploadUrl
        ? h(
            'div',
            { className: 'dsh-wbg-linkRow' },
            h('span', { className: 'dsh-wbg-link', title: snap.uploadUrl }, snap.uploadUrl),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-wbg-btn',
                onClick: () => copyLink(snap.uploadUrl),
              },
              store.copied ? t('copied') : t('copy'),
            ),
          )
        : h('p', { className: 'dsh-wbg-error' }, t('noNetwork'))

      const status = snap.hasImage
        ? h(
            'div',
            { className: 'dsh-wbg-status' },
            h('img', { className: 'dsh-wbg-thumb', src: snap.imageUrl, alt: '' }),
            h(
              'div',
              { className: 'dsh-wbg-statusText' },
              h('strong', null, t('current')),
              h('span', null, t('updated', { time })),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-wbg-btn',
                onClick: () => setState({ cropping: true, confirmClear: false }),
              },
              t('crop'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-wbg-btn danger',
                disabled: busy === API + '/clear',
                onClick: () => {
                  if (store.confirmClear) post(API + '/clear')
                  else setState({ confirmClear: true })
                },
              },
              store.confirmClear ? t('confirmClear') : t('clear'),
            ),
          )
        : h(
            'div',
            { className: 'dsh-wbg-status' },
            h('span', { className: 'dsh-wbg-dot' }),
            h(
              'div',
              { className: 'dsh-wbg-statusText' },
              h('strong', null, t('waiting')),
              h('span', null, t('waitingHint')),
            ),
          )

      const library =
        snap.items && snap.items.length
          ? h(
              'div',
              { className: 'dsh-wbg-lib' },
              h(
                'div',
                { className: 'dsh-wbg-libHead' },
                h('span', { className: 'dsh-wbg-strengthLabel' }, t('library')),
                h(
                  'span',
                  { className: 'dsh-wbg-libCount' },
                  t('libraryCount', { n: snap.items.length }),
                ),
              ),
              h(
                'div',
                { className: 'dsh-wbg-grid' },
                snap.items.map((item) =>
                  h(
                    'div',
                    { key: item.id, className: 'dsh-wbg-thumb' + (item.isCurrent ? ' on' : '') },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-wbg-thumbBtn',
                        title: t('selectPhoto'),
                        onClick: () => post(API + '/select', { id: item.id }),
                      },
                      h('img', { src: item.imageUrl, alt: '', draggable: false }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className:
                          'dsh-wbg-thumbDel' + (store.pendingDelete === item.id ? ' arm' : ''),
                        title:
                          store.pendingDelete === item.id ? t('confirmDelete') : t('deletePhoto'),
                        onClick: () => {
                          if (store.pendingDelete === item.id) {
                            setState({ pendingDelete: null })
                            post(API + '/delete', { id: item.id })
                          } else {
                            setState({ pendingDelete: item.id })
                          }
                        },
                      },
                      store.pendingDelete === item.id ? '!' : '×',
                    ),
                    item.isCurrent
                      ? h('span', { className: 'dsh-wbg-thumbTag' }, t('cropTarget'))
                      : null,
                  ),
                ),
              ),
            )
          : snap.items && snap.ready
            ? h('p', { className: 'dsh-wbg-emptyLib' }, t('emptyLibrary'))
            : null

      return h(
        'div',
        null,
        store.error
          ? h('p', { className: 'dsh-wbg-error' }, t('failed', { message: store.error }))
          : null,
        snap.loopbackOnly ? h('p', { className: 'dsh-wbg-error' }, t('noNetwork')) : null,
        qr,
        h(
          'ol',
          { className: 'dsh-wbg-steps' },
          h('li', null, h('span', { className: 'dsh-wbg-num' }, '1'), h('span', null, t('step1'))),
          h('li', null, h('span', { className: 'dsh-wbg-num' }, '2'), h('span', null, t('step2'))),
        ),
        link,
        status,
        library,
        snap.hasImage
          ? h(Slider, { label: t('strength'), value: store.strength, onChange: setStrength })
          : null,
        snap.hasImage
          ? h(Slider, { label: t('sidebar'), value: store.sidebar, onChange: setSidebar })
          : null,
        snap.hasImage
          ? h(
              'div',
              { className: 'dsh-wbg-strength' },
              h('span', { className: 'dsh-wbg-strengthLabel' }, t('display')),
              h(
                'div',
                { className: 'dsh-wbg-seg' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-wbg-segBtn' + (store.fit === 'contain' ? '' : ' on'),
                    onClick: () => setFit('cover'),
                  },
                  t('fill'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-wbg-segBtn' + (store.fit === 'contain' ? ' on' : ''),
                    onClick: () => setFit('contain'),
                  },
                  t('whole'),
                ),
              ),
            )
          : null,
        h(
          'div',
          { className: 'dsh-wbg-footRow' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-wbg-btn',
              disabled: busy === API + '/rotate' || !snap.ready,
              onClick: () => post(API + '/rotate'),
            },
            busy === API + '/rotate' ? t('refreshing') : t('refresh'),
          ),
        ),
      )
    }

    /* ── 插件 ───────────────────────────────────────────────────── */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          ctx.locale.register(NS, 'zh', ZH)
        } catch {
          /* HMR 重新加载时命名空间已存在 */
        }
        try {
          ctx.locale.register(NS, 'en', EN)
        } catch {
          /* HMR 重新加载时命名空间已存在 */
        }
        try {
          translate = ctx.locale.bind(NS)
        } catch {
          /* 语气包不可用时退回 key，界面仍可用 */
        }

        ctx.effect(() => {
          let disposed = false
          let timer = null
          const tick = async () => {
            await refresh()
            if (disposed) return
            timer = setTimeout(tick, 15000)
          }
          tick()
          const onVisible = () => {
            if (document.visibilityState === 'visible') refresh()
          }
          window.addEventListener('focus', refresh)
          document.addEventListener('visibilitychange', onVisible)
          return () => {
            disposed = true
            if (timer) clearTimeout(timer)
            window.removeEventListener('focus', refresh)
            document.removeEventListener('visibilitychange', onVisible)
          }
        }, 'wechat-bg: poll upload state')

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'wechat-bg', order: 30 }, () =>
            h(React.Fragment, null, h(Styles), h(Background)),
          ),
        )

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'wechat-bg',
              order: 120,
              label: () => t('nav'),
              locale: NS,
            },
            Section,
          ),
        )
      },
    }
  },
})
