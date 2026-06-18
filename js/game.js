// ================================================================
//  坦克大战 — 游戏核心逻辑（状态、更新、渲染、主循环）
//  职责：管理全部运行时状态，驱动每帧更新与绘制
//  依赖：Game 上的全部常量、工具、类、DOM 引用
//  加载顺序：必须最后加载（除 main.js 外）
// ================================================================
(function(Game) {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  //  游戏状态变量初始化
  // ──────────────────────────────────────────────────────────────
  Game.score          = 0;
  Game.lives          = 3;
  Game.level          = 1;
  Game.totalKills     = 0;               // 累计击毁敌坦数
  Game.gameOver       = false;
  Game.gameStarted    = false;
  Game.paused         = false;

  Game.player         = null;
  Game.enemies        = [];
  Game.playerBullets  = [];
  Game.enemyBullets   = [];
  Game.walls          = [];
  Game.explosions     = [];
  Game.powerUps       = [];

  // 道具效果状态
  Game.activePower      = null;          // null | 'shield' | 'speed' | 'rapid'
  Game.activePowerTimer = 0;

  // 屏幕特效
  Game.shakeTimer       = 0;
  Game.shakeIntensity   = 0;
  Game.screenFlash      = 0;             // 屏幕闪白倒计时
  Game.playerInvincible = 0;

  // 关卡过渡
  Game.levelTransitionTimer = 0;
  Game.transitionLevel      = 0;         // 过渡动画显示的关卡号

  // 帧计数 & 本关固定敌人数
  Game.frameCount        = 0;
  Game.levelEnemyCount   = 0;               // 本关敌人数（用于 HUD 显示剩余/总数）

  // ==============================================================
  //  游戏逻辑函数
  // ==============================================================

  /** 完全重置游戏状态并开始新游戏 */
  Game.resetGame = function() {
    Game.score          = 0;
    Game.lives          = 3;
    Game.level          = 1;
    Game.totalKills     = 0;
    Game.gameOver       = false;
    Game.gameStarted    = true;
    Game.paused         = false;
    Game.frameCount     = 0;
    Game.playerInvincible = 0;
    Game.shakeTimer       = 0;
    Game.shakeIntensity   = 0;
    Game.screenFlash      = 0;
    Game.levelTransitionTimer = 0;

    // 本关固定敌人数
    Game.levelEnemyCount = Math.min(Game.level + Game.BASE_ENEMY_COUNT - 1, Game.MAX_ENEMIES_CAP);

    // 道具状态
    Game.powerUps = [];
    Game.deactivatePowerUp();

    // 创建玩家坦克
    Game.player = new Game.Tank(
      Game.CANVAS_W / 2 - (Game.TILE_SIZE - 4) / 2,
      Game.CANVAS_H - Game.TILE_SIZE * 2,
      '#2ecc71',
      'up',
      true
    );

    Game.enemies        = [];
    Game.playerBullets  = [];
    Game.enemyBullets   = [];
    Game.explosions     = [];

    // 重置地图模板轮转计数器（新游戏从模板 0 开始）
    Game.resetMapTemplates();
    Game.buildWalls();
    Game.updateUI();

    // 一次性生成全部本关敌人
    for (let i = 0; i < Game.levelEnemyCount; i++) {
      Game.spawnEnemy();
    }

    // 隐藏所有覆盖层
    Game.startOverlay.classList.remove('active');
    Game.gameoverOverlay.classList.remove('active');
    Game.pauseOverlay.classList.remove('active');

    Game.canvas.focus();
  };

  /** 进入下一关 */
  Game.nextLevel = function() {
    Game.level++;
    Game.transitionLevel = Game.level;

    // 关卡过渡动画
    Game.levelTransitionTimer = Game.LEVEL_TRANSITION_FRAMES;
    Game.levelTransition.textContent = '第 ' + Game.level + ' 关';
    Game.levelTransition.classList.remove('show');
    void Game.levelTransition.offsetWidth;                 // 触发回流重启动画
    Game.levelTransition.classList.add('show');

    Game.playLevelUp();

    // 重置战斗状态
    Game.playerInvincible = Game.INVINCIBLE_TIME;
    Game.player.x = Game.CANVAS_W / 2 - Game.player.width / 2;
    Game.player.y = Game.CANVAS_H - Game.TILE_SIZE * 2;
    Game.player.direction = 'up';
    Game.playerBullets = [];
    Game.enemyBullets  = [];
    Game.explosions    = [];
    Game.enemies       = [];
    Game.powerUps      = [];
    Game.deactivatePowerUp();

    // 本关固定敌人数
    Game.levelEnemyCount = Math.min(Game.level + Game.BASE_ENEMY_COUNT - 1, Game.MAX_ENEMIES_CAP);

    Game.buildWalls();
    Game.updateUI();

    // 一次性生成全部本关敌人
    const count = Game.levelEnemyCount;
    for (let i = 0; i < count; i++) {
      Game.spawnEnemy();
    }
  };

  /** 更新 DOM UI 显示 */
  Game.updateUI = function() {
    Game.scoreEl.textContent = Game.score;
    Game.livesEl.textContent = Game.lives;
    Game.levelEl.textContent = Game.level;
  };

  // ==============================================================
  //  主更新循环
  // ==============================================================
  Game.update = function() {
    if (Game.gameOver || !Game.gameStarted) return;

    // 关卡过渡期间暂停游戏逻辑
    if (Game.levelTransitionTimer > 0) {
      Game.levelTransitionTimer--;
      return;
    }

    if (Game.paused) return;

    Game.frameCount++;

    // --- 倒计时更新 ---
    if (Game.playerInvincible > 0)  Game.playerInvincible--;
    if (Game.shakeTimer > 0)        Game.shakeTimer--;
    if (Game.screenFlash > 0)       Game.screenFlash--;
    if (Game.player && Game.player.fireCooldown > 0) Game.player.fireCooldown--;

    for (let i = 0; i < Game.enemies.length; i++) {
      const enemy = Game.enemies[i];
      if (enemy.fireCooldown > 0) enemy.fireCooldown--;
    }

    // --- 道具计时 ---
    if (Game.activePowerTimer > 0) {
      Game.activePowerTimer--;
      if (Game.activePowerTimer <= 0) Game.deactivatePowerUp();
    }

    // --- 道具消失计时 ---
    for (let i = 0; i < Game.powerUps.length; i++) {
      Game.powerUps[i].timer--;
    }
    Game.powerUps = Game.powerUps.filter(function(p) { return p.timer > 0; });

    // --- 全部坦克列表（用于碰撞检测） ---
    const allTanks = [Game.player].concat(Game.enemies);

    // --- 玩家输入处理 ---
    if (Game.player && Game.player.active) {
      let dx = 0, dy = 0;
      if (Game.keys.up)         { dy = -Game.player.getSpeed(); Game.player.direction = 'up'; }
      else if (Game.keys.down)  { dy = Game.player.getSpeed();  Game.player.direction = 'down'; }
      else if (Game.keys.left)  { dx = -Game.player.getSpeed(); Game.player.direction = 'left'; }
      else if (Game.keys.right) { dx = Game.player.getSpeed();  Game.player.direction = 'right'; }

      if (dx !== 0 || dy !== 0) {
        Game.player.move(dx, dy, Game.walls, allTanks);
      }

      // 射击：单发模式，仅按键瞬间响应（fireJustPressed 由 input 模块边沿检测设置）
      if (Game.fireJustPressed && Game.player.fireCooldown <= 0) {
        Game.player.fire(Game.playerBullets, false);
        Game.fireJustPressed = false;           // 消费单发标记
      }
    }

    // --- 敌人 AI ---
    for (let i = 0; i < Game.enemies.length; i++) {
      Game.enemies[i].updateAI(Game.walls, allTanks, Game.enemyBullets);
    }

    // --- 玩家子弹更新 ---
    for (let i = 0; i < Game.playerBullets.length; i++) {
      const bullet = Game.playerBullets[i];
      bullet.update();

      if (bullet.active && bullet.collidesWithWall(Game.walls)) {
        bullet.active = false;
      }

      if (bullet.active) {
        for (let j = 0; j < Game.enemies.length; j++) {
          const enemy = Game.enemies[j];
          if (!enemy.active) continue;
          if (bullet.collidesWith(enemy)) {
            bullet.active = false;
            enemy.hit();
            break;
          }
        }
      }
    }

    // --- 敌人子弹更新 ---
    for (let i = 0; i < Game.enemyBullets.length; i++) {
      const bullet = Game.enemyBullets[i];
      bullet.update();

      if (bullet.active && bullet.collidesWithWall(Game.walls)) {
        bullet.active = false;
      }

      if (bullet.active && Game.player && Game.player.active) {
        if (bullet.collidesWith(Game.player)) {
          bullet.active = false;
          Game.player.hit();
        }
      }
    }

    // --- 道具拾取检测 ---
    if (Game.player && Game.player.active) {
      for (let i = Game.powerUps.length - 1; i >= 0; i--) {
        if (Game.player.collidesWith(Game.powerUps[i])) {
          Game.playPowerUp();
          Game.activatePowerUp(Game.powerUps[i].type);
          Game.powerUps.splice(i, 1);
        }
      }
    }

    // --- 粒子更新 ---
    for (let i = 0; i < Game.explosions.length; i++) {
      const exp = Game.explosions[i];
      exp.life--;
      exp.x += exp.vx;
      exp.y += exp.vy;
      exp.vx *= 0.96;
      exp.vy *= 0.96;
    }

    // --- 清理 ---
    Game.playerBullets = Game.playerBullets.filter(function(b) { return b.active; });
    Game.enemyBullets  = Game.enemyBullets.filter(function(b)  { return b.active; });
    Game.enemies       = Game.enemies.filter(function(e)       { return e.active; });
    Game.explosions    = Game.explosions.filter(function(e)    { return e.life > 0; });

    // --- 关卡完成检测 ---
    if (Game.enemies.filter(function(e) { return e.active; }).length === 0 &&
        Game.levelTransitionTimer <= 0) {
      Game.nextLevel();
    }
  };

  // ==============================================================
  //  渲染函数
  // ==============================================================

  /** 绘制深色网格背景 */
  Game.drawBackground = function() {
    const ctx = Game.ctx;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, Game.CANVAS_W, Game.CANVAS_H);

    ctx.strokeStyle = 'rgba(30, 30, 50, 0.5)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= Game.CANVAS_W; x += Game.TILE_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Game.CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= Game.CANVAS_H; y += Game.TILE_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(Game.CANVAS_W, y); ctx.stroke();
    }
  };

  /** 绘制墙壁：砖墙（纹理） + 钢墙（渐变+铆钉+十字纹） */
  Game.drawWalls = function() {
    const ctx = Game.ctx;
    for (let i = 0; i < Game.walls.length; i++) {
      const w = Game.walls[i];
      if (w.type === 'brick') {
        // 砖墙
        ctx.fillStyle = '#b5651d';
        ctx.fillRect(w.x, w.y, w.width, w.height);
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 1;
        ctx.strokeRect(w.x, w.y, w.width, w.height);

        // 砖块纹理线
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 0.5;
        for (let by = w.y + 10; by < w.y + w.height; by += 10) {
          ctx.beginPath(); ctx.moveTo(w.x, by); ctx.lineTo(w.x + w.width, by); ctx.stroke();
        }
        for (let bx = w.x + 15; bx < w.x + w.width; bx += 15) {
          ctx.beginPath(); ctx.moveTo(bx, w.y); ctx.lineTo(bx, w.y + 10); ctx.stroke();
        }
        for (let bx = w.x + 7; bx < w.x + w.width; bx += 15) {
          ctx.beginPath(); ctx.moveTo(bx, w.y + 10); ctx.lineTo(bx, w.y + 20); ctx.stroke();
        }
        for (let bx = w.x + 15; bx < w.x + w.width; bx += 15) {
          ctx.beginPath(); ctx.moveTo(bx, w.y + 20); ctx.lineTo(bx, w.y + 30); ctx.stroke();
        }
      } else if (w.type === 'steel') {
        // 钢墙（不可摧毁）
        const gradient = ctx.createLinearGradient(w.x, w.y, w.x + w.width, w.y + w.height);
        gradient.addColorStop(0, '#a0a0a0');
        gradient.addColorStop(0.5, '#d0d0d0');
        gradient.addColorStop(1, '#808080');
        ctx.fillStyle = gradient;
        ctx.fillRect(w.x, w.y, w.width, w.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x + 1, w.y + 1, w.width - 2, w.height - 2);

        // 铆钉装饰
        ctx.fillStyle = '#555';
        const rivets = [
          [6, 6], [w.width - 6, 6],
          [6, w.height - 6], [w.width - 6, w.height - 6]
        ];
        for (let j = 0; j < rivets.length; j++) {
          ctx.beginPath();
          ctx.arc(w.x + rivets[j][0], w.y + rivets[j][1], 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 十字加固纹
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w.x + w.width / 2, w.y + 2);
        ctx.lineTo(w.x + w.width / 2, w.y + w.height - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w.x + 2, w.y + w.height / 2);
        ctx.lineTo(w.x + w.width - 2, w.y + w.height / 2);
        ctx.stroke();
      }
    }
  };

  /** 绘制道具（脉冲光环 + 主体 + 图标） */
  Game.drawPowerUps = function() {
    const ctx = Game.ctx;
    for (let i = 0; i < Game.powerUps.length; i++) {
      const pu = Game.powerUps[i];
      const cx = pu.x + pu.w / 2;
      const cy = pu.y + pu.h / 2;
      const pulse = Math.sin(Game.frameCount * 0.08) * 3;
      const alpha = pu.timer < 120 ? pu.timer / 120 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // 外发光
      ctx.beginPath();
      ctx.arc(cx, cy, pu.w / 2 + 4 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = Game.hexToRgba(Game.POWERUP_TYPES[pu.type].color, 0.2);
      ctx.fill();

      // 道具主体
      ctx.beginPath();
      ctx.arc(cx, cy, pu.w / 2, 0, Math.PI * 2);
      ctx.fillStyle = Game.POWERUP_TYPES[pu.type].color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 图标文字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Game.POWERUP_TYPES[pu.type].label, cx, cy);

      ctx.restore();
    }
  };

  /** 绘制粒子爆炸 */
  Game.drawExplosions = function() {
    const ctx = Game.ctx;
    for (let i = 0; i < Game.explosions.length; i++) {
      const exp = Game.explosions[i];
      const alpha = exp.life / exp.maxLife;
      const color = exp.color;

      // 处理各种颜色格式（#hex / rgb() / rgba()）
      ctx.globalAlpha = alpha;
      if (color.startsWith('#')) {
        ctx.fillStyle = color;
      } else if (color.startsWith('rgb(')) {
        ctx.fillStyle = color.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
      } else if (color.startsWith('rgba(')) {
        ctx.fillStyle = color;
      } else {
        ctx.fillStyle = color;
      }

      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /** 主绘制函数 */
  Game.draw = function() {
    const ctx = Game.ctx;
    ctx.clearRect(0, 0, Game.CANVAS_W, Game.CANVAS_H);

    // 屏幕震动
    ctx.save();
    if (Game.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * Game.shakeIntensity * (Game.shakeTimer / 20);
      const sy = (Math.random() - 0.5) * Game.shakeIntensity * (Game.shakeTimer / 20);
      ctx.translate(sx, sy);
    }

    Game.drawBackground();
    Game.drawWalls();
    Game.drawPowerUps();

    // 坦克（敌人在下，玩家在上）
    for (let i = 0; i < Game.enemies.length; i++) { Game.enemies[i].draw(ctx); }
    if (Game.player && Game.player.active) { Game.player.draw(ctx); }

    // 子弹
    for (let i = 0; i < Game.playerBullets.length; i++) { Game.playerBullets[i].draw(ctx); }
    for (let i = 0; i < Game.enemyBullets.length; i++)  { Game.enemyBullets[i].draw(ctx); }

    // 粒子
    Game.drawExplosions();

    ctx.restore();

    // 屏幕闪白（不受震动影响）
    if (Game.screenFlash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (Game.screenFlash / 25) + ')';
      ctx.fillRect(0, 0, Game.CANVAS_W, Game.CANVAS_H);
    }

    // ── HUD（不受震动影响） ──
    if (!Game.gameOver && Game.gameStarted) {
      // 敌人数 & 击毁数
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(5, 5, 260, 42);          // 高度从25→42容纳第二行
      ctx.fillStyle = '#aaa';
      ctx.font = '12px "Courier New"';
      ctx.textAlign = 'left';
      var activeEnemies = Game.enemies.filter(function(e) { return e.active; }).length;
      ctx.fillText('敌方剩余: ' + activeEnemies + '/' + Game.levelEnemyCount + '  |  击毁: ' + Game.totalKills, 10, 22);

      // AI 模式分布（第二行）
      var patrolCount = 0, guardCount = 0;
      for (var i = 0; i < Game.enemies.length; i++) {
        if (!Game.enemies[i].active) continue;
        if (Game.enemies[i].aiMode === Game.AI_MODE.GUARD) {
          guardCount++;
        } else {
          patrolCount++;
        }
      }
      ctx.fillStyle = '#999';
      ctx.font = '10px "Courier New"';
      ctx.fillText(
        '\uD83D\uDD35\u5DE1:' + patrolCount + '  \uD83D\uDFE1\u5B88:' + guardCount,
        10, 39
      );

      // 道具剩余时间条
      if (Game.activePowerTimer > 0 && Game.activePower) {
        const barW = 120;
        const barH = 6;
        const barX = Game.CANVAS_W - barW - 10;
        const barY = Game.CANVAS_H - 18;
        const progress = Game.activePowerTimer / Game.POWERUP_DURATION;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        ctx.fillStyle = Game.POWERUP_TYPES[Game.activePower].color;
        ctx.fillRect(barX, barY, barW * progress, barH);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = '10px "Courier New"';
        ctx.textAlign = 'right';
        ctx.fillText(Game.POWERUP_TYPES[Game.activePower].name, barX - 5, barY + barH);
      }

      // 输入指示（实时显示当前按键状态）
      if (!Game.paused) {
        const pressed = [];
        if (Game.keys.up)    pressed.push('\u2191');
        if (Game.keys.down)  pressed.push('\u2193');
        if (Game.keys.left)  pressed.push('\u2190');
        if (Game.keys.right) pressed.push('\u2192');
        if (Game.keys.fire)  pressed.push('射击');
        const keyStr = pressed.length > 0 ? pressed.join(' ') : '(按方向键或WASD移动)';
        const keyColor = pressed.length > 0 ? '#4ecdc4' : '#ff6b6b';
        ctx.fillStyle = keyColor;
        ctx.font = 'bold 14px "Courier New"';
        ctx.textAlign = 'right';
        ctx.fillText(keyStr, Game.CANVAS_W - 10, Game.CANVAS_H - 26);
      }

      // ── 调试信息栏（左下角） ──
      const debugY = Game.CANVAS_H - 8;
      ctx.fillStyle = '#666';
      ctx.font = '10px "Courier New"';
      ctx.textAlign = 'left';

      const stateStr = Game.paused ? '\u23F8暂停' : '\u25B6运行';
      const hasInput = Game.keys.up || Game.keys.down || Game.keys.left || Game.keys.right || Game.keys.fire;
      const keyState = hasInput ? '\u2705有输入' : '等待按键';
      ctx.fillText('帧:' + Game.frameCount + ' ' + stateStr + ' | ' + keyState, 10, debugY);

      const dirStr = Game.player ? Game.player.direction : '-';
      const spd = Game.player ? Game.player.getSpeed() : 0;
      const inv = Game.playerInvincible;
      const activeEnemies2 = Game.enemies.filter(function(e) { return e.active; }).length;
      ctx.fillText(
        '方向:' + dirStr + ' 速度:' + spd + ' 无敌:' + inv + ' 敌人:' + activeEnemies2 + '/' + Game.levelEnemyCount,
        10, debugY - 14
      );
    }

    // 关卡过渡动画
    if (Game.levelTransitionTimer > 0) {
      const progress = 1 - (Game.levelTransitionTimer / Game.LEVEL_TRANSITION_FRAMES);
      ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.7 * (1 - progress)) + ')';
      ctx.fillRect(0, 0, Game.CANVAS_W, Game.CANVAS_H);

      const scale = 0.3 + progress * 0.7;
      ctx.save();
      ctx.translate(Game.CANVAS_W / 2, Game.CANVAS_H / 2);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 48px "Courier New"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('第 ' + Game.transitionLevel + ' 关', 0, 0);
      ctx.restore();
    }
  };

  /** 游戏主循环 */
  Game.gameLoop = function() {
    Game.update();
    Game.draw();
    requestAnimationFrame(Game.gameLoop);
  };

})(window.Game = window.Game || {});
