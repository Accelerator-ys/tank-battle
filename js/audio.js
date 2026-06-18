// ================================================================
//  坦克大战 — 音频系统
//  职责：使用 Web Audio API 实时合成 8-bit 复古音效
//  依赖：无（audioCtx 为模块局部变量，仅在用户交互后初始化）
// ================================================================
(function(Game) {
  'use strict';

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  /** 延迟初始化音频上下文（需用户交互后调用） */
  Game.initAudio = function() {
    if (audioCtx) return;
    try {
      audioCtx = new AudioCtx();
    } catch (_) {
      // 静默失败，游戏仍可运行（无音效）
    }
  };

  /** 播放射击音效：短促高频方波下滑 */
  Game.playShoot = function() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
  };

  /** 播放爆炸音效：低频锯齿波衰减 */
  Game.playExplosion = function() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.45);
  };

  /** 播放拾取道具音效：上升四音阶正弦波 */
  Game.playPowerUp = function() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, audioCtx.currentTime);
    osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2);
    osc.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.4);
  };

  /** 播放通关音效：胜利六音号角 */
  Game.playLevelUp = function() {
    if (!audioCtx) return;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach(function(freq, i) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'square';
      const t = audioCtx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  };

  /** 播放玩家被击中音效 */
  Game.playHit = function() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.35);
  };

  /** 播放游戏结束音效：下行四音三角波 */
  Game.playGameOver = function() {
    if (!audioCtx) return;
    const notes = [440, 370, 311, 261];
    notes.forEach(function(freq, i) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      const t = audioCtx.currentTime + i * 0.2;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  };

})(window.Game = window.Game || {});
