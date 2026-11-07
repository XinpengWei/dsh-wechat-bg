# 发布到插件市场 · 对照清单

7 步，约 15 分钟。做完一条勾一条。

---

## A. 收拾仓库（3 步，都在你已上传的仓库里改）

- [ ] **1. 改 `package.json` 里的两处 `OWNER`**
  打开 <https://github.com/XinpengWei/dsh-wechat-bg/edit/main/package.json>
  第 42 行 `"url": "git+https://github.com/OWNER/dsh-wechat-bg.git"`、第 44 行 `"homepage": "https://github.com/OWNER/dsh-wechat-bg#readme"`，把 `OWNER` 换成 `XinpengWei` → **Commit changes**。

- [ ] **2. 改 `LICENSE` 的版权人**
  打开 <https://github.com/XinpengWei/dsh-wechat-bg/edit/main/LICENSE>
  第 3 行 `Copyright (c) 2026 OWNER` → `Copyright (c) 2026 XinpengWei`。

- [ ] **3. 加 topic `dsh-plugin`**
  仓库首页右侧 **About** 卡片，点那行右侧的**齿轮**（Edit repository details）→ Topics 输入 `dsh-plugin` 回车 → **Save changes**。
  > Topics 不在 Settings 里。窗口太窄时右侧栏会折叠，把窗口拉宽或点 About 区域展开。

---

## B. 提交条目（3 步，在榜单仓库做）

- [ ] **4. Fork 榜单仓库**
  <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> → 右上 **Fork** → **Create fork**。
  只做一次，以后更新都在这份 fork 上。

- [ ] **5. 在 fork 里新建 yml**
  <https://github.com/XinpengWei/awesome-dsh-plugin/new/main?filename=data/plugins/XinpengWei__dsh-wechat-bg.yml>
  路径必须是 `data/plugins/XinpengWei__dsh-wechat-bg.yml`（两个下划线），内容整段粘贴：

```yaml
url: https://github.com/XinpengWei/dsh-wechat-bg
name: XinpengWei/dsh-wechat-bg
category: ui
description:
  en: Scan a QR code with WeChat, upload a photo from the phone, and use it as the DSH Web UI background.
  zh: 手机微信扫码，从相册传一张照片，换成 DSH 的全屏背景。
icon: https://raw.githubusercontent.com/XinpengWei/dsh-wechat-bg/main/assets/icon-180.png
```

  点 **Commit changes**。

- [ ] **6. 开 Pull Request**
  回到 fork 首页，顶部黄色提示条 → **Compare & pull request** → 标题 `Add dsh-wechat-bg` → **Create pull request**。
  （PR = 向榜单仓库提交“请把我这个文件合并进去”的请求，你不是直接改别人的仓库。）

---

## C. 等结果（1 步）

- [ ] **7. 等 CI 跑完**
  PR 页面底部会列出检查项。**“仓库满 1 天”这一项现在一定红**，因为仓库是今天建的——这是预期内的，24 小时后自动重跑，不用手动点。
  其余红项会写清原因（多半是 topic 没加、`dsh.bundle` 不在、icon 不是位图），在同一个分支改完推一次即可，**不用重开 PR**。

---

## 提完之后

1. CI 全绿 → 维护者 review → Merge。
2. 网站 <https://awesome-dsh-plugin.com> 与市场列表会自动重建，你的插件出现在「界面 / UI」分类里。
3. 用户从市场安装时用的是 GitHub 仓库源码；将来更新只要往 `main` 推提交，市场会跟着刷新（yml 不用改）。

## 两个坑

- **本机已装开发版**：市场版和开发版都声明了 cordis 行 id `wechat-bg`，同时存在会冲突。装市场版前先卸掉开发版。
- **别再手动改 README 的插件列表**：榜单仓库的 README 由脚本生成，手改会在 CI 里被覆盖或报错。
