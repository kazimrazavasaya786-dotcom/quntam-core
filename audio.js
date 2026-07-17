// audio.js - Web Audio API Synthesizer for Quantum Core Stability Arena

class QuantumAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
  }

  init() {
    if (this.unlocked && this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.unlocked = true;
    } catch (e) {
      console.warn("Web Audio API not supported on this browser", e);
    }
  }

  // Play a simple digital click sound
  playSelect() {
    this.init();
    if (!this.ctx) return;
    
    // Resume context if suspended (browser security policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Play a warning alarm sound (siren effect)
  playWarning() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.4);
    osc1.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.8);

    osc2.frequency.setValueAtTime(152, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(302, this.ctx.currentTime + 0.4);
    osc2.frequency.linearRampToValueAtTime(152, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.8);
    osc2.stop(this.ctx.currentTime + 0.8);
  }

  // Play a heavy clank sound when scores/results are computed
  playClank() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const noise = this.createNoiseBuffer();
    const noiseNode = this.ctx.createBufferSource();
    const gainOsc = this.ctx.createGain();
    const gainNoise = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);

    gainOsc.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    if (noise) {
      noiseNode.buffer = noise;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(100, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.0, this.ctx.currentTime);
      
      gainNoise.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gainNoise.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      noiseNode.connect(filter);
      filter.connect(gainNoise);
      gainNoise.connect(this.ctx.destination);
      noiseNode.start();
    }

    osc.connect(gainOsc);
    gainOsc.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  // Play a bubbling sizzle noise when coolant/plasma levels increase
  playSizzle() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const noise = this.createNoiseBuffer();
    if (!noise) return;

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(3000, this.ctx.currentTime + 0.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.65);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.75);

    // Play a couple of offset high pitch bubble pops
    for (let i = 0; i < 3; i++) {
      const delay = 0.1 * i + Math.random() * 0.05;
      this.playBubblePop(this.ctx.currentTime + delay);
    }
  }

  playBubblePop(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, time);
    osc.frequency.exponentialRampToValueAtTime(1500, time + 0.03);

    gain.gain.setValueAtTime(0.02, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  // Play a ticking countdown sound
  playTick() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  // Play meltdown alarm sound
  playMeltdown() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const duration = 1.5;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);

    // Large splash / bubble storm
    const noise = this.createNoiseBuffer();
    if (noise) {
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noise;
      const noiseGain = this.ctx.createGain();
      
      noiseGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noiseNode.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseNode.start();
      noiseNode.stop(this.ctx.currentTime + duration);
    }
  }

  // Low heartbeat thump — triggered when a node is critically low
  playHeartbeat() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    [0, 0.18].forEach((offset, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, now + offset);
      osc.frequency.exponentialRampToValueAtTime(30, now + offset + 0.12);
      gain.gain.setValueAtTime(0.0, now + offset);
      gain.gain.linearRampToValueAtTime(i === 0 ? 0.18 : 0.12, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  }

  // Stinger played once when a match drops to its final 2 nodes
  playFinalRoundStinger() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(65, now);
    osc2.frequency.setValueAtTime(65.5, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 1.0);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.1);
    osc2.stop(now + 1.1);
  }


  // Helper to create white noise
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ============================================================
  // TENSION MUSIC — slow cinematic build (no harsh arpeggios)
  // Layers: deep drone → air texture → soft pulse → high shimmer at peak
  // intensity: 0.0 (calm) → 1.0 (critical)
  // ============================================================

  startTensionMusic() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    if (this._tensionPlaying && this._musicMaster) return;

    this._musicGen = (this._musicGen || 0) + 1;
    const gen = this._musicGen;
    this._clearMusicTimers();

    this._tensionPlaying = true;
    this._tensionIntensity = 0.12;
    this._musicStartTime = this.ctx.currentTime;

    this._musicMaster = this.ctx.createGain();
    this._musicMaster.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this._musicMaster.gain.exponentialRampToValueAtTime(1.0, this.ctx.currentTime + 2.5);

    this._musicComp = this.ctx.createDynamicsCompressor();
    this._musicComp.threshold.setValueAtTime(-20, this.ctx.currentTime);
    this._musicComp.knee.setValueAtTime(30, this.ctx.currentTime);
    this._musicComp.ratio.setValueAtTime(2.5, this.ctx.currentTime);
    this._musicComp.attack.setValueAtTime(0.03, this.ctx.currentTime);
    this._musicComp.release.setValueAtTime(0.5, this.ctx.currentTime);

    this._musicOut = this.ctx.createGain();
    this._musicOut.gain.setValueAtTime(0.38, this.ctx.currentTime);

    this._musicMaster.connect(this._musicComp);
    this._musicComp.connect(this._musicOut);
    this._musicOut.connect(this.ctx.destination);

    this._startDeepDrone();
    this._startAirBed();
    this._startSoftPulse();
    this._startShimmer();
    this._updateTensionParams();

    this._musicResumeWatch = setInterval(() => {
      if (this._musicGen !== gen || !this._tensionPlaying) return;
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }, 1000);
  }

  stopTensionMusic() {
    if (!this._tensionPlaying || !this.ctx) return;
    this._tensionPlaying = false;
    const gen = this._musicGen;

    const now = this.ctx.currentTime;
    if (this._musicMaster) {
      try {
        this._musicMaster.gain.cancelScheduledValues(now);
        this._musicMaster.gain.setValueAtTime(Math.max(0.0001, this._musicMaster.gain.value || 0.0001), now);
        this._musicMaster.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      } catch (_) {}
    }

    setTimeout(() => {
      if (this._musicGen !== gen) return;
      this._stopMusicNodes();
    }, 2000);
  }

  setTensionIntensity(level) {
    this._tensionIntensity = Math.max(0, Math.min(1, level));
    this._updateTensionParams();
  }

  _updateTensionParams() {
    if (!this.ctx || !this._tensionPlaying) return;
    const t = this._tensionIntensity;
    const now = this.ctx.currentTime;

    if (this._droneGain) {
      this._droneGain.gain.cancelScheduledValues(now);
      this._droneGain.gain.setTargetAtTime(0.10 + t * 0.14, now, 1.2);
    }
    if (this._droneFilter) {
      this._droneFilter.frequency.cancelScheduledValues(now);
      this._droneFilter.frequency.setTargetAtTime(90 + t * 180, now, 1.2);
    }

    if (this._airGain) {
      this._airGain.gain.cancelScheduledValues(now);
      this._airGain.gain.setTargetAtTime(0.03 + t * 0.09, now, 1.2);
    }
    if (this._airFilter) {
      this._airFilter.frequency.cancelScheduledValues(now);
      this._airFilter.frequency.setTargetAtTime(280 + t * 900, now, 1.2);
    }

    if (this._shimmerGain) {
      this._shimmerGain.gain.cancelScheduledValues(now);
      this._shimmerGain.gain.setTargetAtTime(Math.max(0, (t - 0.35) * 0.12), now, 1.5);
    }

    if (this._musicOut) {
      this._musicOut.gain.cancelScheduledValues(now);
      this._musicOut.gain.setTargetAtTime(0.34 + t * 0.16, now, 1.5);
    }

    // Retune pulse tempo when tension shifts
    if (this._pulseInterval) {
      const newInterval = Math.max(650, 1400 - t * 750);
      if (!this._lastPulseTempo || Math.abs(this._lastPulseTempo - newInterval) > 40) {
        this._schedulePulseLoop();
      }
    }
  }

  // Layer 1: Very low sustained drone — barely there at start, grows slowly
  _startDeepDrone() {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(41.2, this.ctx.currentTime);  // E1
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(61.74, this.ctx.currentTime); // B1 (fifth)

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.3, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.10, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this._musicMaster);

    osc1.start();
    osc2.start();

    this._droneOsc1 = osc1;
    this._droneOsc2 = osc2;
    this._droneFilter = filter;
    this._droneGain = gain;
  }

  // Layer 2: Filtered air / room tone that opens up as tension rises
  _startAirBed() {
    const bufLen = this.ctx.sampleRate * 6;
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.6, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._musicMaster);

    src.start();

    this._airSrc = src;
    this._airFilter = filter;
    this._airGain = gain;
  }

  // Layer 3: Soft distant pulse — like a slow clock, speeds up with tension
  _startSoftPulse() {
    this._pulseGain = this.ctx.createGain();
    this._pulseGain.gain.setValueAtTime(0.14, this.ctx.currentTime);
    this._pulseGain.connect(this._musicMaster);
    this._schedulePulseLoop();
  }

  _fireSoftPulse() {
    if (!this._tensionPlaying || !this.ctx || !this._pulseGain) return;
    const t = this._tensionIntensity;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(72 + t * 18, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);

    const vol = 0.12 + t * 0.18;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(env);
    env.connect(this._pulseGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  _schedulePulseLoop() {
    clearInterval(this._pulseInterval);
    const t = this._tensionIntensity;
    const interval = Math.max(650, 1400 - t * 750);
    this._lastPulseTempo = interval;
    this._pulseInterval = setInterval(() => this._fireSoftPulse(), interval);
  }

  // Layer 4: High shimmer — only becomes audible past mid-tension
  _startShimmer() {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._musicMaster);

    osc.start();

    this._shimmerOsc = osc;
    this._shimmerFilter = filter;
    this._shimmerGain = gain;
  }

  _clearMusicTimers() {
    clearInterval(this._pulseInterval);
    clearInterval(this._musicResumeWatch);
    this._pulseInterval = null;
    this._musicResumeWatch = null;
  }

  _stopMusicNodes() {
    const nodes = [
      this._droneOsc1, this._droneOsc2,
      this._airSrc, this._shimmerOsc
    ];
    nodes.forEach(n => {
      try { if (n) n.stop(); } catch (_) {}
    });

    this._clearMusicTimers();

    try { if (this._musicMaster) this._musicMaster.disconnect(); } catch (_) {}
    try { if (this._musicComp) this._musicComp.disconnect(); } catch (_) {}
    try { if (this._musicOut) this._musicOut.disconnect(); } catch (_) {}

    this._droneOsc1 = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._airSrc = null;
    this._airFilter = null;
    this._airGain = null;
    this._pulseGain = null;
    this._shimmerOsc = null;
    this._shimmerFilter = null;
    this._shimmerGain = null;
    this._musicMaster = null;
    this._musicComp = null;
    this._musicOut = null;
  }
}

// Export a single instance to be used everywhere
window.quantumAudio = new QuantumAudio();