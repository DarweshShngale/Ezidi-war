type Effect = 'step' | 'rock' | 'shot' | 'reload' | 'rescue' | 'hit' | 'finish' | 'pick' | 'wind' | 'boom'

const clamp = (value: number, low = 0, high = 1) =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low

// Original phrases in two registers. A rest gives space to the wind and dialogue.
const phrases: ReadonlyArray<ReadonlyArray<number | null>> = [
  [0, null, 7, 9, 12, null, 7, 5, 4, null, 2, null],
  [0, null, 7, null, 8, 7, null, 3, 2, null, 0, null],
  [7, null, 5, 3, null, 2, 0, null, 3, null, null, null],
  [0, 7, null, 12, null, 10, 7, null, 5, 7, null, null],
  [0, null, null, 7, null, 8, null, 7, 3, null, null, null],
  [0, null, 3, 5, null, 7, 10, null, 7, null, 5, null],
  [2, null, 5, 7, null, 10, 7, 5, 3, null, 2, null],
  [0, null, 4, 7, 9, null, 12, null, 9, 7, 4, null],
]

const roots = [50, 48, 50, 53, 47, 50, 48, 50]
const beats = [0.54, 0.65, 0.73, 0.66, 0.81, 0.60, 0.66, 0.60]

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export class Sound {
  private audio?: AudioContext
  private master?: GainNode
  private music?: GainNode
  private effects?: GainNode
  private levels = { music: 0.55, dialogue: 0.9, effects: 0.8 }
  private active = true
  private muted = false
  private scene = 0
  private beat = 0
  private timer?: number
  private noise?: AudioBuffer
  private wind?: AudioBufferSourceNode
  private speech?: SpeechSynthesisUtterance
  private lastStep = -1
  private lastShot = -1
  private readonly strings = new Map<number, AudioBuffer>()
  private readonly playing = new Set<AudioScheduledSourceNode>()

  unlock() {
    if (!this.audio) {
      const legacy = window as Window & { webkitAudioContext?: typeof AudioContext }
      const Audio = window.AudioContext ?? legacy.webkitAudioContext
      if (!Audio) return
      try {
        this.audio = new Audio()
      } catch {
        return
      }
      const a = this.audio
      this.master = a.createGain()
      this.music = a.createGain()
      this.effects = a.createGain()
      const limiter = a.createDynamicsCompressor()
      limiter.threshold.value = -12
      limiter.ratio.value = 5
      this.master.gain.value = 0
      this.master.connect(limiter).connect(a.destination)
      this.music.connect(this.master)
      this.effects.connect(this.master)
      this.setLevels(this.levels.music, this.levels.dialogue, this.levels.effects)
      const rate = 22050
      this.noise = a.createBuffer(1, rate * 2, rate)
      const data = this.noise.getChannelData(0)
      const random = seededRandom(61379)
      for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1
      // Prime the platform's asynchronous voice catalogue during a user gesture.
      window.speechSynthesis?.getVoices()
      document.addEventListener('visibilitychange', this.sync)
      a.addEventListener('statechange', this.sync)
    }
    if (this.audio.state === 'suspended') void this.audio.resume().then(this.sync).catch(() => {})
    this.sync()
  }

  setLevels(music: number, dialogue: number, effects: number) {
    this.levels = { music: clamp(music), dialogue: clamp(dialogue), effects: clamp(effects) }
    const now = this.audio?.currentTime ?? 0
    this.music?.gain.setTargetAtTime(this.levels.music * 0.64, now, 0.04)
    this.effects?.gain.setTargetAtTime(this.levels.effects * 0.85, now, 0.04)
    if (this.levels.dialogue === 0) this.stopSpeech()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.sync()
  }

  mood(index: number) {
    const scene = Math.trunc(clamp(index, 0, phrases.length - 1))
    if (scene !== this.scene) {
      this.stopScene()
      this.stopSpeech()
      this.scene = scene
    }
    this.active = true
    this.sync()
  }

  quiet() {
    this.active = false
    this.sync()
  }

  private audible() {
    return this.active && !this.muted && !document.hidden
  }

  private sync = () => {
    const a = this.audio
    if (!this.audible() || (a && a.state !== 'running')) {
      this.stopScene()
      this.stopSpeech()
      if (a && this.master) this.master.gain.setTargetAtTime(0, a.currentTime, 0.012)
      return
    }
    if (!a || a.state !== 'running' || !this.master || !this.effects || !this.noise) return
    this.master.gain.setTargetAtTime(0.78, a.currentTime, 0.045)
    if (this.wind) return
    const wind = a.createBufferSource()
    const filter = a.createBiquadFilter()
    const volume = a.createGain()
    wind.buffer = this.noise
    wind.loop = true
    filter.type = 'lowpass'
    filter.frequency.value = this.scene === 3 ? 840 : this.scene === 4 ? 440 : 620
    volume.gain.value = this.scene === 3 ? 0.12 : 0.065
    wind.connect(filter).connect(volume).connect(this.effects)
    this.track(wind, [filter, volume])
    this.wind = wind
    wind.start()
    this.playBeat()
  }

  private stopScene() {
    window.clearTimeout(this.timer)
    this.timer = undefined
    this.wind = undefined
    this.beat = 0
    const when = (this.audio?.currentTime ?? 0) + 0.035
    for (const source of this.playing) {
      try { source.stop(when) } catch { /* The source may already have ended. */ }
    }
    this.playing.clear()
  }

  private track(source: AudioScheduledSourceNode, branch: AudioNode[]) {
    this.playing.add(source)
    source.addEventListener('ended', () => {
      source.disconnect()
      for (const node of branch) node.disconnect()
      this.playing.delete(source)
    }, { once: true })
  }

  private stringBuffer(midi: number) {
    const cached = this.strings.get(midi)
    if (cached) return cached
    const a = this.audio!
    const rate = 22050
    const length = Math.round(rate / (440 * 2 ** ((midi - 69) / 12)))
    const delay = new Float32Array(length)
    const random = seededRandom(97 + midi)
    for (let i = 0; i < length; i++) delay[i] = random() * 2 - 1
    const buffer = a.createBuffer(1, rate * 2, rate)
    const samples = buffer.getChannelData(0)
    let cursor = 0
    for (let i = 0; i < samples.length; i++) {
      const next = (cursor + 1) % length
      samples[i] = delay[cursor]
      delay[cursor] = 0.498 * (delay[cursor] + delay[next])
      cursor = next
    }
    this.strings.set(midi, buffer)
    return buffer
  }

  private pluck(midi: number, at: number, level: number, channel: GainNode, pan = 0) {
    const a = this.audio!
    const source = a.createBufferSource()
    source.buffer = this.stringBuffer(midi)
    const gain = a.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level, at + 0.004)
    gain.gain.setTargetAtTime(0, at + 0.85, 0.3)
    source.connect(gain)
    this.track(source, [gain, ...this.route(gain, channel, pan)])
    source.start(at)
  }

  private route(output: AudioNode, channel: GainNode, pan: number): AudioNode[] {
    const a = this.audio!
    if (a.createStereoPanner && pan !== 0) {
      const position = a.createStereoPanner()
      position.pan.value = clamp(pan, -1, 1)
      output.connect(position).connect(channel)
      return [position]
    }
    output.connect(channel)
    return []
  }

  private playBeat = () => {
    if (!this.audio || !this.music || !this.audible() || !this.wind) return
    const sequence = phrases[this.scene]
    const n = this.beat % sequence.length
    const note = sequence[n]
    const root = roots[this.scene]
    const at = this.audio.currentTime + 0.015
    if (this.levels.music > 0) {
      if (n === 0 || n === 6) {
        this.pluck(root - 12 + (n === 0 ? 0 : 7), at, 0.65, this.music, -0.18)
      }
      if (note !== null) {
        this.pluck(root + note + 12, at + 0.04, 0.46, this.music, 0.23)
      }
    }
    this.beat++
    this.timer = window.setTimeout(this.playBeat, beats[this.scene] * 1000)
  }

  private burst(at: number, length: number, cutoff: number, gainLevel: number, pan: number) {
    const a = this.audio!
    const source = a.createBufferSource()
    const filter = a.createBiquadFilter()
    const gain = a.createGain()
    source.buffer = this.noise!
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoff, at)
    filter.frequency.exponentialRampToValueAtTime(Math.max(85, cutoff * 0.25), at + length)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(gainLevel, at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    source.connect(filter).connect(gain)
    this.track(source, [filter, gain, ...this.route(gain, this.effects!, pan)])
    source.start(at, Math.random() * 0.6, length)
  }

  private tone(at: number, length: number, from: number, to: number, level: number, pan: number) {
    const a = this.audio!
    const source = a.createOscillator()
    const gain = a.createGain()
    source.type = 'sine'
    source.frequency.setValueAtTime(from, at)
    source.frequency.exponentialRampToValueAtTime(to, at + length)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(level, at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    source.connect(gain)
    this.track(source, [gain, ...this.route(gain, this.effects!, pan)])
    source.start(at)
    source.stop(at + length)
  }

  fx(type: Effect, pan = 0) {
    const a = this.audio
    if (!a || a.state !== 'running' || !this.effects || !this.noise || !this.audible() || this.levels.effects <= 0) return
    if (this.playing.size > 52) return
    const t = a.currentTime + 0.006
    switch (type) {
      case 'step':
      case 'rock': {
        if (t - this.lastStep < 0.15) return
        this.lastStep = t
        this.burst(t, 0.12, type === 'rock' ? 2600 : 1050, 0.38, pan)
        this.tone(t, 0.10, 109, 48, 0.15, pan)
        break
      }
      case 'shot':
        if (t - this.lastShot < 0.055) return
        this.lastShot = t
        this.burst(t, 0.22, 3300, 0.76, pan)
        this.tone(t, 0.16, 164, 49, 0.35, pan)
        break
      case 'boom':
        this.burst(t, 1.3, 1000, 0.64, pan)
        this.tone(t, 1, 83, 36, 0.30, pan)
        break
      case 'hit':
        this.tone(t, 0.26, 119, 44, 0.3, pan)
        this.burst(t, 0.13, 840, 0.38, pan)
        break
      case 'reload':
        this.burst(t, 0.1, 2450, 0.29, pan)
        this.burst(t + 0.24, 0.09, 3600, 0.36, pan)
        break
      case 'wind':
        this.burst(t, 1.35, 720, 0.21, pan)
        break
      case 'finish': {
        const cadence = [55, 62, 67, 71, 74]
        cadence.forEach((midi, i) => this.pluck(midi, t + i * 0.16, 0.52, this.effects!, pan))
        break
      }
      case 'rescue':
        this.pluck(62, t, 0.61, this.effects, pan)
        this.pluck(69, t + 0.18, 0.57, this.effects, pan)
        break
      case 'pick':
        this.pluck(74, t, 0.53, this.effects, pan)
        break
    }
  }

  speak(text: string) {
    this.stopSpeech()
    const synth = window.speechSynthesis
    if (!text.trim() || !synth || !this.audible() || this.levels.dialogue <= 0) return
    const voices = synth.getVoices().filter(voice => /^ar(?:[-_]|$)/i.test(voice.lang))
    const voice = voices.find(item => item.localService) ?? voices[0]
    if (!voice) return
    const speech = new SpeechSynthesisUtterance(text.includes(' — ') ? text.split(' — ').slice(1).join(' — ') : text)
    speech.voice = voice
    speech.lang = voice.lang
    speech.volume = this.levels.dialogue
    speech.rate = 0.92
    // Keep a strong reference until this utterance ends (also required by some mobile engines).
    this.speech = speech
    const release = () => {
      if (this.speech === speech) this.speech = undefined
    }
    speech.onend = release
    speech.onerror = release
    synth.speak(speech)
  }

  private stopSpeech() {
    if (!this.speech) return
    this.speech = undefined
    window.speechSynthesis?.cancel()
  }
}
