// ================================================================
//  坦克大战 — 道具系统
//  职责：道具生成（概率加权）、拾取激活、效果到期取消
//  依赖：Game.POWERUP_TYPES, Game.POWERUP_DURATION, Game.POWERUP_SIZE,
//        Game.powerUps, Game.activePower, Game.activePowerTimer
// ================================================================
(function(Game) {
  'use strict';

  /** 在位置 (x, y) 概率生成一个道具（避开墙壁） */
  Game.spawnPowerUp = function(x, y) {
    var types = ['shield', 'speed', 'rapid', 'life'];
    var weights = [0.3, 0.3, 0.3, 0.1];    // 生命+1 权重最低
    var r = Math.random();
    var cumulative = 0;
    var chosenType = 'shield';

    for (var i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) {
        chosenType = types[i];
        break;
      }
    }

    var px = x - Game.POWERUP_SIZE / 2;
    var py = y - Game.POWERUP_SIZE / 2;
    var pw = Game.POWERUP_SIZE;
    var ph = Game.POWERUP_SIZE;

    // 检查是否与墙壁重叠，若有重叠则偏移直到找到空位
    var maxAttempts = 8;
    var offsets = [0, 15, -15, 30, -30, 45, -45, 60];
    var placed = false;

    for (var a = 0; a < maxAttempts; a++) {
      var tx = px + offsets[a];
      var ty = py + (a % 2 === 0 ? offsets[a] : 0);
      var collides = false;

      // 边界检查
      if (tx < 0 || tx + pw > Game.CANVAS_W || ty < 0 || ty + ph > Game.CANVAS_H) {
        continue;
      }

      // 墙壁碰撞检查
      for (var w = 0; w < Game.walls.length; w++) {
        if (Game.rectCollide(
          { x: tx, y: ty, w: pw, h: ph },
          { x: Game.walls[w].x, y: Game.walls[w].y, w: Game.walls[w].width, h: Game.walls[w].height }
        )) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        Game.powerUps.push({
          x: tx,
          y: ty,
          w: pw,
          h: ph,
          type: chosenType,
          timer: 600                          // 10 秒后消失
        });
        placed = true;
        break;
      }
    }

    // 所有偏移位都重叠 → 放弃生成（避免道具卡墙内）
  };

  /** 激活道具效果 */
  Game.activatePowerUp = function(type) {
    Game.activePower = type;
    Game.activePowerTimer = Game.POWERUP_DURATION;

    // 生命+1 立即生效，不占用道具槽
    if (type === 'life') {
      Game.lives = Math.min(Game.lives + 1, 99);
      Game.livesEl.textContent = Game.lives;
      Game.screenFlash = 15;
      Game.activePower = null;
      Game.activePowerTimer = 0;
      Game.powerIcon.classList.remove('active');
      Game.gameHeader.classList.remove('power-active');
      return;
    }

    // 更新 HUD 指示器
    Game.powerIcon.textContent = Game.POWERUP_TYPES[type].label;
    Game.powerIcon.classList.add('active');
    Game.gameHeader.classList.add('power-active');
  };

  /** 取消道具效果 */
  Game.deactivatePowerUp = function() {
    Game.activePower = null;
    Game.activePowerTimer = 0;
    Game.powerIcon.classList.remove('active');
    Game.gameHeader.classList.remove('power-active');
  };

})(window.Game = window.Game || {});
