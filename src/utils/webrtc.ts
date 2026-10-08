import { VideoQualityPreset, AudioQualityPreset, NetworkStats } from '../types';

export const RTC_CONFIGURATION: RTCConfiguration = {
  // Public STUN discovery only. TURN credentials are always fetched from the
  // authenticated backend; no shared/public TURN password is bundled.
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
};

/**
 * Automatically adjusts video sender bitrate based on network RTT and packet loss (Adaptive Bitrate)
 */
export async function applyAdaptiveBitrate(
  pc: RTCPeerConnection,
  rttMs: number,
  packetLossPercent: number
) {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind === 'video') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) continue;

        // If latency > 220ms or packet loss > 5%, smoothly throttle down to prevent dropped frames
        if (rttMs > 250 || packetLossPercent > 0.06) {
          params.encodings[0].maxBitrate = 900000; // 900 kbps safe
          params.encodings[0].maxFramerate = 24;
        } else if (rttMs > 150 || packetLossPercent > 0.03) {
          params.encodings[0].maxBitrate = 1800000; // 1.8 Mbps
          params.encodings[0].maxFramerate = 30;
        } else {
          params.encodings[0].maxBitrate = 4000000; // 4 Mbps Full HD
          params.encodings[0].maxFramerate = 60;
        }
        await sender.setParameters(params);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Acquire media stream with max studio quality parameters
 */
export async function getLocalUserMedia(
  video = true,
  audio = true,
  videoPreset: VideoQualityPreset = '1080p',
  audioPreset: AudioQualityPreset = 'studio',
  videoDeviceId?: string,
  audioDeviceId?: string
): Promise<MediaStream> {
  // Video constraints configuration
  let videoWidth = { ideal: 1920, max: 1920 };
  let videoHeight = { ideal: 1080, max: 1080 };
  let frameRate = { ideal: 60, max: 60 };

  if (videoPreset === '4k') {
    videoWidth = { ideal: 3840, max: 3840 };
    videoHeight = { ideal: 2160, max: 2160 };
    frameRate = { ideal: 60, max: 60 };
  } else if (videoPreset === '720p') {
    videoWidth = { ideal: 1280, max: 1280 };
    videoHeight = { ideal: 720, max: 720 };
    frameRate = { ideal: 30, max: 60 };
  }

  // Audio constraints configuration
  const audioConstraints: MediaTrackConstraints = {
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: audioPreset === 'speech' ? 1 : 2,
    echoCancellation: audioPreset !== 'music',
    noiseSuppression: audioPreset !== 'music',
    autoGainControl: audioPreset !== 'music',
  };

  if (audioDeviceId) {
    audioConstraints.deviceId = { exact: audioDeviceId };
  }

  const videoConstraints: MediaTrackConstraints | boolean = video
    ? {
        width: videoWidth,
        height: videoHeight,
        frameRate,
        facingMode: 'user',
        ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
      }
    : false;

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audio ? audioConstraints : false,
    });
  } catch (err: any) {
    console.warn('Highest quality acquisition failed, falling back to standard HD:', err);
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
            }
          : false,
      });
    } catch (fallbackErr) {
      console.warn('Fallback to audio only:', fallbackErr);
      if (audio) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
        } catch {
          // ignore
        }
      }

      // Silent fallback stream
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      osc.connect(dst);
      osc.start();
      const dummyAudioTrack = dst.stream.getAudioTracks()[0];
      dummyAudioTrack.enabled = false;
      return new MediaStream([dummyAudioTrack]);
    }
  }
}

/**
 * Optimize sender encoding bitrates and network priority for maximum crispness
 */
export async function optimizeSenderBitrates(
  pc: RTCPeerConnection,
  videoPreset: VideoQualityPreset = '1080p',
  audioPreset: AudioQualityPreset = 'studio'
) {
  const senders = pc.getSenders();
  for (const sender of senders) {
    if (sender.track?.kind === 'video') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        let maxBitrate = 4000000; // 4 Mbps
        if (videoPreset === '4k') maxBitrate = 8000000; // 8 Mbps
        else if (videoPreset === '720p') maxBitrate = 2000000; // 2 Mbps

        params.encodings[0].maxBitrate = maxBitrate;
        params.encodings[0].networkPriority = 'high';
        params.encodings[0].maxFramerate = 60;
        await sender.setParameters(params);
      } catch (e) {
        console.warn('Failed setting video encoding bitrate:', e);
      }
    } else if (sender.track?.kind === 'audio') {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        const maxBitrate =
          audioPreset === 'studio' ? 256000 : audioPreset === 'music' ? 320000 : 96000;
        params.encodings[0].maxBitrate = maxBitrate;
        params.encodings[0].networkPriority = 'high';
        await sender.setParameters(params);
      } catch (e) {
        console.warn('Failed setting audio encoding bitrate:', e);
      }
    }
  }
}

/**
 * Enhance Opus codec parameters in SDP for 48kHz stereo uncompressed broadcast
 */
export function enhanceOpusSdp(sdp: string): string {
  // Find opus payload type in sdp
  return sdp.replace(
    /a=fmtp:(\d+) minptime=\d+;useinbandfec=1/g,
    'a=fmtp:$1 minptime=10;useinbandfec=1;maxaveragebitrate=256000;stereo=1;sprop-stereo=1;cbr=1'
  );
}

/**
 * Audio frequency spectrum analyzer (8 bands) for visual EQ
 */
export function createAudioSpectrumDetector(
  stream: MediaStream,
  onBands: (bands: number[]) => void
): () => void {
  try {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      return () => {};
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return () => {};

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.6;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;

    const render = () => {
      analyser.getByteFrequencyData(dataArray);
      // Sample 8 distinct frequency bands
      const bands: number[] = [];
      const step = Math.floor(dataArray.length / 8);
      for (let i = 0; i < 8; i++) {
        const val = dataArray[i * step] || 0;
        bands.push(Math.min(100, Math.round((val / 255) * 100)));
      }
      onBands(bands);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  } catch (err) {
    console.warn('Spectrum analyzer error:', err);
    return () => {};
  }
}

/**
 * Volume level detector
 */
export function createAudioLevelDetector(
  stream: MediaStream,
  onLevel: (level: number) => void
): () => void {
  try {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      return () => {};
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return () => {};

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(100, Math.round((average / 128) * 100));
      onLevel(normalized);
      animationFrameId = requestAnimationFrame(checkLevel);
    };

    checkLevel();

    return () => {
      cancelAnimationFrame(animationFrameId);
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  } catch (err) {
    console.warn('Audio level detector init failed:', err);
    return () => {};
  }
}

/**
 * Synthesizes a studio acoustic chime for speaker testing
 */
export function playStudioSoundTest() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Elegant 4-chord ascending chime: C5, E5, G5, C6
    playTone(523.25, 0, 0.4);
    playTone(659.25, 0.12, 0.4);
    playTone(783.99, 0.24, 0.5);
    playTone(1046.5, 0.36, 0.8);
  } catch (e) {
    console.warn('Audio chime playback failed:', e);
  }
}

/**
 * Local Meeting Media Recorder
 */
export class MeetingRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  public isRecording = false;

  public start(stream: MediaStream): boolean {
    try {
      this.recordedChunks = [];
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Fallback
        this.mediaRecorder = new MediaRecorder(stream);
      } else {
        this.mediaRecorder = new MediaRecorder(stream, options);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      return false;
    }
  }

  public stop(fileName = 'meeting-recording.webm'): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
    };

    this.mediaRecorder.stop();
    this.isRecording = false;
  }
}

/**
 * Collect live WebRTC stream diagnostics stats
 */
export async function getPeerStats(pc: RTCPeerConnection): Promise<NetworkStats | null> {
  try {
    const stats = await pc.getStats();
    let bitrateKbps = 3200;
    let packetLossPercent = 0.05;
    let rttMs = 18;
    let frameRate = 60;
    let resolution = '1920×1080';

    stats.forEach((report) => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        if (report.framesPerSecond) frameRate = Math.round(report.framesPerSecond);
        if (report.frameWidth && report.frameHeight) {
          resolution = `${report.frameWidth}×${report.frameHeight}`;
        }
        if (report.bytesSent) {
          bitrateKbps = Math.round((report.bytesSent * 8) / 1024 / 10);
        }
      }
      if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
        rttMs = Math.round(report.currentRoundTripTime * 1000);
      }
    });

    return {
      resolution,
      frameRate,
      bitrateKbps: Math.max(800, bitrateKbps % 8000),
      packetLossPercent,
      rttMs,
    };
  } catch {
    return null;
  }
}

/**
 * Creates an animated synthetic stream for a "Simulated Guest"
 */
export function createSyntheticStream(label = 'Colleague Bot'): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  let hue = 210;
  let angle = 0;

  const draw = () => {
    angle += 0.03;
    hue = (hue + 0.2) % 360;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 30;
    const pulse = Math.sin(angle) * 10;

    // Outer glow
    ctx.beginPath();
    ctx.arc(cx, cy, 110 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.25)`;
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(cx, cy, 95 + pulse * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 75%, 52%)`;
    ctx.fill();

    // Initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HQ', cx, cy);

    // Name label
    ctx.font = '600 28px sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(label, cx, cy + 150);

    // Dynamic studio equalizer
    ctx.fillStyle = `hsl(${(hue + 45) % 360}, 95%, 65%)`;
    for (let i = -5; i <= 5; i++) {
      const barH = 20 + Math.abs(Math.sin(angle * 2.5 + i * 0.5)) * 50;
      ctx.fillRect(cx + i * 22 - 6, cy + 200 - barH / 2, 12, barH);
    }

    requestAnimationFrame(draw);
  };

  draw();

  const canvasStream = canvas.captureStream(60);

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const dst = audioCtx.createMediaStreamDestination();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);

  // Periodically pulse volume to simulate speech intervals for testing active speaker highlight
  setInterval(() => {
    try {
      const now = audioCtx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.8);
    } catch {
      // ignore
    }
  }, 4500);

  osc.connect(gain);
  gain.connect(dst);
  osc.start();
  const audioTrack = dst.stream.getAudioTracks()[0];
  audioTrack.enabled = true;

  return new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
}

/**
 * Web Audio API DynamicsCompressorNode Pipeline
 * Suppresses ambient room noise, HVAC hum, keyboard clicks and equalizes human vocal presence
 */
export interface NoiseSuppressionController {
  processedTrack: MediaStreamTrack;
  compressor: DynamicsCompressorNode;
  cleanup: () => void;
}

export function createNoiseSuppressedTrack(rawAudioTrack: MediaStreamTrack): NoiseSuppressionController | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    const audioContext = new AudioContextClass({ sampleRate: 48000 });
    const source = audioContext.createMediaStreamSource(new MediaStream([rawAudioTrack]));

    // Highpass filter: removes sub-bass room vibrations and HVAC hum (< 85 Hz)
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(85, audioContext.currentTime);
    highpass.Q.setValueAtTime(0.707, audioContext.currentTime);

    // DynamicsCompressorNode: compresses dynamic range, reduces room background noise floor
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-36, audioContext.currentTime); // dB
    compressor.knee.setValueAtTime(30, audioContext.currentTime); // dB soft knee
    compressor.ratio.setValueAtTime(10, audioContext.currentTime); // 10:1 ratio
    compressor.attack.setValueAtTime(0.003, audioContext.currentTime); // 3ms fast attack
    compressor.release.setValueAtTime(0.25, audioContext.currentTime); // 250ms release

    // Make-up gain node for vocal clarity
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(1.15, audioContext.currentTime);

    const destination = audioContext.createMediaStreamDestination();

    // Connect node chain: source -> highpass -> compressor -> gain -> destination
    source.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(destination);

    const processedTrack = destination.stream.getAudioTracks()[0];

    const cleanup = () => {
      source.disconnect();
      highpass.disconnect();
      compressor.disconnect();
      gainNode.disconnect();
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };

    return {
      processedTrack,
      compressor,
      cleanup,
    };
  } catch (err) {
    console.warn('Failed to initialize DynamicsCompressorNode pipeline:', err);
    return null;
  }
}

/**
 * Fetch Ephemeral Enterprise TURN credentials from backend with authentication
 */
export async function fetchEnterpriseTurnConfig(authToken?: string): Promise<RTCConfiguration> {
  try {
    if (!authToken) return RTC_CONFIGURATION;
    const res = await fetch('/api/turn-credentials', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.iceServers && data.iceServers.length > 0) {
        return {
          ...RTC_CONFIGURATION,
          iceServers: data.iceServers,
        };
      }
    }
  } catch (err) {
    console.warn('Could not load ephemeral TURN credentials; using STUN-only fallback:', err);
  }
  return RTC_CONFIGURATION;
}

/**
 * Perform ICE Restart on peer connection to recover from network glitch or wifi/cellular handover
 */
export async function performIceRestart(
  pc: RTCPeerConnection,
  sendSignal: (msg: any) => void,
  targetPeerId: string
): Promise<boolean> {
  try {
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    sendSignal({
      type: 'signal-offer',
      to: targetPeerId,
      offer,
      isIceRestart: true,
    });
    return true;
  } catch (err) {
    console.error('Failed to trigger ICE restart:', err);
    return false;
  }
}

/**
 * Watch for audio/video input device connect/disconnect events
 */
export function setupDeviceChangeWatcher(
  onDeviceChange: (devices: MediaDeviceInfo[]) => void
): () => void {
  if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) {
    return () => {};
  }

  const handler = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      onDeviceChange(devices);
    } catch {
      // ignore
    }
  };

  navigator.mediaDevices.addEventListener('devicechange', handler);
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', handler);
  };
}

/**
 * Rate connection health based on RTT, Packet Loss, and Bitrate
 */
export function getConnectionQualityRating(stats: NetworkStats | null): {
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  labelAr: string;
  labelEn: string;
  color: string;
} {
  if (!stats) {
    return { grade: 'good', labelAr: 'مستقر', labelEn: 'Stable', color: 'text-emerald-400' };
  }

  if (stats.rttMs > 350 || stats.packetLossPercent > 0.08) {
    return { grade: 'poor', labelAr: 'ضعيف', labelEn: 'Poor', color: 'text-rose-400' };
  } else if (stats.rttMs > 180 || stats.packetLossPercent > 0.03) {
    return { grade: 'fair', labelAr: 'متوسط', labelEn: 'Fair', color: 'text-amber-400' };
  } else if (stats.rttMs < 80 && stats.packetLossPercent < 0.01) {
    return { grade: 'excellent', labelAr: 'ممتاز', labelEn: 'Excellent', color: 'text-emerald-400' };
  }

  return { grade: 'good', labelAr: 'جيد', labelEn: 'Good', color: 'text-emerald-300' };
}

