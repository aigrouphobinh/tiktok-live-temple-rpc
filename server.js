const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
// The package explicitly exports ./package.json; use it for a reliable
// installed-version diagnostic instead of depending on an undocumented VERSION export.
const TIKTOK_CONNECTOR_VERSION = require('tiktok-live-connector/package.json').version;
const { normalizeGiftPayload, getGiftComboDelta, clearGiftComboTracker } = require('./lib/tiktok-gift-payload.cjs');
const { formatTikTokConnectionError } = require('./lib/tiktok-connection-error.cjs');
const { classifyTempleComment } = require('./lib/temple-comment-parser.cjs');
const { normalizeTempleSettings } = require('./lib/temple-settings.cjs');
const { buildEffectTestPayload } = require('./lib/effect-test-presets.cjs');
const { BoundedSerialQueue } = require('./lib/bounded-serial-queue.cjs');

const PORT = process.env.PORT || 3000;
// Listen on all interfaces so devices on the same LAN can open the live/OBS page.
// Set HOST=127.0.0.1 to restrict access to this computer only. Do not expose this
// unauthenticated RPC service directly to the public internet.
const HOST = process.env.HOST || '0.0.0.0';

function getLanIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  return Object.values(interfaces).flat().filter((item) =>
    item && item.family === 'IPv4' && !item.internal
  ).map((item) => item.address);
}
const ALLOWED_CORS_ORIGINS = new Set(
  String(process.env.TEMPLE_CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);

function isAllowedRequestOrigin(origin, request) {
  if (!origin) return true;
  if (ALLOWED_CORS_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    const expectedHost = String(request.headers.host || '').toLowerCase();
    const forwardedProtocol = String(request.headers['x-forwarded-proto'] || request.protocol || 'http')
      .split(',')[0].trim().toLowerCase();
    return parsed.host.toLowerCase() === expectedHost && parsed.protocol === `${forwardedProtocol}:`;
  } catch (_) {
    return false;
  }
}
const DATA_DIR = path.resolve(process.env.TEMPLE_DATA_DIR || path.join(__dirname, 'data'));
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. BỘ 18 QUẺ LINH XĂM CHÙA LINH ỨNG (FORTUNE STICKS DECK)
// ============================================================================
const FORTUNE_DECK = [
  {
    number: 1,
    rank: 'Thượng Thượng Cát',
    title: 'Nhật Xuất Đông Phương — Mặt Trời Mọc Phương Đông',
    poem: 'Đông phương nhật xuất chiếu Càn Khôn\nHoa nở đầy cành rạng sắc xuân\nCông danh tài lộc đều viên mãn\nGia đạo bình an phúc lộc tồn.',
    meaning: 'Mọi sự mưu cầu đều đại cát đại lợi. Công việc hanh thông, quý nhân phù trợ, gia đình hòa thuận ấm êm.',
    ttsSummary: 'Quẻ số 1, Thượng Thượng Cát, Nhật Xuất Đông Phương. Mọi sự mưu cầu đều đại cát đại lợi, công danh tài lộc viên mãn, quý nhân phù trợ.'
  },
  {
    number: 8,
    rank: 'Thượng Cát',
    title: 'Kim Liên Khai Nở — Sen Vàng Tỏa Ngát',
    poem: 'Sen vàng nở rộ giữa hồ trong\nHương thơm lan tỏa khắp non sông\nLòng thành thắp nén nhang cầu nguyện\nTrời Phật chứng tri thỏa ước mong.',
    meaning: 'Tâm thiện lành ắt gặp phước báu. Cầu tài đắc tài, cầu bình an đắc bình an, bệnh tật tiêu trừ.',
    ttsSummary: 'Quẻ số 8, Thượng Cát, Kim Liên Khai Nở. Tâm thiện lành ắt gặp phước báu, cầu tài đắc tài, cầu bình an đắc bình an.'
  },
  {
    number: 12,
    rank: 'Đại Cát',
    title: 'Long Vân Tương Hội — Rồng Mây Gặp Gỡ',
    poem: 'Rồng thiêng gặp hội tầng mây xanh\nVượt Vũ Môn Quan rạng rỡ danh\nThí chủ kiên tâm hành thiện đạo\nPhúc dày lộc vượng khắp gia đình.',
    meaning: 'Thời vận đang lên mạnh mẽ. Thi cử đỗ đạt, kinh doanh phát đạt, gặp cơ hội lớn đổi đời.',
    ttsSummary: 'Quẻ số 12, Đại Cát, Long Vân Tương Hội. Thời vận đang lên mạnh mẽ, thi cử đỗ đạt, kinh doanh phát đạt.'
  },
  {
    number: 18,
    rank: 'Thượng Cát',
    title: 'Xuân Phong Đắc Ý — Gió Xuân Thuận Buồm',
    poem: 'Thuận buồm xuôi gió vượt trùng khơi\nBến giác bình yên nắng rạng ngời\nTài lộc dồi dào nhân duyên tốt\nBốn mùa hưng thịnh rộn niềm vui.',
    meaning: 'Đi xa gặp may, buôn bán thuận lợi, tình duyên êm đẹp, người thân mạnh khỏe.',
    ttsSummary: 'Quẻ số 18, Thượng Cát, Xuân Phong Đắc Ý. Thuận buồm xuôi gió, tài lộc dồi dào, nhân duyên tốt đẹp.'
  },
  {
    number: 24,
    rank: 'Trung Cát',
    title: 'Vũ Quá Thiên Thanh — Mưa Tạnh Trời Trong',
    poem: 'Mưa qua trời lại sáng trong ngần\nGian khó lùi xa đón phúc phần\nGiữ vững lòng thành đừng nản chí\nHoa thơm trái ngọt đến mười phân.',
    meaning: 'Khó khăn cũ sắp qua đi, vận may mới đang tới. Hãy kiên nhẫn và giữ tâm bình tĩnh.',
    ttsSummary: 'Quẻ số 24, Trung Cát, Vũ Quá Thiên Thanh. Mưa qua trời lại sáng trong, gian khó lùi xa để đón phúc phần mới.'
  },
  {
    number: 36,
    rank: 'Thượng Thượng Cát',
    title: 'Phúc Tinh Cao Chiếu — Sao Phúc Chiếu Mệnh',
    poem: 'Phúc tinh rực sáng giữa đêm rằm\nTừ bi Phật độ suốt quanh năm\nTài lộc tự nhiên về gõ cửa\nTrăm điều như ý vạn điều lành.',
    meaning: 'Sao Phúc chiếu mạng, tai qua nạn khỏi, tiền tài sung túc, gia đạo hưng long.',
    ttsSummary: 'Quẻ số 36, Thượng Thượng Cát, Phúc Tinh Cao Chiếu. Sao Phúc chiếu mạng, tài lộc tự nhiên gõ cửa, trăm điều như ý.'
  },
  {
    number: 52,
    rank: 'Thượng Cát',
    title: 'Ngọc Xuất Côn Sơn — Ngọc Quý Phát Sáng',
    poem: 'Ngọc quý Côn Sơn tỏa ánh ngời\nBấy lâu rèn giũa nay gặp thời\nTri âm tương ngộ cùng nâng đỡ\nSự nghiệp thăng hoa rạng rỡ đời.',
    meaning: 'Nỗ lực bấy lâu nay sắp được đền đáp xứng đáng. Có người tốt nâng đỡ trong công việc và cuộc sống.',
    ttsSummary: 'Quẻ số 52, Thượng Cát, Ngọc Xuất Côn Sơn. Nỗ lực bấy lâu sắp được đền đáp xứng đáng, sự nghiệp thăng hoa.'
  },
  {
    number: 68,
    rank: 'Đại Cát',
    title: 'Lộc Mã Đồng Hương — Lộc Tài Cùng Tới',
    poem: 'Lộc Mã song hành đến tận nhà\nLàm ăn buôn bán nở như hoa\nTâm thành bố thí thêm công đức\nPhú quý vinh hoa khắp một nhà.',
    meaning: 'Quẻ đại lợi về tài lộc và kinh doanh. Nên làm nhiều việc thiện để phúc đức càng thêm bền vững.',
    ttsSummary: 'Quẻ số 68, Đại Cát, Lộc Mã Đồng Hương. Đại lợi về tài lộc và buôn bán, phú quý vinh hoa khắp một nhà.'
  },
  {
    number: 81,
    rank: 'Thượng Cát',
    title: 'Nguyệt Nhập Trung Thiên — Trăng Rằm Giữa Đỉnh',
    poem: 'Trăng tròn vằng vặc giữa trời thu\nSoi sáng muôn phương sạch mây mù\nTình duyên viên mãn gia đình thuận\nTâm an vạn sự chẳng ưu tư.',
    meaning: 'Tình duyên và gia đạo vô cùng tốt đẹp. Người độc thân dễ gặp ý trung nhân, gia đình thêm tin vui.',
    ttsSummary: 'Quẻ số 81, Thượng Cát, Nguyệt Nhập Trung Thiên. Tình duyên viên mãn, gia đình hòa thuận, tâm an vạn sự lành.'
  },
  {
    number: 99,
    rank: 'Thượng Thượng Cát',
    title: 'Vạn Sự Viên Thành — Cửu Cửu Đại Cát',
    poem: 'Chín tầng mây trắng ánh hào quang\nTừ bi Phật Tổ độ nhân gian\nThí chủ lòng thành dâng lễ bái\nTrọn đời trường thọ hưởng vinh khang.',
    meaning: 'Quẻ tối thượng cát tường. Sức khỏe trường thọ, công danh hiển đạt, vạn sự viên thành.',
    ttsSummary: 'Quẻ số 99, Thượng Thượng Cát, Vạn Sự Viên Thành. Quẻ tối thượng cát tường, sức khỏe trường thọ, vạn sự như ý.'
  }
];

// ============================================================================
// 2. ZEROTTS PYTHON WORKER MANAGER (VOICE: MAI CHI)
// ============================================================================
class ZeroTTSManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.status = 'starting';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'zeroweight-ai/ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.requestQueue = new BoundedSerialQueue({
      maxPending: Number.parseInt(process.env.ZEROTTS_MAX_QUEUE || '24', 10)
    });
    this.activeRequestId = null;
    this.reqCounter = 0;
    this.buffer = '';
    this.restartTimer = null;
    this.restartAttempts = 0;
    const timeoutValue = Number(process.env.ZEROTTS_REQUEST_TIMEOUT_MS);
    this.requestTimeoutMs = Number.isFinite(timeoutValue)
      ? Math.max(15000, Math.min(180000, Math.round(timeoutValue)))
      : 90000;
    this.disabled = process.env.DISABLE_ZEROTTS_WORKER === '1';
    if (this.disabled) {
      this.status = 'disabled';
      return;
    }
    this.startWorker();
  }

  resolvePythonBin() {
    const configured = String(process.env.TEMPLE_PYTHON_BIN || process.env.PYTHON || '').trim();
    if (configured) return configured;
    const candidates = process.platform === 'win32'
      ? [path.join(__dirname, '.venv', 'Scripts', 'python.exe'), path.join(__dirname, '.venv', 'bin', 'python')]
      : [path.join(__dirname, '.venv', 'bin', 'python'), path.join(__dirname, '.venv', 'Scripts', 'python.exe')];
    const localPython = candidates.find((candidate) => fs.existsSync(candidate));
    if (localPython) return localPython;
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  settlePendingWorkerRequests(error) {
    for (const [, item] of this.pending) {
      clearTimeout(item.timer);
      item.resolve({ ok: false, error, code: 'TTS_WORKER_UNAVAILABLE' });
    }
    this.pending.clear();
    for (const job of this.requestQueue.clear()) {
      job.resolve({ ok: false, error, code: 'TTS_WORKER_UNAVAILABLE' });
    }
    this.activeRequestId = null;
  }

  scheduleWorkerRestart() {
    if (this.disabled || this.restartTimer) return;
    const delayMs = Math.min(60000, 1000 * (2 ** Math.min(this.restartAttempts, 6)));
    this.restartAttempts += 1;
    this.status = 'restarting';
    console.warn(`[ZeroTTS] Sẽ thử khởi động lại worker sau ${delayMs}ms (lần ${this.restartAttempts}).`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.startWorker();
    }, delayMs);
    this.restartTimer.unref?.();
    broadcastNotification('tts.status', this.getStatus());
  }

  startWorker() {
    if (this.disabled || this.proc) return;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const pyBin = this.resolvePythonBin();
    const scriptPath = path.join(__dirname, 'tts_worker.py');
    console.log(`[ZeroTTS] Khởi chạy worker với ${pyBin} (Giọng mặc định: Mai Chi)...`);
    this.status = 'loading';
    const worker = spawn(pyBin, [scriptPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.proc = worker;

    worker.on('error', (error) => {
      if (this.proc !== worker) return;
      console.warn('[ZeroTTS] Không khởi chạy được Python worker:', error.message);
      this.proc = null;
      this.ready = false;
      this.status = 'error';
      this.buffer = '';
      this.settlePendingWorkerRequests(error.message || 'ZeroTTS worker could not start');
      broadcastNotification('tts.status', this.getStatus());
      this.scheduleWorkerRestart();
    });

    worker.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) this.handleWorkerLine(line.trim());
      }
    });

    worker.stderr.on('data', (chunk) => {
      const message = chunk.toString('utf8').trim();
      if (message) console.log(`[ZeroTTS stderr] ${message}`);
    });

    worker.on('exit', (code) => {
      if (this.proc !== worker) return;
      console.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      this.proc = null;
      this.ready = false;
      this.status = code === 0 ? 'stopped' : 'error';
      this.buffer = '';
      this.settlePendingWorkerRequests('ZeroTTS worker exited; pending requests were cleared');
      broadcastNotification('tts.status', this.getStatus());
      this.scheduleWorkerRestart();
    });
  }

  handleWorkerLine(line) {
    try {
      const message = JSON.parse(line);
      if (message.type === 'status') {
        this.status = message.status;
        this.model = message.model || this.model;
        broadcastNotification('tts.status', this.getStatus());
      } else if (message.type === 'ready') {
        this.ready = true;
        this.status = 'ready';
        this.voice = message.voice || 'maichi';
        this.voices = message.voices || ['maichi'];
        this.model = message.model || this.model;
        this.restartAttempts = 0;
        console.log(`[ZeroTTS] Sẵn sàng sau ${message.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        broadcastNotification('tts.status', this.getStatus());
        this.processNextRequest();
      } else if (message.type === 'result' && message.id != null) {
        this.completeWorkerRequest(message.id, message);
      } else if (message.type === 'error') {
        console.error('[ZeroTTS Error]', message.error);
        if (message.id != null) {
          this.completeWorkerRequest(message.id, {
            ok: false, error: message.error || 'ZeroTTS synthesis failed', code: 'TTS_SYNTHESIS_ERROR'
          });
        } else {
          this.status = 'error';
          this.ready = false;
          broadcastNotification('tts.status', this.getStatus());
          this.proc?.kill();
        }
      }
    } catch (error) {
      console.warn('[ZeroTTS stdout] Không đọc được worker message:', error.message);
    }
  }

  completeWorkerRequest(id, result) {
    const pending = this.pending.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve(result);
    }
    // Keep the single Python inference slot occupied until the worker itself
    // answers, even if the HTTP caller has already timed out.
    if (this.activeRequestId === id) {
      this.activeRequestId = null;
      this.processNextRequest();
    }
    broadcastNotification('tts.status', this.getStatus());
  }

  failActiveRequest(id, error) {
    if (this.activeRequestId !== id) return;
    const pending = this.pending.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve({
        ok: false, error: error.message || String(error), code: 'TTS_WORKER_WRITE_ERROR'
      });
    }
    const worker = this.proc;
    this.ready = false;
    this.status = 'restarting';
    this.settlePendingWorkerRequests('ZeroTTS worker pipe failed; queued speech was cleared');
    if (worker && !worker.killed) worker.kill();
  }

  processNextRequest() {
    if (!this.ready || !this.proc || this.activeRequestId != null) return;
    const job = this.requestQueue.dequeue();
    if (!job) return;
    const id = ++this.reqCounter;
    this.activeRequestId = id;
    const timer = setTimeout(() => {
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      pending.resolve({
        ok: false,
        error: 'ZeroTTS synthesis timeout; worker will restart before the next request',
        code: 'TTS_SYNTHESIS_TIMEOUT'
      });
      const worker = this.proc;
      this.ready = false;
      this.status = 'restarting';
      this.settlePendingWorkerRequests('ZeroTTS worker timed out; queued speech was cleared');
      if (worker && !worker.killed) worker.kill();
    }, this.requestTimeoutMs);
    this.pending.set(id, { resolve: job.resolve, timer });

    const payload = JSON.stringify({ id, text: job.text, voice: job.voice }) + '\n';
    try {
      this.proc.stdin.write(payload, (error) => {
        if (error) this.failActiveRequest(id, error);
      });
    } catch (error) {
      this.failActiveRequest(id, error);
    }
    broadcastNotification('tts.status', this.getStatus());
  }

  getStatus() {
    return {
      ready: this.ready,
      status: this.status,
      engine: 'ZeroTTS (zeroweight-ai/ZeroTTS, local worker)',
      voice: state.settings.ttsVoice || this.voice || 'maichi',
      voices: this.voices,
      model: this.model,
      queueDepth: this.requestQueue.size,
      queueLimit: this.requestQueue.maxPending,
      activeRequest: this.activeRequestId != null,
      restartAttempts: this.restartAttempts
    };
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text', code: 'TTS_EMPTY_TEXT' });
    const voice = String(voiceOverride || state.settings.ttsVoice || 'maichi').toLowerCase();
    const dedupKey = `${voice}::${cleanText}`;
    if (this.inflight.has(dedupKey)) return this.inflight.get(dedupKey);

    const promise = new Promise((resolve) => {
      if (!this.proc || !this.ready) {
        resolve({
          ok: false, error: `ZeroTTS đang ở trạng thái: ${this.status}`, code: 'TTS_WORKER_NOT_READY'
        });
        return;
      }
      const accepted = this.requestQueue.enqueue({ text: cleanText, voice, resolve });
      if (!accepted) {
        resolve({
          ok: false,
          error: 'Hàng đợi ZeroTTS đang đầy. Yêu cầu đọc mới được từ chối để bảo vệ LIVE.',
          code: 'TTS_QUEUE_FULL',
          queueLimit: this.requestQueue.maxPending
        });
        return;
      }
      broadcastNotification('tts.status', this.getStatus());
      this.processNextRequest();
    }).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }
}

// ============================================================================
// 3. TRẠNG THÁI CHÙA ONLINE & BẢNG VÀNG CÔNG ĐỨC
// ============================================================================
const DEFAULT_STATE = {
  totalIncense: 108,
  totalMerit: 1080,
  woodenFishHits: 360,
  bellRings: 36,
  lanternCount: 18,
  fortuneCount: 12,
  activeIncenseSticks: 9,
  haloIntensity: 0.45,
  offerings: {
    lotus: 3,
    fruit: 2,
    lamp: 2,
    dragon: 1
  },
  devotees: {},
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.65,
    ttsVolume: 0.95,
    sfxVolume: 0.8,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: 'zenfacts_vn',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        devotees: saved.devotees || {},
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_STATE.tiktok }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function archivePreviousSession() {
  if (!fs.existsSync(STATE_FILE)) return null;
  const archiveDir = path.join(DATA_DIR, 'session-archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveFile = path.join(archiveDir, `merit-state-${stamp}.json`);
  try {
    fs.copyFileSync(STATE_FILE, archiveFile, fs.constants.COPYFILE_EXCL);
    console.log(`[State] Đã bảo lưu dữ liệu phiên trước: ${archiveFile}`);
    return archiveFile;
  } catch (error) {
    console.error('[State] Không thể bảo lưu dữ liệu phiên trước; giữ nguyên file gốc:', error.message);
    throw error;
  }
}

function resetSessionCounters() {
  state.totalIncense = 0;
  state.totalMerit = 0;
  state.woodenFishHits = 0;
  state.bellRings = 0;
  state.lanternCount = 0;
  state.fortuneCount = 0;
  state.activeIncenseSticks = 0;
  state.offerings = { lotus: 0, fruit: 0, lamp: 0, dragon: 0 };
  state.devotees = {};
  state.recentEvents = [];
}

let state = loadState();
// Preserve the last saved session before starting a clean LIVE counting session.
archivePreviousSession();
resetSessionCounters();

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = {
      totalIncense: state.totalIncense,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      settings: state.settings
    };
    fs.promises.writeFile(STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8').catch((e) => {
      console.error('[State] Lỗi lưu file:', e.message);
    });
  }, 1200);
}

// Persist the clean session immediately so the next process never reloads old counters.
saveState();

function getLeaderboard(limit = 6) {
  return Object.values(state.devotees)
    .sort((a, b) => b.merit - a.merit)
    .slice(0, limit)
    .map((d, index) => ({
      rank: index + 1,
      name: d.name,
      uniqueId: d.uniqueId,
      avatar: d.avatar || '',
      merit: d.merit,
      incense: d.incense || 0,
      lastWish: d.lastWish || ''
    }));
}
// Bộ lọc chặn ký tự lạ (Cuneiform 𒐫, Zalgo, Braille, ký tự spam) & từ ngữ phản cảm
const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}\uFDFD\u2800-\u28FF\u2580-\u259F]|[\u0300-\u036F]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const ALLOWED_VI_TEXT_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]/g;
const ALLOWED_VI_NAME_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s._-]/g;
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const BAD_WORDS_RE = /(đá dái|địt|lồn|cặc|đm|vcl|vl|yamate|i cư|lừa đảo|lừa à|te-le gram|telegram|bố là trùm)/i;

function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  const s = String(raw);
  if (WEIRD_SPAM_RE.test(s)) return true;
  if (BAD_WORDS_RE.test(s)) return true;
  return false;
}

function sanitizeUserName(rawName) {
  const normalized = String(rawName || '')
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);

  if (!normalized || BAD_WORDS_RE.test(normalized)) {
    return 'Thí Chủ Hữu Duyên';
  }
  const letters = normalized.match(VI_LETTER_RE) || [];
  if (letters.length < 2) {
    return 'Thí Chủ Hữu Duyên';
  }
  return normalized;
}

function sanitizeWishText(rawWish) {
  if (!rawWish) return '';
  const cleaned = String(rawWish)
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, 120);

  if (!cleaned || BAD_WORDS_RE.test(cleaned)) return '';
  const letters = cleaned.match(VI_LETTER_RE) || [];
  if (letters.length < 2) return '';
  return cleaned;
}

function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
  const displayName = sanitizeUserName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const key = (uniqueId || displayName).slice(0, 40);
  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      gifts: 0,
      lastWish: ''
    };
  }
  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;
  dev.merit += meritDelta;
  dev.incense += incenseDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;

  state.totalMerit += meritDelta;
  state.haloIntensity = Math.min(1.0, 0.35 + (state.totalMerit % 1000) / 1400);
  return dev;
}

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

function getPublicState() {
  return {
    totalIncense: state.totalIncense,
    totalMerit: state.totalMerit,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    haloIntensity: state.haloIntensity,
    offerings: state.offerings,
    leaderboard: getLeaderboard(24),
    recentEvents: state.recentEvents.slice(0, 15),
    settings: state.settings,
    tiktok: state.tiktok,
    tts: zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }
  };
}

// ============================================================================
// 4. NGHI THỨC TƯƠNG TÁC (RITUAL HANDLERS)
// ============================================================================
const Rituals = {
  burnIncense(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const merit = count * 5;

    state.totalIncense += count;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + count);
    const devotee = recordDevotee(user, uniqueId, avatar, merit, count, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Nam mô A Di Đà Phật. Cảm tạ thí chủ ${devotee.name} đã thành tâm thắp ${count} nén hương thơm. ${wish}.`;

    const event = pushEventLog({
      type: 'burnIncense',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const merit = count;

    state.woodenFishHits += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0);

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      ttsText: params.ttsText || ''
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const merit = count * 10;

    state.bellRings += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const ttsText = params.readTts
      ? `Thí chủ ${devotee.name} thỉnh Đại Hồng Chung cầu nguyện: ${wish}.`
      : '';

    const event = pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const merit = 10;

    state.lanternCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 1, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Lời cầu nguyện của thí chủ ${devotee.name}: ${wish}. Nam mô A Di Đà Phật.`;

    const event = pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  offerGift(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const rawCoins = Number(params.coins);
    const coins = Number.isFinite(rawCoins) ? Math.min(1000000, Math.max(1, rawCoins)) : 10;
    const giftType = ['lotus', 'fruit', 'lamp', 'dragon'].includes(params.giftType)
      ? params.giftType
      : (coins >= 100 ? 'dragon' : coins >= 20 ? 'fruit' : coins >= 5 ? 'lamp' : 'lotus');

    const giftLabels = {
      lotus: 'Đài Hoa Sen Vàng',
      fruit: 'Mâm Ngũ Quả Cát Tường',
      lamp: 'Đèn Lưu Ly Trí Tuệ',
      dragon: 'Đại Lễ Kim Long Chầu Phật'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
    const merit = Math.max(20, coins * multiplier);

    state.offerings[giftType] = (state.offerings[giftType] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, 1, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Công đức vô lượng! Cảm tạ thí chủ ${devotee.name} đã phát tâm dâng cúng ${giftName}, tích thêm ${merit} điểm công đức. Nguyện cầu chư Phật gia hộ cho thí chủ vạn sự cát tường như ý.`;

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType,
      giftId: params.giftId == null ? '' : String(params.giftId).slice(0, 80),
      giftName,
      giftGroupId: params.giftGroupId ? String(params.giftGroupId).slice(0, 180) : '',
      giftComboDelta: Math.min(100000, Math.max(1, Math.floor(Number(params.giftComboDelta) || 1))),
      giftRepeatCount: Math.min(100000, Math.max(1, Math.floor(Number(params.giftRepeatCount) || 1))),
      giftRepeatEnd: Boolean(params.giftRepeatEnd),
      giftStreakable: Boolean(params.giftStreakable),
      coins,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const requestedFortuneNumber = Number(params.fortuneNumber);
    const requestedFortune = Number.isInteger(requestedFortuneNumber)
      ? FORTUNE_DECK.find((item) => item.number === requestedFortuneNumber)
      : null;
    const fortune = requestedFortune || FORTUNE_DECK[Math.floor(Math.random() * FORTUNE_DECK.length)];
    const merit = 10;

    state.fortuneCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, `Xin xăm: Quẻ số ${fortune.number} (${fortune.rank})`);

    const ttsText = params.readTts === false
      ? ''
      : `Thí chủ ${devotee.name} vừa gieo được ${fortune.ttsSummary}`;

    const event = pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  },

  updateSettings(params = {}) {
    const previousAutoSim = state.settings.autoSim;
    const previousInterval = state.settings.autoSimIntervalMs;
    state.settings = normalizeTempleSettings(state.settings, params);
    if (typeof params.autoSim === 'boolean' && params.autoSim !== previousAutoSim) {
      configureAutoSim(state.settings.autoSim);
    } else if (state.settings.autoSim && state.settings.autoSimIntervalMs !== previousInterval) {
      restartAutoSimInterval();
    }
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 9;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 1, fruit: 1, lamp: 1, dragon: 0 };
    state.devotees = {};
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR & COMMENT PARSER
// ============================================================================
let tiktokConn = null;

const commentCooldownMap = new Map();
// TikTok may replay MEMBER events during initial room hydration and reconnects.
// Keep one arrival per viewer per short window so the 36-seat congregation does
// not fill with duplicate copies of the same account.
const viewerEntryCooldownMap = new Map();
const VIEWER_ENTRY_COOLDOWN_MS = 30000;
// TikTok exposes MEMBER joins and aggregate ROOM_USER counts, but does not
// guarantee a per-account leave event. Keep the accounts we actually saw so
// a falling room count can retire the oldest inactive-looking seat gracefully.
const viewerPresenceMap = new Map();
const MAX_TRACKED_VIEWER_PRESENCE = 300;
let lastRoomViewerCount = null;
let viewerStateBroadcastTimer = null;

function getViewerPresenceIdentity(uniqueId, user) {
  return String(uniqueId || user || '').trim().replace(/^@+/, '').toLowerCase();
}

function removeViewerPresence(identity, reason = 'viewer-count-decrease', viewerCount = state.tiktok.viewerCount) {
  const viewer = viewerPresenceMap.get(identity);
  if (!viewer) return false;
  viewerPresenceMap.delete(identity);
  broadcastNotification('temple.viewer-leave', {
    viewer: {
      user: viewer.user,
      uniqueId: viewer.uniqueId,
      avatar: viewer.avatar,
      leftAt: Date.now()
    },
    reason,
    viewerCount: Number(viewerCount || 0)
  });
  return true;
}

function reconcileViewerPresence(previousCount, nextCount) {
  if (!Number.isFinite(previousCount) || !Number.isFinite(nextCount) || nextCount >= previousCount) return 0;
  const dropCount = Math.min(previousCount - nextCount, viewerPresenceMap.size);
  if (dropCount <= 0) return 0;

  // The protocol tells us how many viewers left, not their identities. Retire
  // the oldest known arrivals first; activity events refresh lastActivityAt.
  const candidates = [...viewerPresenceMap.entries()]
    .sort((a, b) => a[1].lastActivityAt - b[1].lastActivityAt);
  let removed = 0;
  for (const [identity] of candidates) {
    if (removed >= dropCount) break;
    if (removeViewerPresence(identity, 'viewer-count-decrease', nextCount)) removed += 1;
  }
  if (removed) {
    console.log(`[TikTok Presence] Viewer count ${previousCount} -> ${nextCount}; retired ${removed} known seat(s).`);
  }
  return removed;
}

function touchViewerPresence(uniqueId, user, avatar) {
  const identity = getViewerPresenceIdentity(uniqueId, user);
  if (!identity) return;
  const viewer = viewerPresenceMap.get(identity);
  if (!viewer) return;
  viewer.lastActivityAt = Date.now();
  if (user) viewer.user = user;
  if (avatar) viewer.avatar = avatar;
}

function clearViewerPresence(reason = 'room-disconnected') {
  for (const identity of [...viewerPresenceMap.keys()]) {
    removeViewerPresence(identity, reason, 0);
  }
  viewerPresenceMap.clear();
  viewerEntryCooldownMap.clear();
  lastRoomViewerCount = null;
}

function scheduleViewerStateBroadcast() {
  if (viewerStateBroadcastTimer) return;
  viewerStateBroadcastTimer = setTimeout(() => {
    viewerStateBroadcastTimer = null;
    broadcastNotification('temple.state', getPublicState());
  }, 650);
}

function parseViewerComment(commentText, user, uniqueId, avatar) {
  const raw = String(commentText || '').trim();
  if (!raw || isBlockedSpamOrToxic(raw)) {
    return null;
  }

  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 3) {
    return null;
  }

  // Chống 1 người spam bình luận liên tục làm nghẽn hàng đợi TTS (cooldown 3.5 giây/người)
  const userKey = uniqueId || user || '';
  const now = Date.now();
  if (userKey) {
    const lastTs = commentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3500) {
      return null;
    }
    commentCooldownMap.set(userKey, now);
    if (commentCooldownMap.size > 600) {
      const oldestKey = commentCooldownMap.keys().next().value;
      commentCooldownMap.delete(oldestKey);
    }
  }

  const cleanUser = sanitizeUserName(user);
  switch (classifyTempleComment(cleanWish)) {
    case 'fortune':
      return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
    case 'bell':
      return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
    case 'woodenFish':
      return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3 });
    case 'incense':
      return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
    case 'prayer':
      return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
    default:
      return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish });
  }
}

const giftComboTracker = new Map();

async function resolveTikTokUsername(rawInput) {
  let input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }
  if (input.startsWith('http://') || input.startsWith('https://') || input.includes('tiktok.com/')) {
    const urlToFetch = input.startsWith('http') ? input : `https://${input}`;
    const directMatch = urlToFetch.match(/tiktok\.com\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
    try {
      const resp = await fetch(urlToFetch, { redirect: 'follow' });
      const finalUrl = resp.url || '';
      const resolvedMatch = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i);
      if (resolvedMatch && resolvedMatch[1]) {
        return resolvedMatch[1];
      }
    } catch (e) {
      console.warn('[TikTok URL Resolve Warning]', e.message);
    }
  }
  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

async function connectTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  // A reconnect starts a fresh room-presence snapshot as well as a fresh
  // gift streak session, so initial MEMBER hydration can repopulate the seats.
  clearViewerPresence('room-reconnect');
  clearGiftComboTracker(giftComboTracker);
  viewerEntryCooldownMap.clear();

  state.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  broadcastNotification('temple.state', getPublicState());

  const connection = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false,
    // Use a clean anonymous handshake. Do not pair a signed URL containing a
    // session with a WebSocket request that omits that same session cookie.
    authenticateWs: false,
    useMobile: false
  });
  tiktokConn = connection;

  const isCurrentConnection = () => tiktokConn === connection;

  connection.on(ControlEvent.CONNECTED, (roomState) => {
    if (!isCurrentConnection()) return;
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    console.log(`[TikTok Live] Đã kết nối phòng @${cleanUser} (roomId: ${state.tiktok.roomId})`);
    broadcastNotification('temple.state', getPublicState());
  });

  connection.on(ControlEvent.DISCONNECTED, () => {
    if (!isCurrentConnection()) return;
    clearGiftComboTracker(giftComboTracker);
    clearViewerPresence('room-disconnected');
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    state.tiktok.viewerCount = 0;
    console.log(`[TikTok Live] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('temple.state', getPublicState());
  });

  connection.on(ControlEvent.ERROR, (err) => {
    if (!isCurrentConnection()) return;
    state.tiktok.lastError = formatTikTokConnectionError(err);
    state.tiktok.connecting = false;
    console.warn('[TikTok Live Warning]', state.tiktok.lastError);
    broadcastNotification('temple.state', getPublicState());
  });

  connection.on(WebcastEvent.ROOM_USER, (data) => {
    if (!isCurrentConnection()) return;
    const rawViewerCount = data?.total ?? data?.viewerCount ?? data?.totalUser;
    if (rawViewerCount == null) return;
    const viewerCount = Number(rawViewerCount);
    if (!Number.isFinite(viewerCount) || viewerCount < 0) return;

    const previousCount = lastRoomViewerCount;
    state.tiktok.viewerCount = Math.floor(viewerCount);
    if (previousCount !== null) {
      reconcileViewerPresence(previousCount, state.tiktok.viewerCount);
    }
    lastRoomViewerCount = state.tiktok.viewerCount;
    broadcastNotification('temple.viewerCount', { viewerCount: state.tiktok.viewerCount });
  });

  connection.on(WebcastEvent.MEMBER, (data) => {
    if (!isCurrentConnection()) return;
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const identity = getViewerPresenceIdentity(uniqueId, user);
    if (!identity) return;
    const now = Date.now();
    const existingPresence = viewerPresenceMap.get(identity);
    if (existingPresence) {
      existingPresence.lastActivityAt = now;
      existingPresence.user = user || existingPresence.user;
      existingPresence.avatar = avatar || existingPresence.avatar;
      return;
    }
    const lastSeenAt = viewerEntryCooldownMap.get(identity) || 0;
    if (now - lastSeenAt < VIEWER_ENTRY_COOLDOWN_MS) return;
    viewerEntryCooldownMap.set(identity, now);
    if (viewerEntryCooldownMap.size > 1200) {
      const oldestKey = viewerEntryCooldownMap.keys().next().value;
      viewerEntryCooldownMap.delete(oldestKey);
    }

    viewerPresenceMap.set(identity, {
      user,
      uniqueId,
      avatar,
      joinedAt: now,
      lastActivityAt: now
    });
    if (viewerPresenceMap.size > MAX_TRACKED_VIEWER_PRESENCE) {
      const oldestIdentity = [...viewerPresenceMap.entries()]
        .sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0]?.[0];
      if (oldestIdentity) viewerPresenceMap.delete(oldestIdentity);
    }
    // A room entry is presence, not a donation: create/update the profile with
    // zero merit and let the 3D client seat the visitor in the 36-place grid.
    recordDevotee(user, uniqueId, avatar, 0, 0, 0, 'Vừa vào Chánh Điện');
    broadcastNotification('temple.viewer-enter', {
      viewer: { user, uniqueId, avatar, joinedAt: now },
      viewerCount: Number(state.tiktok.viewerCount || 0)
    });
    // Batch state refreshes during large initial MEMBER bursts; the 3D arrival
    // event above remains immediate so each real viewer can walk to a seat.
    scheduleViewerStateBroadcast();
  });

  connection.on(WebcastEvent.CHAT, (data) => {
    if (!isCurrentConnection()) return;
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    touchViewerPresence(uniqueId, user, avatar);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat] ${user}: ${commentText}`);
    parseViewerComment(commentText, user, uniqueId, avatar);
  });

  connection.on(WebcastEvent.LIKE, (data) => {
    if (!isCurrentConnection()) return;
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    touchViewerPresence(uniqueId, user, avatar);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
  });

  const handleSocialEvent = (data) => {
    if (!isCurrentConnection()) return;
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    touchViewerPresence(uniqueId, user, avatar);
    Rituals.ringBell({
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
      readTts: false
    });
  };
  connection.on(WebcastEvent.FOLLOW, handleSocialEvent);
  connection.on(WebcastEvent.SHARE, handleSocialEvent);
  connection.on(WebcastEvent.SOCIAL, (data) => {
    if (!isCurrentConnection()) return;
    const action = String(data?.action || '');
    const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      handleSocialEvent(data);
    }
  });

  connection.on(WebcastEvent.GIFT, (data) => {
    if (!isCurrentConnection()) return;
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    touchViewerPresence(uniqueId, user, avatar);
    const giftPayload = normalizeGiftPayload(data, uniqueId);
    const {
      giftId, giftName: rawGiftName, diamondCount, repeatCount, repeatEnd, groupId
    } = giftPayload;

    const deltaCount = getGiftComboDelta(giftComboTracker, giftPayload);
    if (deltaCount <= 0) {
      // A duplicate final frame still closes the browser-side visual streak,
      // even though it must not create another reward or ritual event.
      if (repeatEnd && groupId) {
        broadcastNotification('temple.gift-streak-end', { groupId });
      }
      return;
    }

    const totalCoins = diamondCount * deltaCount;
    const displayGiftName = rawGiftName
      ? (deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName)
      : '';

    console.log(`[TikTok Gift] ${user} gửi ${displayGiftName || 'quà chưa rõ tên'} (${totalCoins} xu)`);
    console.log('[TikTok Gift Payload]', {
      giftId: giftId || null,
      giftName: rawGiftName || null,
      diamondCount,
      repeatCount,
      repeatEnd,
      comboDelta: deltaCount,
      groupId
    });

    Rituals.offerGift({
      user,
      uniqueId,
      avatar,
      giftId,
      coins: totalCoins,
      giftName: displayGiftName,
      giftGroupId: groupId,
      giftComboDelta: deltaCount,
      giftRepeatCount: repeatCount,
      giftRepeatEnd: repeatEnd,
      giftStreakable: giftPayload.streakable,
      wish: `Thành tâm dâng ${displayGiftName || 'lễ vật'} kính lễ Đức Phật A Di Đà`
    });
  });

  try {
    const roomState = await connection.connect();
    if (!isCurrentConnection()) return state.tiktok;
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    broadcastNotification('temple.state', getPublicState());
    return state.tiktok;
  } catch (err) {
    const message = formatTikTokConnectionError(err) || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
    if (isCurrentConnection()) {
      clearGiftComboTracker(giftComboTracker);
      clearViewerPresence('connection-failed');
      state.tiktok.connected = false;
      state.tiktok.connecting = false;
      state.tiktok.viewerCount = 0;
      state.tiktok.lastError = message;
      broadcastNotification('temple.state', getPublicState());
    }
    throw new Error(message);
  }
}

function disconnectTikTokLive() {
  if (tiktokConn) {
    try {
      tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  clearGiftComboTracker(giftComboTracker);
  clearViewerPresence('manual-disconnect');
  viewerEntryCooldownMap.clear();
  state.tiktok.connected = false;
  state.tiktok.connecting = false;
  state.tiktok.viewerCount = 0;
  broadcastNotification('temple.state', getPublicState());
  return state.tiktok;
}

// ============================================================================
// 6. AUTO-SIMULATION ENGINE (CHẾ ĐỘ TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI XEM)
// ============================================================================
let autoSimTimer = null;

// Bot identities and wishes are unique for the lifetime of this server process.
// The old six-entry fixture caused the same names and messages to cycle forever.
let autoSimSequence = 0;
const autoSimSessionId = Date.now().toString(36);
const usedAutoSimNames = new Set();
const usedAutoSimWishes = new Set();
let lastAutoSimAction = '';

const BOT_GIVEN_NAMES = [
  'An', 'Bảo', 'Bình', 'Châu', 'Duy', 'Giang', 'Hà', 'Hân', 'Khánh',
  'Linh', 'Minh', 'Nam', 'Ngọc', 'Phúc', 'Quân', 'Thảo', 'Thiện', 'Trang',
  'Trúc', 'Tuấn', 'Uyên', 'Việt', 'Yến', 'Đức'
];
const BOT_MIDDLE_NAMES = [
  'Gia', 'Hoài', 'Hồng', 'Hữu', 'Khắc', 'Kim', 'Mạnh', 'Ngọc', 'Nhật',
  'Quốc', 'Thanh', 'Thành', 'Thị', 'Trọng', 'Xuân', 'Đình', 'Đức'
];
const BOT_FAMILY_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ',
  'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'
];

const BOT_WISH_OPENINGS = [
  'Con thành tâm nguyện cầu',
  'Con xin kính nguyện Tam Bảo gia hộ',
  'Thành kính dâng lời cầu nguyện',
  'Con cúi xin chư Phật từ bi chứng giám',
  'Gia đình con thành tâm hướng Phật',
  'Con xin gửi trọn lòng thành kính',
  'Nguyện đem tâm thiện lành dâng lên Tam Bảo',
  'Con thành kính cầu xin ánh sáng từ bi',
  'Xin chư Phật soi đường dẫn lối',
  'Con một lòng hướng về cửa Phật',
  'Thành tâm kính lễ mười phương chư Phật',
  'Con xin hồi hướng chút duyên lành',
  'Với tất cả lòng thành, con xin cầu nguyện',
  'Con kính dâng một niệm thiện lành',
  'Nguyện xin ánh sáng từ bi luôn soi chiếu'
];
const BOT_WISH_SUBJECTS = [
  'cho cha mẹ và người thân',
  'cho gia đạo luôn thuận hòa',
  'cho công việc và sự nghiệp',
  'cho việc học hành, thi cử',
  'cho người thân đang đau yếu',
  'cho những người con yêu thương',
  'cho mọi người hữu duyên',
  'cho cuộc sống gia đình',
  'cho hành trình phía trước',
  'cho những dự định còn dang dở',
  'cho người đang gặp khó khăn',
  'cho những ai đang cần bình an',
  'cho các em nhỏ trong gia đình',
  'cho ông bà tổ tiên',
  'cho tình duyên và nhân duyên tốt đẹp',
  'cho cộng đồng luôn an vui',
  'cho những người đang xa quê',
  'cho hành trình học tập và trưởng thành'
];
const BOT_WISH_OUTCOMES = [
  'luôn mạnh khỏe, thân tâm an lạc',
  'đón nhận nhiều cơ hội tốt lành',
  'mọi khó khăn sớm được hóa giải',
  'tâm sáng, trí an, lòng luôn vững chãi',
  'gặp quý nhân, công việc hanh thông',
  'bình an qua mọi chặng đường',
  'vạn sự cát tường như ý',
  'có thêm nghị lực vượt qua thử thách',
  'tích lũy phước lành và duyên thiện',
  'gia đình êm ấm, tiếng cười sum vầy',
  'trí tuệ khai mở, lòng từ bi tăng trưởng',
  'buông bỏ muộn phiền, giữ tâm thanh thản',
  'đường xa vững bước, việc lành viên mãn',
  'mưa thuận gió hòa, cuộc sống đủ đầy',
  'thân khỏe tâm an, mỗi ngày đều thiện lành',
  'những điều tốt đẹp lần lượt thành tựu',
  'nợ duyên lành được kết nối trọn vẹn',
  'niềm vui nhỏ nở hoa trong từng ngày',
  'điều chưa thuận được chuyển hóa nhẹ nhàng',
  'ánh sáng từ bi soi sáng mọi nẻo đường'
];
const BOT_WISH_CLOSINGS = [
  'Nam mô A Di Đà Phật',
  'Nguyện điều lành lan tỏa đến muôn nơi',
  'Xin hồi hướng công đức đến tất cả chúng sinh',
  'Nguyện mỗi ngày đều có thêm một việc thiện',
  'Kính mong Tam Bảo từ bi gia hộ',
  'Nguyện giữ lòng thiện và sống đời tỉnh thức',
  'Xin cho tâm luôn sáng và lòng luôn an',
  'Nguyện bình an hiện hữu trong từng mái nhà',
  'Con xin tri ân nhân duyên lành này',
  'Nguyện mọi người đều được an vui',
  'Cúi xin chứng giám tấm lòng thành kính',
  'Mong hạt giống thiện lành được vun bồi'
];
const BOT_GIFT_NAMES = [
  'Đài Hoa Sen Vàng', 'Bó Sen Tịnh Tâm', 'Ngọn Đèn Trí Tuệ',
  'Mâm Lễ An Lành', 'Bình Hoa Cát Tường', 'Chuỗi Ngọc Tâm An',
  'Bảo Liên Thanh Tịnh', 'Ánh Đăng Từ Bi', 'Lẵng Hoa Ưu Đàm',
  'Sen Ngọc Bảo Châu', 'Đóa Sen Như Ý', 'Đèn Lưu Ly Cát Tường'
];

function pickAutoSimItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createAutoSimIdentity(sequence) {
  let user = '';
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = sanitizeUserName(
      `${pickAutoSimItem(BOT_FAMILY_NAMES)} ${pickAutoSimItem(BOT_MIDDLE_NAMES)} ${pickAutoSimItem(BOT_GIVEN_NAMES)}`
    );
    if (candidate !== 'Thí Chủ Hữu Duyên' && !usedAutoSimNames.has(candidate)) {
      user = candidate;
      break;
    }
  }

  // Once the natural-name combinations have been used, add a short sequence
  // marker so even a long-running bot never reuses a displayed participant name.
  if (!user) {
    user = sanitizeUserName(
      `${pickAutoSimItem(BOT_FAMILY_NAMES)} ${pickAutoSimItem(BOT_GIVEN_NAMES)} ${sequence.toString(36).toUpperCase()}`
    );
    let collision = 1;
    while (usedAutoSimNames.has(user)) {
      user = sanitizeUserName(
        `${pickAutoSimItem(BOT_FAMILY_NAMES)} ${pickAutoSimItem(BOT_GIVEN_NAMES)} ${sequence.toString(36).toUpperCase()} ${collision}`
      );
      collision += 1;
    }
  }

  usedAutoSimNames.add(user);
  return {
    user,
    // A fresh identity per simulated arrival prevents recordDevotee from
    // merging separate bot participants into the same leaderboard row.
    uniqueId: `templebot_${autoSimSessionId}_${sequence.toString(36)}`
  };
}

function createAutoSimWish(sequence) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const wish = sanitizeWishText(
      `${pickAutoSimItem(BOT_WISH_OPENINGS)} ${pickAutoSimItem(BOT_WISH_SUBJECTS)}, ${pickAutoSimItem(BOT_WISH_OUTCOMES)}. ${pickAutoSimItem(BOT_WISH_CLOSINGS)}.`
    );
    if (wish && !usedAutoSimWishes.has(wish)) {
      usedAutoSimWishes.add(wish);
      return wish;
    }
  }

  // The prefix keeps the fallback unique even after every phrase combination
  // has appeared; sanitizeWishText preserves it within the 120-char limit.
  const marker = sequence.toString(36).toUpperCase();
  const wish = sanitizeWishText(
    `Lời nguyện số ${marker}: ${pickAutoSimItem(BOT_WISH_SUBJECTS)}, ${pickAutoSimItem(BOT_WISH_OUTCOMES)}.`
  );
  usedAutoSimWishes.add(wish);
  return wish;
}

function chooseAutoSimAction() {
  const roll = Math.random();
  let action = roll < 0.30
    ? 'burnIncense'
    : roll < 0.55
      ? 'sendPrayer'
      : roll < 0.75
        ? 'drawFortune'
        : roll < 0.90
          ? 'offerGift'
          : 'ringBell';

  // Keep the stream from showing the same ritual type twice in a row.
  if (action === lastAutoSimAction) {
    const alternatives = ['burnIncense', 'sendPrayer', 'drawFortune', 'offerGift', 'ringBell']
      .filter((item) => item !== lastAutoSimAction);
    action = pickAutoSimItem(alternatives);
  }
  lastAutoSimAction = action;
  return action;
}

function runSingleSimulationStep() {
  autoSimSequence += 1;
  const participant = createAutoSimIdentity(autoSimSequence);
  const wish = createAutoSimWish(autoSimSequence);
  const shared = { ...participant, wish };
  const action = chooseAutoSimAction();

  if (action === 'burnIncense') {
    Rituals.burnIncense({ ...shared, count: 1 + Math.floor(Math.random() * 5) });
  } else if (action === 'sendPrayer') {
    Rituals.sendPrayer(shared);
  } else if (action === 'drawFortune') {
    const fortune = FORTUNE_DECK[(autoSimSequence - 1) % FORTUNE_DECK.length];
    Rituals.drawFortune({ ...shared, topic: wish, fortuneNumber: fortune.number });
  } else if (action === 'offerGift') {
    Rituals.offerGift({
      ...shared,
      giftType: 'lotus',
      coins: 10 + Math.floor(Math.random() * 31),
      giftName: BOT_GIFT_NAMES[(autoSimSequence - 1) % BOT_GIFT_NAMES.length]
    });
  } else {
    Rituals.ringBell({ ...shared, count: 1 + Math.floor(Math.random() * 3), readTts: true });
  }
}

function configureAutoSim(enabled) {
  state.settings.autoSim = Boolean(enabled);
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  if (state.settings.autoSim) {
    runSingleSimulationStep();
    restartAutoSimInterval();
  }
}

function restartAutoSimInterval() {
  if (!state.settings.autoSim) return;
  if (autoSimTimer) clearInterval(autoSimTimer);
  const intervalMs = Math.max(5000, Math.min(60000, Number(state.settings.autoSimIntervalMs) || 9500));
  autoSimTimer = setInterval(runSingleSimulationStep, intervalMs);
}

// ============================================================================
// 7. JSON-RPC 2.0 DISPATCHER
// ============================================================================
async function handleRpcCall(method, params = {}) {
  switch (method) {
    case 'temple.testEffect': {
      const payload = buildEffectTestPayload(params.effect, {
        withTarget: params.withTarget !== false
      });
      broadcastNotification('temple.test-effect', payload);
      return {
        ok: true,
        effect: payload.effect,
        label: payload.label,
        withTarget: payload.withTarget,
        eventCount: payload.events.length,
        connectedScreens: [...wss.clients].filter((client) => client.readyState === 1).length
      };
    }
    case 'temple.getState':
      return getPublicState();
    case 'temple.burnIncense':
      return Rituals.burnIncense(params);
    case 'temple.strikeWoodenFish':
      return Rituals.strikeWoodenFish(params);
    case 'temple.ringBell':
      return Rituals.ringBell(params);
    case 'temple.sendPrayer':
      return Rituals.sendPrayer(params);
    case 'temple.offerGift':
      return Rituals.offerGift(params);
    case 'temple.drawFortune':
      return Rituals.drawFortune(params);
    case 'temple.grandCeremony':
      return Rituals.grandCeremony(params);
    case 'temple.updateSettings':
      return Rituals.updateSettings(params);
    case 'temple.resetMerit':
      return Rituals.resetMerit();
    case 'temple.comment':
      return parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'temple.speak': {
      const res = await zeroTts.synthesize(params.text, params.voice || 'maichi');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
          text: params.text,
          voice: res.voice,
          url: res.url
        });
      }
      return res;
    }
    case 'temple.ttsStatus':
      return zeroTts.getStatus();
    case 'live.connect':
      return await connectTikTokLive(params.username);
    case 'live.disconnect':
      return disconnectTikTokLive();
    case 'live.setAutoSim':
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

// ============================================================================
// 8. EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
app.use((req, res, next) => {
  if (!isAllowedRequestOrigin(req.headers.origin, req)) {
    return res.status(403).json({ error: 'Origin này không được phép điều khiển Temple RPC' });
  }
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (origin && ALLOWED_CORS_ORIGINS.has(origin)) return callback(null, origin);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 600
}));
app.use(express.json({ limit: '2mb' }));
app.use('/tts-cache', express.static(TTS_CACHE_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

// Dedicated OBS Browser Source: clean portrait output with the 3D temple enabled.
// Keep the interactive control dock on the normal home page only.
app.get('/obs', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.redirect(302, '/?3d=1&obs=1');
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// HTTP JSON-RPC 2.0 Endpoint
app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (!method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
    });
  }
  try {
    const result = await handleRpcCall(method, params || {});
    res.json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      result
    });
  } catch (err) {
    res.status(200).json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      error: { code: -32000, message: err.message || 'Server error' }
    });
  }
});

// ZeroTTS HTTP Endpoint (Mai Chi default)
app.all('/api/tts', async (req, res) => {
  const text = (req.body?.text || req.query?.text || '').trim();
  const voice = (req.body?.voice || req.query?.voice || state.settings.ttsVoice || 'maichi').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
  }
  const result = await zeroTts.synthesize(text, voice);
  res.json(result);
});

app.get('/api/state', (_req, res) => {
  res.json(getPublicState());
});

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'temple-live',
    uptimeSeconds: Math.floor(process.uptime()),
    tiktokConnected: Boolean(state.tiktok.connected),
    autoSimEnabled: Boolean(state.settings.autoSim),
    autoSimRunning: Boolean(autoSimTimer),
    tts: zeroTts.getStatus()
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastNotification(method, params) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, request) => {
  if (!isAllowedRequestOrigin(request.headers.origin, request)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'temple.state',
      params: getPublicState()
    })
  );

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!msg || !msg.method) return;
    try {
      const result = await handleRpcCall(msg.method, msg.params || {});
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          })
        );
      }
    } catch (err) {
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          })
        );
      }
    }
  });
});

const zeroTts = new ZeroTTSManager();

server.listen(PORT, HOST, () => {
  console.log(`============================================================`);
  console.log(`🪷 CHÙA ONLINE TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG`);
  console.log(`📺 Màn hình Live (9:16 OBS): http://localhost:${PORT}/obs`);
  console.log(`🎛️ Bảng điều khiển RPC Admin: http://localhost:${PORT}/admin`);
  console.log(`🔌 JSON-RPC 2.0 Endpoint   : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
  if (HOST === '0.0.0.0' || HOST === '::') {
    const lanAddresses = getLanIPv4Addresses();
    if (lanAddresses.length) {
      lanAddresses.forEach((address) => {
        console.log(`🌐 LAN OBS: http://${address}:${PORT}/obs`);
        console.log(`🌐 LAN Admin: http://${address}:${PORT}/admin`);
      });
    } else {
      console.log('🌐 LAN: Chưa phát hiện IPv4; hãy kiểm tra kết nối mạng của máy chủ.');
    }
  }
  console.log(`🌐 Bind: ${HOST} • CORS allowlist: ${ALLOWED_CORS_ORIGINS.size} external origin(s)`);
  console.log(`============================================================`);
  console.info(
    `[TikTok] Connector version=${TIKTOK_CONNECTOR_VERSION || 'unknown'}; WebSocket auth=anonymous (authenticateWs=false)`
  );

  // Restore an explicitly enabled simulation after restart; do not leave the
  // UI showing an enabled toggle while the interval is actually stopped.
  if (state.settings.autoSim) configureAutoSim(true);

  // Visual/browser audits can opt out of external live connections.
  if (process.env.DISABLE_TIKTOK_AUTOCONNECT !== '1') {
    // Tự động kết nối tới @zenfacts_vn ngay khi khởi động server
    const defaultChannel = process.env.TIKTOK_USER || state.tiktok?.username || 'zenfacts_vn';
    if (defaultChannel) {
      connectTikTokLive(defaultChannel).catch((err) => {
        console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay: ${formatTikTokConnectionError(err)}`);
      });
    }
  }
});
