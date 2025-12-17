const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// uploadsディレクトリが存在しない場合は作成
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// アップロード先（テンポラリ）
// ファイルサイズ制限: 100MB（Herokuのメモリ制限を考慮）
const upload = multer({ 
  dest: uploadsDir,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// 静的ファイル配信（index.html, app.js など）
app.use(express.static(__dirname));

// リクエストタイムアウト設定（5分）
const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5分

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが大きすぎます。100MB以下にしてください。' });
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

  // ffmpeg コマンド: 映像と音声を逆再生（メモリ効率を改善）
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vf', 'reverse',
    '-af', 'areverse',
    '-threads', '2', // スレッド数を制限してメモリ使用量を抑制
    '-preset', 'ultrafast', // 高速エンコード（メモリ使用量を削減）
    '-crf', '28', // 品質を少し下げてファイルサイズとメモリ使用量を削減
    '-movflags', '+faststart', // ストリーミング最適化
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

    isResponseSent = true;

    // 生成されたファイルを返す
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="reversed_video.mp4"');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: 'ファイルの送信に失敗しました。' });
      }
    });

    stream.on('close', () => {
      cleanup();
    });

    res.on('close', () => {
      cleanup();
    });
  });
});

app.listen(port, () => {
  console.log(`Reverse video server listening at http://localhost:${port}`);
});


