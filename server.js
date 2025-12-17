const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// uploadsディレクトリが存在しない場合は作成
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 一時保存用の動画ディレクトリを作成
const videosDir = path.join(__dirname, 'public', 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// アップロード先（テンポラリ）
// ファイルサイズ制限: 50MB（Herokuのメモリ制限を考慮）
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const upload = multer({ 
  dest: uploadsDir,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// 静的ファイル配信（index.html, app.js など）
app.use(express.static(__dirname));

// 動画ダウンロード専用エンドポイント（スマートフォン対応）
// 注意：より具体的なルートなので、/api/video/:id より前に定義する必要がある
app.get('/api/video/:id/download', (req, res) => {
  const videoId = req.params.id;
  const videoPath = path.join(videosDir, `${videoId}.mp4`);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: '動画が見つかりません。' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="reversed_video.mp4"');
  res.setHeader('Content-Length', fileSize);
  
  const stream = fs.createReadStream(videoPath);
  stream.pipe(res);

  stream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '動画の配信に失敗しました。' });
    }
  });
});

// 動画ファイルの配信エンドポイント（Rangeリクエスト対応）
app.get('/api/video/:id', (req, res) => {
  const videoId = req.params.id;
  // ID からパスを直接構成（メモリ上の管理情報に依存しない）
  const videoPath = path.join(videosDir, `${videoId}.mp4`);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: '動画が見つかりません。' });
  }
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Rangeリクエストに対応（スマートフォンでのストリーミングに必要）
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // Rangeリクエストがない場合は全体を返す
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': 'inline; filename="reversed_video.mp4"',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// リクエストタイムアウト設定（5分）
const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5分

  // エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます。50MB以下にしてください。' });
    }
    return res.status(400).json({ error: 'ファイルアップロードエラー: ' + err.message });
  }
  next(err);
});

// 逆回転API
app.post('/api/reverse', upload.single('video'), (req, res) => {
  // タイムアウト設定
  req.setTimeout(REQUEST_TIMEOUT);
  res.setTimeout(REQUEST_TIMEOUT);

  if (!req.file) {
    return res.status(400).json({ error: '動画ファイルが送信されていません。' });
  }

  const inputPath = req.file.path;
  const outputPath = inputPath + '_reversed.mp4';
  let isResponseSent = false;

  // クリーンアップ関数
  const cleanup = () => {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  };

  // エラーレスポンス送信関数
  const sendError = (statusCode, message) => {
    if (!isResponseSent) {
      isResponseSent = true;
      cleanup();
      res.status(statusCode).json({ error: message });
    }
  };

  // タイムアウト処理
  const timeout = setTimeout(() => {
    sendError(504, '処理がタイムアウトしました。動画が大きすぎる可能性があります。');
    if (ffmpeg && !ffmpeg.killed) {
      ffmpeg.kill('SIGKILL');
    }
  }, REQUEST_TIMEOUT - 10000); // タイムアウトの10秒前に処理

  // ffmpeg コマンド: 映像と音声を逆再生（メモリ効率を最大限に改善）
  // 解像度を720p以下に制限、動画長を30秒に制限してメモリ使用量を削減
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-t', '30', // 最大30秒まで処理（メモリ使用量を制限）
    '-vf', 'scale=720:-2:flags=lanczos,reverse', // 解像度を720pに制限してから逆再生
    '-af', 'areverse',
    '-threads', '1', // スレッド数を1に制限（メモリ使用量を最小化）
    '-preset', 'ultrafast', // 高速エンコード（メモリ使用量を削減）
    '-crf', '30', // 品質を下げてファイルサイズとメモリ使用量を削減
    '-movflags', '+faststart', // ストリーミング最適化
    '-max_muxing_queue_size', '1024', // キューサイズを制限
    outputPath,
  ]);

  let ffmpegError = '';

  ffmpeg.stderr.on('data', (data) => {
    const errorMsg = data.toString();
    ffmpegError += errorMsg;
    console.error(errorMsg);
  });

  ffmpeg.on('error', (err) => {
    console.error('ffmpeg spawn error:', err);
    clearTimeout(timeout);
    sendError(500, 'FFmpegの起動に失敗しました。');
  });

  ffmpeg.on('close', (code) => {
    clearTimeout(timeout);

    if (code !== 0) {
      console.error('ffmpeg failed with code', code, ffmpegError);
      sendError(500, '動画の処理に失敗しました。ファイル形式やサイズを確認してください。');
      return;
    }

    if (isResponseSent) {
      cleanup();
      return;
    }

    // 出力ファイルの存在確認
    if (!fs.existsSync(outputPath)) {
      sendError(500, '出力ファイルが生成されませんでした。');
      return;
    }

    // 一意のIDを生成し、動画ファイルを一時保存ディレクトリにコピー
    const videoId = crypto.randomUUID();
    const savedVideoPath = path.join(videosDir, `${videoId}.mp4`);
    fs.copyFileSync(outputPath, savedVideoPath);

    isResponseSent = true;

    // 動画のURLを返す
    const videoUrl = `/api/video/${videoId}`;
    res.json({
      videoUrl,
      message: '逆回転動画が生成されました。'
    });

    // 入力・中間ファイルは削除（最終ファイルは videosDir に保存済み）
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });
});

app.listen(port, () => {
  console.log(`Reverse video server listening at http://localhost:${port}`);
});


