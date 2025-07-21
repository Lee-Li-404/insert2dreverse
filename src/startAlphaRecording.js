let recorder,
  recordedChunks = [];

/**
 * 启动带 Alpha 通道的视频录制
 * @param {THREE.WebGLRenderer} renderer - Three.js 渲染器
 * @param {number} durationSeconds - 录制时长（秒）
 * @param {number} fps - 每秒帧数
 */
export function startRecording(renderer, durationSeconds = 5, fps = 30) {
  const canvas = renderer.domElement;
  const stream = canvas.captureStream(fps);

  const mimeType = "video/webm;codecs=vp9"; // ✅ 使用 VP9 编码支持透明

  // 检查浏览器是否支持此编码格式
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    console.error(`❌ 你的浏览器不支持 ${mimeType}`);
    return;
  }

  recorder = new MediaRecorder(stream, { mimeType });

  recordedChunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "threejs-alpha-vp9.webm";
    a.click();
    console.log("✅ 录制完成，已下载");
  };

  recorder.start();
  console.log("🎥 已开始透明背景录制 (VP9)...");

  setTimeout(() => {
    recorder.stop();
  }, durationSeconds * 1000);
}
