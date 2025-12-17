// DOM要素の取得
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const originalVideo = document.getElementById('originalVideo');
const reversedVideo = document.getElementById('reversedVideo');
const videoContainer = document.getElementById('videoContainer');
const reversedVideoContainer = document.getElementById('reversedVideoContainer');
const reverseBtn = document.getElementById('reverseBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const status = document.getElementById('status');
const mobileHint = document.getElementById('mobileHint');
const openVideoLink = document.getElementById('openVideoLink');

let originalVideoBlob = null;
let reversedVideoBlob = null;

// ファイルアップロード処理
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        alert('動画ファイルを選択してください。');
        return;
    }

    // ファイルサイズチェック（50MB制限）
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        alert('ファイルサイズが大きすぎます。50MB以下の動画ファイルを選択してください。');
        return;
    }

    originalVideoBlob = null;
    reversedVideoBlob = null;
    reversedVideoContainer.style.display = 'none';
    downloadBtn.disabled = true;
    reverseBtn.disabled = false;

    const url = URL.createObjectURL(file);
    originalVideo.src = url;
    videoContainer.style.display = 'block';
    originalVideoBlob = file;

    status.textContent = '動画を読み込みました。逆回転動画を生成できます。';
}

// 逆回転動画の生成
reverseBtn.addEventListener('click', async () => {
    if (!originalVideoBlob) {
        alert('先に動画ファイルをアップロードしてください。');
        return;
    }

    reverseBtn.disabled = true;
    progressContainer.classList.add('active');
    status.textContent = 'サーバーで逆回転処理を行っています...';
    updateProgress(10);

    try {
        // サーバーに動画を送信して逆回転してもらう
        const formData = new FormData();
        formData.append('video', originalVideoBlob);

        const response = await fetch('/api/reverse', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            // エラーレスポンスからメッセージを取得
            let errorMessage = 'サーバー側でエラーが発生しました（HTTP ' + response.status + '）';
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // JSON解析に失敗した場合はデフォルトメッセージを使用
            }
            throw new Error(errorMessage);
        }

        updateProgress(70);
        
        // サーバーからJSONレスポンスを取得
        const data = await response.json();
        const videoUrl = data.videoUrl;
        
        // 動画を表示
        reversedVideo.src = videoUrl;
        reversedVideoContainer.style.display = 'block';
        downloadBtn.disabled = false;
        reverseBtn.disabled = false;
        progressContainer.classList.remove('active');
        updateProgress(100);
        status.textContent = '逆回転動画の生成が完了しました！（長さは元動画と同じです）';
        
        // 動画URLを保存（ダウンロード用）
        reversedVideoBlob = videoUrl;
        
        // スマートフォンの場合、動画専用ページを開くリンクを設定
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            const videoId = videoUrl.split('/').pop();
            const videoPageUrl = `/video.html?id=${videoId}`;
            openVideoLink.href = videoPageUrl;
            mobileHint.style.display = 'block';
        } else {
            mobileHint.style.display = 'none';
        }

    } catch (error) {
        console.error('エラーが発生しました:', error);
        alert('動画の処理中にエラーが発生しました: ' + error.message);
        reverseBtn.disabled = false;
        progressContainer.classList.remove('active');
        status.textContent = 'エラーが発生しました。';
    }
});

// ダウンロード処理（スマートフォン対応）
downloadBtn.addEventListener('click', () => {
    if (!reversedVideoBlob) {
        alert('逆回転動画が生成されていません。');
        return;
    }

    // スマートフォンの検出
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        // スマートフォンの場合：動画専用ページを新しいタブで開く
        const videoId = reversedVideoBlob.split('/').pop();
        const videoPageUrl = `/video.html?id=${videoId}`;
        openVideoLink.href = videoPageUrl;
        
        // リンクをクリックして新しいタブで開く
        openVideoLink.click();
        
        // ヒントを表示
        reversedVideoContainer.style.display = 'block';
        mobileHint.style.display = 'block';
        
        // スクロールして動画が見えるようにする
        reversedVideoContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // PCの場合：通常のダウンロード
        const a = document.createElement('a');
        a.href = reversedVideoBlob;
        a.download = 'reversed_video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});

// プログレスバーの更新
function updateProgress(percent) {
    progressFill.style.width = percent + '%';
    progressFill.textContent = Math.round(percent) + '%';
}

