// ================================================================
//  坦克大战 — 输入处理模块
//  职责：键盘监听（document 级别，零延迟绑定）+
//        触屏监听（通过 setupTouchInput 延迟绑定，需等待 canvas 就绪）
//  依赖：Game.keys, Game.CANVAS_W, Game.CANVAS_H
//  加载顺序：可在 game.js 之前加载
// ================================================================
(function(Game) {
  'use strict';

  // ── 初始化输入状态 ──
  Game.keys = { up: false, down: false, left: false, right: false, fire: false };
  // 单发模式：按键按下瞬间标记，game.js 消费后清除（防止按住连发）
  Game.fireJustPressed = false;

  /** 将键盘事件映射到 keys 对象（双码兼容：e.code 物理 + e.key 逻辑） */
  Game.applyKey = function(e, pressed) {
    const c = e.code, k = e.key;
    if (c === 'ArrowUp'    || k === 'ArrowUp'    || c === 'KeyW' || k === 'w' || k === 'W') Game.keys.up    = pressed;
    if (c === 'ArrowDown'  || k === 'ArrowDown'  || c === 'KeyS' || k === 's' || k === 'S') Game.keys.down  = pressed;
    if (c === 'ArrowLeft'  || k === 'ArrowLeft'  || c === 'KeyA' || k === 'a' || k === 'A') Game.keys.left  = pressed;
    if (c === 'ArrowRight' || k === 'ArrowRight' || c === 'KeyD' || k === 'd' || k === 'D') Game.keys.right = pressed;

    // 射击键边沿检测：仅按键按下瞬间标记，不重复
    if (c === 'Space' || k === ' ' || k === 'Spacebar') {
      if (pressed && !Game.keys.fire) {
        Game.fireJustPressed = true;            // 单发请求
      }
      Game.keys.fire = pressed;
    }

    // 阻止游戏相关按键的默认行为（方向键 / 空格 / WASD 不滚动页面）
    const isGameKey = c === 'ArrowUp'    || c === 'ArrowDown'  || c === 'ArrowLeft' || c === 'ArrowRight'
                   || c === 'Space'      || c === 'KeyW'       || c === 'KeyA'      || c === 'KeyS' || c === 'KeyD';
    if (isGameKey) e.preventDefault();
  };

  // ── 键盘监听（document 级别，立即生效） ──
  // 注：回调中使用 Game.pauseOverlay / Game.resetGame 等，这些是运行时引用，
  // 在 keydown 回调执行时已由后续模块赋值，不存在时序问题。
  document.addEventListener('keydown', function(e) {
    Game.applyKey(e, true);

    // P 暂停 / 继续
    if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
      if (Game.gameStarted && !Game.gameOver) {
        Game.paused = !Game.paused;
        if (Game.paused) {
          Game.pauseOverlay.classList.add('active');
        } else {
          Game.pauseOverlay.classList.remove('active');
        }
      }
      e.preventDefault();
    }

    // R 重新开始
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      if (typeof Game.resetGame === 'function') {
        Game.resetGame();
      }
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('keyup', function(e) {
    Game.applyKey(e, false);
  }, { passive: false });

  // ── 触屏监听（延迟绑定，由 main.js 在 canvas 就绪后调用） ──
  Game.setupTouchInput = function() {
    const cv = Game.canvas;

    cv.addEventListener('touchstart', function(e) {
      e.preventDefault();
      Game.initAudio();
      const touch = e.touches[0];
      const rect = cv.getBoundingClientRect();
      const tx = touch.clientX - rect.left;
      const ty = touch.clientY - rect.top;

      // 右下角区域射击（单发模式）
      if (tx > Game.CANVAS_W * 0.6 && ty > Game.CANVAS_H * 0.6) {
        Game.keys.fire = true;
        Game.fireJustPressed = true;         // 触屏单发请求
        return;
      }

      // 根据触控点与玩家坦克的相对位置确定移动方向
      if (Game.player && Game.player.active) {
        const pc = Game.player.getCenter();
        const dx = tx - pc.x;
        const dy = ty - pc.y;

        Game.keys.up = Game.keys.down = Game.keys.left = Game.keys.right = false;
        if (Math.abs(dx) > Math.abs(dy)) {
          Game.keys[dx > 0 ? 'right' : 'left'] = true;
        } else {
          Game.keys[dy > 0 ? 'down' : 'up'] = true;
        }
      }
    });

    cv.addEventListener('touchmove', function(e) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = cv.getBoundingClientRect();
      const tx = touch.clientX - rect.left;
      const ty = touch.clientY - rect.top;

      // 跟踪射击区域状态（仅用于 HUD 显示，不重复发射）
      Game.keys.fire = (tx > Game.CANVAS_W * 0.6 && ty > Game.CANVAS_H * 0.6);

      if (Game.player && Game.player.active) {
        const pc = Game.player.getCenter();
        const dx = tx - pc.x;
        const dy = ty - pc.y;

        Game.keys.up = Game.keys.down = Game.keys.left = Game.keys.right = false;
        if (Math.abs(dx) > Math.abs(dy)) {
          Game.keys[dx > 0 ? 'right' : 'left'] = true;
        } else {
          Game.keys[dy > 0 ? 'down' : 'up'] = true;
        }
      }
    });

    cv.addEventListener('touchend', function(e) {
      e.preventDefault();
      Game.keys.up = Game.keys.down = Game.keys.left = Game.keys.right = Game.keys.fire = false;
    });
  };

})(window.Game = window.Game || {});
