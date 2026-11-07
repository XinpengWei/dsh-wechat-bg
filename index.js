/**
 * 微信扫码换背景 — Host 半区
 *
 * 这里做三件事：
 * 1. 在 0.0.0.0 上另起一个小 HTTP 服务，专门给手机访问（DSH 自己的 web
 *    服务只监听 127.0.0.1，手机连不上）。地址里带一次性随机 token。
 * 2. 把收到的照片存进本机图库 $DSH_HOME/wechat-bg/photos/，重启后仍然在；
 *    图库可以放多张，当前用哪张由 library.json 的 currentId 决定。
 * 3. 在 DSH 自己的同源 web 服务上注册 state / image / source / select /
 *    delete / clear / crop / rotate，给浏览器半区读写。
 */
import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { homedir, networkInterfaces } from 'node:os'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import qrcode from './vendor/qrcode.mjs'
import { PHONE_PAGE } from './phone-page.js'

const API = '/api/dsh-wechat-bg'
const MAX_BYTES = 30 * 1024 * 1024
const MARGIN = 4

export const name = 'wechat-bg'
export const inject = ['webServer']

export function apply(ctx) {
  const dir = dataDir()
  mkdirSync(join(dir, 'photos'), { recursive: true })

  const restored = restore(dir)
  const state = {
    token: newToken(),
    port: 0,
    error: null,
    items: restored.items,
    currentId: restored.currentId,
    qr: null,
    server: null,
  }
  const log = (...args) => {
    try {
      ctx.logger?.info?.(...args)
    } catch {
      /* logging must never break the plugin */
    }
  }

  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register({ kind: 'exact', path: `${API}/state`, handler: stateRoute(state) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/image`, handler: imageRoute(state) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/source`, handler: sourceRoute(state) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/select`, handler: selectRoute(state, dir) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/delete`, handler: deleteRoute(state, dir) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/clear`, handler: clearRoute(state, dir) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/rotate`, handler: rotateRoute(state) }),
      ctx.webServer.register({ kind: 'exact', path: `${API}/crop`, handler: cropRoute(state, dir) }),
    ]

    const server = createServer((req, res) => {
      phoneRoute(req, res, state, dir).catch((err) => {
        state.error = err?.message ?? String(err)
        log('[wechat-bg] phone request failed:', err)
        sendJson(res, 500, { ok: false, error: 'INTERNAL' })
      })
    })
    server.on('error', (err) => {
      state.error = err?.message ?? String(err)
      log('[wechat-bg] phone server error:', err)
    })
    server.listen(0, '0.0.0.0', () => {
      state.port = server.address()?.port ?? 0
      state.error = null
      const address = lanAddresses()[0]
      log(
        `[wechat-bg] phone upload server on port ${state.port}` +
          (address ? ` — http://${address.address}:${state.port}/p/<token>` : ' — no LAN address found'),
      )
    })
    state.server = server

    return () => {
      state.server = null
      state.port = 0
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          /* the route may already be gone */
        }
      }
      try {
        server.closeAllConnections?.()
        server.close()
      } catch {
        /* ignore */
      }
    }
  }, 'wechat-bg: phone upload server + same-origin api')
}

/* ── 同源 API ─────────────────────────────────────────────────────── */

function stateRoute(state) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, 'GET')
    sendJson(res, 200, snapshot(state))
  }
}

function findItem(state, id) {
  const wanted = id ?? state.currentId
  if (!wanted) return null
  return state.items.find((item) => item.id === wanted) ?? null
}

/* 图片：默认当前背景；带 ?id= 可以取图库里任意一张（缩略图用）。 */
function imageRoute(state) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, 'GET')
    const item = findItem(state, queryValue(req, 'id') ?? undefined)
    if (!item) return sendJson(res, 404, { ok: false, error: 'NO_IMAGE' })
    const buffer = item.cropBuffer || item.buffer
    const mime = item.cropBuffer ? item.cropMime : item.mime
    serveImage(req, res, buffer, mime)
  }
}

/* 原图：裁剪永远从这张开始，反复裁不会叠加。 */
function sourceRoute(state) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, 'GET')
    const item = findItem(state, queryValue(req, 'id') ?? undefined)
    if (!item) return sendJson(res, 404, { ok: false, error: 'NO_SOURCE' })
    serveImage(req, res, item.buffer, item.mime)
  }
}

function selectRoute(state, dir) {
  return async (req, res) => {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    try {
      const body = await readJson(req)
      if (!body || !Object.prototype.hasOwnProperty.call(body, 'id')) {
        return sendJson(res, 400, { ok: false, error: 'BAD_REQUEST' })
      }
      if (body.id === null || body.id === '') {
        // 清掉当前背景，图库仍保留，随时可以再选回来
        state.currentId = null
        await persist(dir, state)
        return sendJson(res, 200, snapshot(state))
      }
      const item = state.items.find((entry) => entry.id === String(body.id))
      if (!item) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' })
      state.currentId = item.id
      await persist(dir, state)
      sendJson(res, 200, snapshot(state))
    } catch (err) {
      sendJson(res, 500, { ok: false, error: 'SAVE_FAILED', message: String(err?.message ?? err) })
    }
  }
}

function deleteRoute(state, dir) {
  return async (req, res) => {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    try {
      const body = await readJson(req)
      const index = body?.id ? state.items.findIndex((entry) => entry.id === String(body.id)) : -1
      if (index < 0) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' })
      const [item] = state.items.splice(index, 1)
      if (state.currentId === item.id) state.currentId = null
      for (const file of item.files) await unlink(file).catch(() => {})
      await persist(dir, state)
      sendJson(res, 200, snapshot(state))
    } catch (err) {
      sendJson(res, 500, { ok: false, error: 'SAVE_FAILED', message: String(err?.message ?? err) })
    }
  }
}

function clearRoute(state, dir) {
  return async (req, res) => {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    state.currentId = null
    state.qr = null
    await persist(dir, state)
    sendJson(res, 200, snapshot(state))
  }
}

function rotateRoute(state) {
  return (req, res) => {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    state.token = newToken()
    state.qr = null
    sendJson(res, 200, snapshot(state))
  }
}

/* ── 手机端 ───────────────────────────────────────────────────────── */

async function phoneRoute(req, res, state, dir) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://phone.local')
  } catch {
    return sendText(res, 400, 'Bad request')
  }
  const parts = url.pathname.split('/').filter(Boolean)

  if (parts[0] !== 'p' || parts.length < 2 || !sameToken(parts[1], state.token)) {
    return sendText(res, 404, '这个链接已经失效了，请在电脑上的 DSH 里重新打开二维码。')
  }

  if (parts.length === 2) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, 'GET')
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    })
    return res.end(req.method === 'HEAD' ? undefined : PHONE_PAGE)
  }

  if (parts.length === 3 && parts[2] === 'state') {
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
    const current = findItem(state)
    return sendJson(res, 200, {
      ok: true,
      hasImage: Boolean(current),
      count: state.items.length,
      updatedAt: current?.at ?? null,
    })
  }

  if (parts.length === 3 && parts[2] === 'upload') {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    const saved = await receiveImage(req, res, state, dir)
    if (saved) sendJson(res, 200, saved)
    return
  }

  return sendText(res, 404, 'Not found')
}

async function receiveImage(req, res, state, dir, options = {}) {
  const targetId = options.targetId ?? null
  const declared = Number(req.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    sendJson(res, 413, { ok: false, error: 'TOO_LARGE', maxBytes: MAX_BYTES })
    req.destroy()
    return
  }

  const body = await readBody(req, res)
  if (!body) return // 超限时 readBody 已经回过响应

  const kind = detectImage(body)
  if (!kind) {
    return sendJson(res, 415, {
      ok: false,
      error: 'UNSUPPORTED_TYPE',
      message: '只支持 JPG / PNG / WebP / GIF 图片',
    })
  }

  const photos = join(dir, 'photos')
  await mkdir(photos, { recursive: true })

  if (targetId) {
    // 裁剪：写回同一张照片的 crop 文件，原图保持不动
    const item = state.items.find((entry) => entry.id === targetId)
    if (!item) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' })
    const cropFile = join(photos, `${item.id}.crop.jpg`)
    const tmp = join(photos, `.${item.id}.crop.tmp`)
    await writeFile(tmp, body)
    await rename(tmp, cropFile)
    item.cropAt = new Date().toISOString()
    item.cropBytes = body.length
    item.cropMime = kind.mime
    item.cropBuffer = body
    if (!item.files.includes(cropFile)) item.files.push(cropFile)
    state.currentId = item.id
    state.qr = null
    await persist(dir, state)
    return { ok: true, id: item.id, bytes: body.length }
  }

  const id = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
  const file = join(photos, `${id}.${kind.ext}`)
  const tmp = join(photos, `.${id}.tmp`)
  await writeFile(tmp, body)
  await rename(tmp, file)

  state.items.unshift({
    id,
    at: new Date().toISOString(),
    bytes: body.length,
    mime: kind.mime,
    ext: kind.ext,
    file: `photos/${id}.${kind.ext}`,
    buffer: body,
    cropAt: null,
    cropBytes: 0,
    cropMime: null,
    cropBuffer: null,
    files: [file],
  })
  state.currentId = id
  state.qr = null
  await persist(dir, state)
  return { ok: true, id, bytes: body.length, count: state.items.length }
}

/* 浏览器端裁剪后的图走这里：目标照片用 ?id= 指定，默认当前背景 */
function cropRoute(state, dir) {
  return async (req, res) => {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
    try {
      const targetId = queryValue(req, 'id') ?? state.currentId
      if (!targetId) return sendJson(res, 404, { ok: false, error: 'NO_IMAGE' })
      const saved = await receiveImage(req, res, state, dir, { targetId })
      if (saved) sendJson(res, 200, snapshot(state))
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: 'SAVE_FAILED',
        message: err?.message ?? String(err),
      })
    }
  }
}

/* ── 状态与二维码 ─────────────────────────────────────────────────── */

function snapshot(state) {
  const addresses = lanAddresses()
  const primary = addresses[0]?.address ?? null
  const host = primary ?? '127.0.0.1'
  const uploadUrl = state.port ? `http://${host}:${state.port}/p/${state.token}` : null

  if (uploadUrl && state.qr?.url !== uploadUrl) {
    state.qr = { url: uploadUrl, svg: qrSvg(uploadUrl) }
  }

  const current = findItem(state)
  const url = (item, cropped) =>
    `${API}/${cropped ? 'image' : 'source'}?id=${encodeURIComponent(item.id)}&v=${encodeURIComponent(
      `${item.id}.${cropped ? item.cropAt || item.at : item.at}`,
    )}`

  return {
    ok: true,
    ready: state.port > 0,
    hasImage: Boolean(current),
    hasSource: Boolean(current?.buffer),
    count: state.items.length,
    currentId: current?.id ?? null,
    version: current ? `${current.id}.${current.cropAt || current.at}` : null,
    imageUrl: current ? url(current, true) : null,
    sourceUrl: current ? url(current, false) : null,
    items: state.items.map((item) => ({
      id: item.id,
      at: item.at,
      bytes: item.bytes,
      mime: item.mime,
      croppedAt: item.cropAt,
      isCurrent: item.id === state.currentId,
      imageUrl: url(item, true),
      sourceUrl: url(item, false),
    })),
    uploadUrl,
    uploadPath: `/p/${state.token}`,
    port: state.port || null,
    loopbackOnly: !primary,
    addresses,
    maxBytes: MAX_BYTES,
    updatedAt: current?.at ?? null,
    qrSvg: state.port && state.qr ? state.qr.svg : null,
    error: state.error,
  }
}

function qrSvg(text) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  const size = count + MARGIN * 2
  let path = ''
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="240" height="240" ` +
    `shape-rendering="crispEdges" aria-hidden="true">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#0b1210"/></svg>`
  )
}

/* ── 持久化 ───────────────────────────────────────────────────────── */

function dataDir() {
  const home = process.env.DSH_HOME?.trim()
  return home ? join(home, 'wechat-bg') : join(homedir(), '.dsh', 'wechat-bg')
}

function libraryFile(dir) {
  return join(dir, 'library.json')
}

async function persist(dir, state) {
  const payload = {
    version: 1,
    currentId: state.currentId,
    items: state.items.map((item) => ({
      id: item.id,
      at: item.at,
      bytes: item.bytes,
      mime: item.mime,
      ext: item.ext,
      file: item.file,
      cropAt: item.cropAt || null,
      cropBytes: item.cropBytes || 0,
      cropMime: item.cropMime || null,
    })),
  }
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, '.library.tmp')
  await writeFile(tmp, JSON.stringify(payload, null, 2))
  await rename(tmp, libraryFile(dir))
}

function restore(dir) {
  const empty = { items: [], currentId: null }
  const lib = readLibrary(dir)
  if (!lib) return migrateLegacy(dir) ?? empty

  const items = []
  for (const entry of lib.items ?? []) {
    if (!entry?.id || !entry.file) continue
    const file = join(dir, entry.file)
    if (!existsSync(file)) continue
    try {
      const buffer = readFileSync(file)
      const item = {
        id: String(entry.id),
        at: entry.at ?? new Date().toISOString(),
        bytes: buffer.length,
        mime: entry.mime ?? detectImage(buffer)?.mime ?? 'image/jpeg',
        ext: entry.ext ?? 'jpg',
        file: entry.file,
        buffer,
        cropAt: entry.cropAt ?? null,
        cropBytes: entry.cropBytes ?? 0,
        cropMime: entry.cropMime ?? null,
        cropBuffer: null,
        files: [file],
      }
      if (item.cropAt) {
        const cropFile = join(dir, 'photos', `${item.id}.crop.jpg`)
        if (existsSync(cropFile)) {
          item.cropBuffer = readFileSync(cropFile)
          item.files.push(cropFile)
        } else {
          item.cropAt = null
        }
      }
      items.push(item)
    } catch {
      /* 文件被手动删了就跳过这条 */
    }
  }
  const currentId = items.some((item) => item.id === lib.currentId)
    ? lib.currentId
    : items[0]?.id ?? null
  return { items, currentId }
}

function readLibrary(dir) {
  try {
    const raw = JSON.parse(readFileSync(libraryFile(dir), 'utf8'))
    if (!raw || !Array.isArray(raw.items)) return null
    return raw
  } catch {
    return null
  }
}

/* 旧版本的数据搬进图库：手机上传的原图（source-*）留作裁剪底图，
   background-*（可能已经被裁过）存成 crop，用户不会丢图也不会丢构图。 */
function migrateLegacy(dir) {
  try {
    const files = readdirSync(dir)
    const meta = readMeta(dir)
    const sources = files
      .filter((file) => /^source-[\w-]+\.(jpg|jpeg|png|webp|gif)$/i.test(file))
      .map((file) => ({ file, at: statAt(join(dir, file)) }))
      .sort((a, b) => b.at - a.at)
    const backgrounds = files
      .filter((file) => /^background-[\w-]+\.(jpg|jpeg|png|webp|gif)$/i.test(file))
      .map((file) => ({ file, at: statAt(join(dir, file)) }))
      .sort((a, b) => b.at - a.at)

    const original = sources[0] ?? backgrounds[0] ?? null
    if (!original) return null

    const photos = join(dir, 'photos')
    mkdirSync(photos, { recursive: true })

    const fromMeta = (name) => String(name ?? '').match(/-([\w-]+)\.[a-z0-9]+$/i)?.[1] ?? null
    const id =
      fromMeta(original.file) ??
      String(meta?.version ?? '') ??
      Date.now().toString(36)
    const ext = String(original.file).split('.').pop().toLowerCase() || 'jpg'
    const buffer = readFileSync(join(dir, original.file))
    writeFileSync(join(photos, `${id}.${ext}`), buffer)

    // 当前背景如果和原图不是同一个文件，说明它是一张裁剪结果
    let cropAt = null
    const currentBg = backgrounds[0]
    if (currentBg && currentBg.file !== original.file) {
      writeFileSync(join(photos, `${id}.crop.jpg`), readFileSync(join(dir, currentBg.file)))
      cropAt = meta?.at ?? new Date().toISOString()
    }

    const lib = {
      version: 1,
      currentId: id,
      items: [
        {
          id,
          at: meta?.at ?? new Date().toISOString(),
          bytes: buffer.length,
          mime: meta?.sourceMime ?? meta?.mime ?? 'image/jpeg',
          ext,
          file: `photos/${id}.${ext}`,
          cropAt,
          cropBytes: 0,
          cropMime: null,
        },
      ],
    }
    writeFileSync(libraryFile(dir), JSON.stringify(lib, null, 2))
    for (const file of readdirSync(dir)) {
      if (file === 'photos' || file === 'library.json' || file.startsWith('.library')) continue
      if (
        file.startsWith('background-') ||
        file.startsWith('source-') ||
        file.startsWith('.upload-') ||
        file === 'meta.json'
      ) {
        try {
          unlinkSync(join(dir, file))
        } catch {
          /* ignore */
        }
      }
    }
    return restore(dir)
  } catch {
    return null
  }
}

function readMeta(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  } catch {
    return null
  }
}

function statAt(path) {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}

/* ── 小工具 ───────────────────────────────────────────────────────── */

function newToken() {
  return randomBytes(9).toString('base64url')
}

function sameToken(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false
  if (given.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  } catch {
    return false
  }
}

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' }
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString('latin1', 0, 6) === 'GIF87a' || buffer.toString('latin1', 0, 6) === 'GIF89a')
  ) {
    return { ext: 'gif', mime: 'image/gif' }
  }
  return null
}

async function readBody(req, res) {
  const chunks = []
  let total = 0
  let overflow = false
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      if (overflow) return
      total += chunk.length
      if (total > MAX_BYTES) {
        overflow = true
        chunks.length = 0
        sendJson(res, 413, { ok: false, error: 'TOO_LARGE', maxBytes: MAX_BYTES })
        req.destroy()
        resolve()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', resolve)
    req.on('error', reject)
  })
  if (overflow) return null
  if (total === 0) {
    sendJson(res, 400, { ok: false, error: 'EMPTY' })
    return null
  }
  return Buffer.concat(chunks, total)
}

/* 读取小 JSON 请求体；超限/空体时已经回过响应，返回 null。 */
async function readJson(req) {
  const chunks = []
  let total = 0
  let overflow = false
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      if (overflow) return
      total += chunk.length
      if (total > 64 * 1024) {
        overflow = true
        chunks.length = 0
        resolve()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', resolve)
    req.on('error', reject)
  })
  if (overflow || total === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8'))
  } catch {
    return null
  }
}

function queryValue(req, key) {
  try {
    const url = new URL(req.url ?? '/', 'http://local')
    return url.searchParams.get(key)
  } catch {
    return null
  }
}

function serveImage(req, res, buffer, mime) {
  res.statusCode = 200
  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Length', String(buffer.length))
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'HEAD') return res.end()
  res.end(buffer)
}

function lanAddresses() {
  const found = []
  const nets = networkInterfaces()
  for (const [iface, list] of Object.entries(nets)) {
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (info.address.startsWith('169.254.')) continue // 链路本地地址，手机连不上
      found.push({ iface, address: info.address, score: scoreAddress(iface, info.address) })
    }
  }
  found.sort((a, b) => b.score - a.score)
  return found.map(({ iface, address }) => ({ iface, address }))
}

function scoreAddress(iface, address) {
  let score = 0
  if (address.startsWith('192.168.')) score += 40
  else if (address.startsWith('10.')) score += 30
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 20
  if (/^(en0|en1|wlan0|eth0)$/.test(iface)) score += 10
  if (/^(utun|awdl|llw|bridge|vmnet|vmenet)/.test(iface)) score -= 50
  return score
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

function sendText(res, status, body) {
  if (res.writableEnded) return
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow)
  sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' })
}
