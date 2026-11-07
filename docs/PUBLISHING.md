# 发布到 DSH 插件市场

市场本体（dsh-market）本身不存插件条目：它实时读 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的精选列表，列表的数据源是仓库里的 `data/plugins/<owner>__<repo>.yml`。所以「上架」= 一次给那个仓库提的 PR，一个文件。

## 0. 这个目录从哪来

`dsh-wechat-bg-publish/` 是 `scripts/make-release.mjs` 生成的发布副本，和开发目录（profile 里 link 安装的那个）的区别只有三处：

- 包名 `@local/dsh-wechat-bg` → `dsh-wechat-bg`（npm 上查过，2026-11 时没人占用）；
- 去掉 `"private": true`，补 `license` / `repository` / `homepage` / `keywords`；
- `client.js` 的模块 id 和 `cordis.patch.yml` 的 `name` 跟着改成新包名（这两处必须和 `package.json` 完全一致，否则客户端加载不到）。

重新生成（改完开发目录后）：

```sh
cd dsh-wechat-bg
RELEASE_OWNER=你的GitHub用户名 node scripts/make-release.mjs
```

不设 `RELEASE_OWNER` 时 `repository` 和 LICENSE 里会留 `OWNER` 占位符，推 GitHub 前记得替换。

## 1. 推上 GitHub

```sh
cd dsh-wechat-bg-publish
git init -b main
git add -A
git commit -m "feat: WeChat QR background for DSH"
git remote add origin git@github.com:<owner>/dsh-wechat-bg.git
git push -u origin main
```

然后在仓库页 Settings → Topics 加一个 `dsh-plugin`。列表的 CI 会检查这个 topic，也检查仓库**创建满 1 天**、`package.json` 里有 `dsh.bundle`（本仓库已有 `{"patch":"./cordis.patch.yml"}`）。

## 2. 发 npm（可选，但推荐）

发了 npm，市场安装可以跳过「从源码构建 + allowBuilds 授权」这一步，还能显示下载量。这个插件零依赖、没有构建脚本，`npm publish` 发上去的就是能直接跑的文件。

```sh
npm login
npm publish        # 包名 dsh-wechat-bg，需要 npm 账号里这个 scope 没被别人占
```

`repository` 字段必须指回第 1 步那个仓库，否则 npm 包和列表条目不会关联（这一条是 CI 之外市场自己配对的，不用在 yml 里写 `npm:`，写了会被校验拒绝）。

不想发 npm 也行：仓库能直接装，只是用户会走源码安装。

## 3. 提 PR 上架

在 awesome-dsh-plugin 仓库新建 `data/plugins/<owner>__dsh-wechat-bg.yml`：

```yaml
url: https://github.com/<owner>/dsh-wechat-bg
name: <owner>/dsh-wechat-bg
category: ui
description:
  en: Scan a QR code with WeChat, upload a photo from the phone, and use it as the DSH Web UI background.
  zh: 手机微信扫码，从相册传一张照片，换成 DSH 的全屏背景。
icon: https://raw.githubusercontent.com/<owner>/dsh-wechat-bg/main/assets/icon-180.png
```

要点：

- 文件名 `<owner>__<repo>.yml`，`url` 必须和仓库地址完全一致；`name` 是列表里显示的链接文字。
- `category` 选贴合实际功能的那个。这个插件改的是 DSH 的外观（全屏背景），用 `ui`；主题/皮肤类才放 `theme`，这里是功能型 UI，不是主题包。
- `description.en` 必填，`zh` 可选；**描述会被拿去和代码对**，别写「N 个接口」「支持 XX」之类代码里没有的话。冒号加空格时整行要加引号。
- `icon` 只能是 **GitHub 托管的位图**（png/jpg/webp，~96px 显示），SVG 和第三方图床会被拒。仓库里已经放了 `assets/icon-180.png`。
- 一个 PR 最多 3 条条目；改自己那条就只动自己那个 yml，不要手改生成的 README。

PR 提完由 CI 先跑（条目数 → `dsh.bundle` → 仓库年龄 → awesome-lint / 站点构建），再人工读代码。CI 红了就同一分支推修复，不用重开。

## 4. 以后更新

改开发目录 → `RELEASE_OWNER=... node scripts/make-release.mjs` → 把改动同步进 git 仓库 → 改 `version` 后 `npm publish`。列表条目不用动（除非改描述、换分类、改 icon 路径）。市场里的更新检测直接比 npm 版本或仓库 HEAD。

## 5. 截图（可选）

想控制市场详情页的截图，在仓库根放 `screenshots.json`，列 1–8 个仓库内的相对路径：

```json
["assets/screenshot-1.png", "assets/screenshot-2.png"]
```

不写的话市场会从 README 里自动抓图。
