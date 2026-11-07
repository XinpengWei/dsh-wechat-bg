/**
 * 手机端上传页。整页是静态 HTML，token 从 location.pathname 推导，
 * 因此不需要在服务端做任何字符串拼装。
 */
export const PHONE_PAGE = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#f2f5f4">
<meta name="format-detection" content="telephone=no">
<title>DSH 背景图</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;min-height:100%}
  body{
    font:16px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
    color:#12201b;
    background:#f2f5f4;
    background-image:radial-gradient(120% 50% at 50% 0%,#dff3e8 0%,rgba(242,245,244,0) 70%);
    background-repeat:no-repeat;
  }
  .app{
    max-width:560px;margin:0 auto;
    padding:calc(28px + env(safe-area-inset-top)) 20px calc(32px + env(safe-area-inset-bottom));
  }
  header{display:flex;align-items:center;gap:12px;margin-bottom:22px}
  .mark{
    width:46px;height:46px;border-radius:14px;flex:none;
    background:linear-gradient(145deg,#12d06a,#068a4b);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 16px rgba(7,193,96,.28);
  }
  .mark svg{width:26px;height:26px;display:block}
  h1{font-size:19px;line-height:1.2;margin:0 0 4px;letter-spacing:.2px}
  header p{margin:0;font-size:12.5px;color:#6c7d76}
  .card{
    background:#fff;border-radius:20px;padding:16px;
    box-shadow:0 1px 2px rgba(18,32,27,.05),0 12px 32px rgba(18,32,27,.07);
    margin-bottom:16px;
  }
  .hide{display:none !important}
  #choose{
    width:100%;border:1.5px dashed #bccdc5;background:#fbfdfc;border-radius:16px;
    padding:32px 16px;display:flex;flex-direction:column;align-items:center;gap:10px;
    font:inherit;color:inherit;cursor:pointer;
  }
  #choose:active{background:#f2faf6;border-color:#07c160}
  .pickIcon{
    width:58px;height:58px;border-radius:50%;background:#e7f7ee;
    display:flex;align-items:center;justify-content:center;
  }
  .pickIcon svg{width:30px;height:30px;display:block}
  #choose strong{font-size:16px;font-weight:600}
  #choose span{font-size:12.5px;color:#7b8a84}
  .shotWrap{border-radius:16px;overflow:hidden;background:#eef2f1;aspect-ratio:4/3}
  #shot{width:100%;height:100%;object-fit:cover;display:block}
  .meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#7b8a84;padding:10px 2px 14px}
  .row{display:flex;gap:10px}
  button{font:inherit;border:0;cursor:pointer;border-radius:13px;padding:0 18px;height:46px}
  button:disabled{opacity:.55}
  .primary{flex:1;background:#07c160;color:#fff;font-weight:600;box-shadow:0 6px 18px rgba(7,193,96,.25)}
  .primary:active{background:#06ad56}
  .ghost{background:#eff3f1;color:#24352e;font-weight:500}
  .ghost:active{background:#e4eae7}
  .progress{height:6px;border-radius:3px;background:#e7eeeb;overflow:hidden;margin-top:14px}
  .progress i{display:block;height:100%;width:0%;border-radius:3px;background:linear-gradient(90deg,#07c160,#37dd8c);transition:width .18s ease}
  #hint{min-height:20px;margin:12px 2px 0;font-size:13px;color:#a83a2a;text-align:center}
  #hint.ok{color:#07834a}
  #done{text-align:center;padding:28px 18px}
  .check{
    width:58px;height:58px;border-radius:50%;margin:0 auto 14px;
    background:#07c160;color:#fff;display:flex;align-items:center;justify-content:center;
    font-size:30px;line-height:1;box-shadow:0 8px 22px rgba(7,193,96,.32);
  }
  #done h2{font-size:18px;margin:0 0 6px}
  #done p{margin:0 0 20px;font-size:13px;color:#6c7d76}
  #done .ghost{width:100%}
  .foot{text-align:center;font-size:12px;color:#8c9a94;margin:22px 0 0}
  .warn{margin:0 0 16px;padding:11px 14px;border-radius:12px;background:#fff4e5;color:#8a5a12;font-size:12.5px}
  @media (prefers-color-scheme: dark){
    /* 微信内深色模式下保持浅色卡片，避免白底黑字失效 */
  }
</style>
</head>
<body>
<main class="app">
  <header>
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="3"></rect>
        <path d="M8.5 12.5l2.2 2.2 4.8-4.8"></path>
        <path d="M3 9.5h2M19 14.5h2"></path>
      </svg>
    </div>
    <div>
      <h1>DSH 背景图</h1>
      <p>选一张手机里的照片，电脑上立刻换背景</p>
    </div>
  </header>

  <div class="card" id="pick">
    <input id="file" type="file" accept="image/*" hidden>
    <button id="choose" type="button">
      <span class="pickIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#07c160" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-2h4.4l1.2 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"></path>
          <circle cx="12" cy="12.5" r="3.4"></circle>
        </svg>
      </span>
      <strong>从相册选择照片</strong>
      <span>支持 JPG / PNG / WebP，上传前自动压缩</span>
    </button>
  </div>

  <div class="card hide" id="preview">
    <div class="shotWrap"><img id="shot" alt="照片预览"></div>
    <div class="meta"><span id="info">—</span><span>自动压到长边 2560</span></div>
    <div class="row">
      <button class="ghost" id="reselect" type="button">重新选择</button>
      <button class="primary" id="upload" type="button">设为 DSH 背景</button>
    </div>
    <div class="progress hide" id="progress"><i id="bar"></i></div>
  </div>

  <div class="card hide" id="done">
    <div class="check" aria-hidden="true">✓</div>
    <h2>已经换好了</h2>
    <p>回到电脑上的 DSH 看一眼，背景就在那里。</p>
    <button class="ghost" id="again" type="button">再传一张</button>
  </div>

  <p id="hint" role="status" aria-live="polite"></p>
  <p class="foot">手机和电脑需要连接同一个 Wi-Fi</p>
</main>
<script>
(function () {
  var pick = document.getElementById('pick');
  var preview = document.getElementById('preview');
  var doneCard = document.getElementById('done');
  var fileInput = document.getElementById('file');
  var choose = document.getElementById('choose');
  var shot = document.getElementById('shot');
  var info = document.getElementById('info');
  var hint = document.getElementById('hint');
  var progress = document.getElementById('progress');
  var bar = document.getElementById('bar');
  var upload = document.getElementById('upload');
  var reselect = document.getElementById('reselect');
  var again = document.getElementById('again');
  var picture = null;
  var uploading = false;

  function setHint(text, ok) {
    hint.textContent = text || '';
    hint.className = ok ? 'ok' : '';
  }

  function reset() {
    picture = null;
    uploading = false;
    fileInput.value = '';
    shot.removeAttribute('src');
    upload.disabled = false;
    reselect.disabled = false;
    progress.className = 'progress hide';
    bar.style.width = '0%';
    doneCard.className = 'card hide';
    preview.className = 'card hide';
    pick.className = 'card';
    setHint('');
    document.title = 'DSH 背景图';
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('读不出这张照片，换一张试试')); };
      img.src = url;
    });
  }

  function prepare(file) {
    if (!file || !/^image\//.test(file.type)) {
      return Promise.reject(new Error('请选择一张图片'));
    }
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('读不出这张照片的尺寸，换一张试试');
      var scale = Math.min(1, 2560 / Math.max(w, h));
      var outW = Math.max(1, Math.round(w * scale));
      var outH = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器不支持图片处理，请用系统相机重拍');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, outW, outH);
      var data = canvas.toDataURL('image/jpeg', 0.72);
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve({ blob: blob, data: data, width: outW, height: outH, type: 'image/jpeg' });
        }, 'image/jpeg', 0.86);
      });
    }).then(function (result) {
      if (!result.blob) throw new Error('照片压缩失败，换一张试试');
      return result;
    });
  }

  function pickFile(file) {
    if (!file) return;
    setHint('正在处理照片…');
    choose.disabled = true;
    prepare(file).then(function (result) {
      picture = result;
      shot.src = result.data;
      info.textContent = result.width + ' × ' + result.height + ' · ' + Math.max(1, Math.round(result.blob.size / 1024)) + ' KB';
      pick.className = 'card hide';
      preview.className = 'card';
      doneCard.className = 'card hide';
      setHint('');
    }).catch(function (err) {
      setHint(err && err.message ? err.message : '处理失败，请换一张');
    }).then(function () {
      choose.disabled = false;
      fileInput.value = '';
    });
  }

  choose.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { pickFile(fileInput.files && fileInput.files[0]); });
  reselect.addEventListener('click', function () { fileInput.click(); });
  again.addEventListener('click', reset);
  shot.addEventListener('click', function () { fileInput.click(); });

  upload.addEventListener('click', function () {
    if (!picture || uploading) return;
    uploading = true;
    upload.disabled = true;
    reselect.disabled = true;
    progress.className = 'progress';
    bar.style.width = '0%';
    setHint('正在上传…');

    var path = location.pathname.replace(/\/+$/, '');
    var xhr = new XMLHttpRequest();
    xhr.open('POST', path + '/upload', true);
    xhr.timeout = 120000;
    xhr.setRequestHeader('Content-Type', picture.type);
    xhr.upload.onprogress = function (event) {
      if (!event.lengthComputable) return;
      bar.style.width = Math.max(2, Math.round((event.loaded / event.total) * 100)) + '%';
    };
    xhr.onload = function () {
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
      if (xhr.status === 200 && data && data.ok) {
        uploading = false;
        progress.className = 'progress hide';
        preview.className = 'card hide';
        doneCard.className = 'card';
        setHint('');
        document.title = '已设置';
        return;
      }
      fail(describe(data, xhr.status));
    };
    xhr.onerror = function () { fail('网络中断了，请确认手机和电脑在同一个 Wi-Fi'); };
    xhr.ontimeout = function () { fail('上传超时，请再试一次'); };
    xhr.send(picture.blob);

    function fail(message) {
      uploading = false;
      upload.disabled = false;
      reselect.disabled = false;
      progress.className = 'progress hide';
      setHint(message);
    }
  });

  function describe(data, status) {
    if (data && data.error === 'TOO_LARGE') return '照片太大了，请换一张小一点的';
    if (data && data.error === 'UNSUPPORTED_TYPE') return data.message || '不支持这种图片格式';
    if (data && data.message) return data.message;
    if (status === 404) return '链接已失效，请在电脑上刷新二维码';
    if (status === 413) return '照片太大，换一张小一点的';
    return '上传失败（' + status + '），请重试';
  }
})();
</script>
</body>
</html>`
