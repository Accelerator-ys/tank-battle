// ================================================================
//  坦克大战 — 坦克类（玩家 & 敌人共用）
//  职责：移动（AABB 回退 + 网格轻度吸附）、射击（含速射道具）、
//        伤害处理、双模式 AI（巡逻感知射速 + 守卫警戒）、渲染
//  依赖：Game.Bullet, Game.rectCollide, Game.AI_MODE, Game.AI_PATROL_AWARE_RANGE,
//        Game.AI_PATROL_SHOOT_CHANCE, Game.AI_PATROL_AWARE_SHOOT_MULT,
//        Game.AI_GUARD_SHOOT_CHANCE 等 Game.* 常量
//  加载顺序：必须在 bullet.js 之后
//  物理：碰撞箱 24px(居中), 视觉 26px, 预留 3px 走廊缓冲
// ================================================================
(function(Game) {
  'use strict';

  Game.Tank = class Tank {
    constructor(x, y, color, direction, isPlayer) {
      // ── 视觉尺寸（渲染用） ──
      this.width  = Game.TILE_SIZE - 4;        // 26px
      this.height = Game.TILE_SIZE - 4;

      // ── 碰撞箱尺寸（比视觉小 2px，居中，每边留 1px 缓冲） ──
      //   26px→24px 意味着 30px 走廊有 6px 间隙，滑动余量翻倍
      this.collisionW = Game.TILE_SIZE - 6;    // 24px
      this.collisionH = Game.TILE_SIZE - 6;

      this.x = x;
      this.y = y;
      this.color = color;
      this.direction = direction || 'up';
      this.baseSpeed = isPlayer ? Game.PLAYER_SPEED : Game.ENEMY_SPEED;
      this.isPlayer = !!isPlayer;
      this.fireCooldown = 0;
      this.active = true;

      // ── AI 行为属性（仅敌人有效，由 map.js 的 assignAI 填充） ──
      this.aiMode       = 'patrol';            // 'patrol' | 'guard'
      this.guardPos     = null;                // 守卫出生点 { x, y }
      this.guardRange   = Game.TILE_SIZE * 4;  // 默认守卫警戒半径（由 assignAI 覆写）
      this.stuckFrames  = 0;                  // 连续卡住帧数（用于突围恢复）
      this.bounceCount  = 0;                  // 连续方向反弹计数（防钢墙弹跳卡死）

      // 巡逻/守卫子状态
      this.patrolDir   = Math.random() < 0.5 ? 'vertical' : 'horizontal';
      this.patrolSign  = 1;
      this.patrolTimer = 180 + Math.floor(Math.random() * 120); // 定期换轴防拥堵
    }

    // ── 几何查询 ──

    /** 获取坦克视觉中心坐标 */
    getCenter() {
      return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    /** 获取 AABB 碰撞边界盒（使用收紧的碰撞箱，居中偏移） */
    getBounds() {
      var padX = (this.width - this.collisionW) / 2;   // 1px
      var padY = (this.height - this.collisionH) / 2;  // 1px
      return { x: this.x + padX, y: this.y + padY, w: this.collisionW, h: this.collisionH };
    }

    /** 获取当前实际速度（含加速道具加成） */
    getSpeed() {
      if (this.isPlayer && Game.activePower === 'speed') return Game.PLAYER_SPEED_BOOST;
      return this.baseSpeed;
    }

    // ── 碰撞检测 ──

    /** 与另一个矩形 / 坦克碰撞检测 */
    collidesWith(other) {
      var a = this.getBounds();
      var b = typeof other.getBounds === 'function'
        ? other.getBounds()
        : { x: other.x, y: other.y, w: other.width || other.w, h: other.height || other.h };
      return Game.rectCollide(a, b);
    }

    /** 与墙壁列表任一碰撞 */
    collidesWithWall(wallList) {
      for (var i = 0; i < wallList.length; i++) {
        if (this.collidesWith(wallList[i])) return true;
      }
      return false;
    }

    /** 与坦克列表任一碰撞（排除自身和已死亡） */
    collidesWithTank(tankList) {
      for (var i = 0; i < tankList.length; i++) {
        var t = tankList[i];
        if (t === this || !t.active) continue;
        if (this.collidesWith(t)) return true;
      }
      return false;
    }

    // ==============================================================
    //  移动系统（分轴回退 → 网格轻度吸附，移除贴墙滑动）
    // ==============================================================

    /**
     * 按增量移动，两阶段碰撞解决：
     *  1. 标准分轴碰撞回退
     *  2. 网格吸附（仅小偏差修正，避免不必要的自动滑动）
     * @returns {boolean} 是否发生位移
     */
    move(dx, dy, wallList, tankList) {
      var newX = this.x + dx;
      var newY = this.y + dy;

      // 画布边界检测（使用视觉尺寸）
      if (newX < 0 || newX + this.width > Game.CANVAS_W ||
          newY < 0 || newY + this.height > Game.CANVAS_H) {
        return false;
      }

      var oldX = this.x;
      var oldY = this.y;

      // ── 第一轮：标准分轴碰撞回退（刚性停止，无滑动） ──
      this.x = newX;
      if (this.collidesWithWall(wallList) || this.collidesWithTank(tankList)) {
        this.x = oldX;
      }

      this.y = newY;
      if (this.collidesWithWall(wallList) || this.collidesWithTank(tankList)) {
        this.y = oldY;
      }

      var movedX = Math.abs(this.x - oldX) > 0.1;
      var movedY = Math.abs(this.y - oldY) > 0.1;
      if (movedX || movedY) return true;

      // ── 第二轮：网格轻度吸附（仅小偏差修正，避免自动滑动感） ──
      //   偏差 ≤ 半格时校正到格点中心，消除浮点累积导致的无意义卡角
      var cellSize = Game.TILE_SIZE;
      var cellOffX = (cellSize - this.collisionW) / 2;   // 3px
      var cellOffY = (cellSize - this.collisionH) / 2;   // 3px

      var cellX = Math.round((oldX - cellOffX) / cellSize);
      var cellY = Math.round((oldY - cellOffY) / cellSize);

      var snapX = cellX * cellSize + cellOffX;
      var snapY = cellY * cellSize + cellOffY;

      // 仅当偏差较小（≤ 半格）且确实偏移时执行
      var snapDist = Math.abs(snapX - oldX) + Math.abs(snapY - oldY);
      if (snapDist <= cellSize * 0.4 && (snapX !== oldX || snapY !== oldY)) {
        var savedX = this.x, savedY = this.y;
        this.x = snapX;
        this.y = snapY;
        if (!this.collidesWithWall(wallList) && !this.collidesWithTank(tankList)) {
          // 吸附成功后从对齐位重试移动
          this.x = snapX + dx;
          if (this.collidesWithWall(wallList) || this.collidesWithTank(tankList)) {
            this.x = snapX;
          }
          this.y = snapY + dy;
          if (this.collidesWithWall(wallList) || this.collidesWithTank(tankList)) {
            this.y = snapY;
          }
          var sMoved = Math.abs(this.x - savedX) > 0.1 || Math.abs(this.y - savedY) > 0.1;
          if (sMoved) return true;

          this.x = snapX;
          this.y = snapY;
          return true;
        }
        this.x = savedX;
        this.y = savedY;
      }

      return false;
    }

    // ── 射击 ──

    /**
     * 发射子弹（支持速射道具）
     * @param {Bullet[]} bullets  子弹数组
     * @param {boolean}  isEnemy  是否敌人子弹
     * @returns {Bullet[]|null}   创建的子弹列表
     */
    fire(bullets, isEnemy) {
      if (this.fireCooldown > 0) return null;

      var c = this.getCenter();
      var bx = c.x - 3;
      var by = c.y - 3;

      switch (this.direction) {
        case 'up':    by = this.y - 6;            bx = c.x - 3; break;
        case 'down':  by = this.y + this.height;  bx = c.x - 3; break;
        case 'left':  bx = this.x - 6;            by = c.y - 3; break;
        case 'right': bx = this.x + this.width;   by = c.y - 3; break;
      }

      var bullet = new Game.Bullet(bx, by, this.direction, isEnemy);
      bullets.push(bullet);

      // 速射道具：冷却压缩至 5 帧（12发/秒），普通冷却 15 帧
      var isRapid = !isEnemy && Game.activePower === 'rapid';
      this.fireCooldown = isEnemy ? Game.ENEMY_FIRE_COOLDOWN :
                          isRapid ? Game.PLAYER_RAPID_COOLDOWN : Game.PLAYER_FIRE_COOLDOWN;
      if (!isEnemy) Game.playShoot();
      return [bullet];
    }

    // ── 被击中处理 ──

    /**
     * @returns {boolean} 是否实际造成伤害
     */
    hit() {
      if (this.isPlayer) {
        // 护盾道具免疫伤害
        if (Game.activePower === 'shield') {
          Game.screenFlash = 8;
          Game.playExplosion();
          Game.addExplosion(this.getCenter().x, this.getCenter().y, '#4ecdc4', 10);
          return false;
        }
        // 无敌状态免疫
        if (Game.playerInvincible > 0) return false;

        Game.lives--;
        Game.livesEl.textContent = Game.lives;
        Game.playerInvincible = Game.INVINCIBLE_TIME;
        Game.shakeTimer = 20;
        Game.shakeIntensity = 6;
        Game.playHit();
        Game.addExplosion(this.getCenter().x, this.getCenter().y, '#4ecdc4', 15);

        // 死亡时取消道具
        Game.deactivatePowerUp();

        // 重置玩家位置到出生点
        this.x = Game.CANVAS_W / 2 - this.width / 2;
        this.y = Game.CANVAS_H - Game.TILE_SIZE * 2;
        this.direction = 'up';

        if (Game.lives <= 0) {
          Game.gameOver = true;
          this.active = false;
          Game.playGameOver();
          // 显示游戏结束覆盖层
          Game.finalScoreEl.textContent = Game.score;
          Game.finalLevelEl.textContent = Game.level;
          Game.finalKillsEl.textContent = Game.totalKills;
          Game.gameoverOverlay.classList.add('active');
        }
        return true;
      } else {
        // 敌人被击中
        this.active = false;
        Game.score += 100;
        Game.totalKills++;
        Game.scoreEl.textContent = Game.score;

        // 分数弹跳动画
        Game.scoreEl.classList.add('pop');
        setTimeout(function() { Game.scoreEl.classList.remove('pop'); }, 150);

        Game.playExplosion();
        Game.addExplosion(this.getCenter().x, this.getCenter().y, this.color, 20);

        // 概率掉落道具
        if (Math.random() < Game.POWERUP_DROP_CHANCE) {
          Game.spawnPowerUp(this.getCenter().x, this.getCenter().y);
        }
        return true;
      }
    }

    // ==============================================================
    //  敌人 AI 系统（巡逻感知 + 守卫警戒双模式）
    // ==============================================================

    /**
     * AI 主入口：按 aiMode 分派行为，含巡逻感知定向射击
     * 注：aiMode 由 map.js 的 assignAI() 在生成时设置
     */
    updateAI(wallList, tankList, enemyBuls) {
      if (!this.active || this.isPlayer) return;

      // 记录移动前位置（用于卡住检测）
      var prevX = this.x;
      var prevY = this.y;

      // 按模式执行移动
      if (this.aiMode === Game.AI_MODE.GUARD) {
        this._guardMove(wallList, tankList);
      } else {
        this._patrolMove(wallList, tankList);
      }

      // ── 卡住恢复检测 ──
      var moved = Math.abs(this.x - prevX) > 0.1 || Math.abs(this.y - prevY) > 0.1;
      if (!moved) {
        this.stuckFrames++;
      } else {
        this.stuckFrames = 0;
      }

      if (this.stuckFrames > 40) {                     // 0.67s 快速恢复
        var allDirs = ['up', 'down', 'left', 'right'];
        for (var di = allDirs.length - 1; di > 0; di--) {
          var dj = Math.floor(Math.random() * (di + 1));
          var dtmp = allDirs[di]; allDirs[di] = allDirs[dj]; allDirs[dj] = dtmp;
        }
        var escaped = false;
        for (var dk = 0; dk < 4; dk++) {
          if (this._moveToward(allDirs[dk], this.getSpeed(), wallList, tankList)) {
            escaped = true;
            break;
          }
        }
        if (escaped) {
          if (this.aiMode === Game.AI_MODE.PATROL) {
            this.patrolDir = this.patrolDir === 'vertical' ? 'horizontal' : 'vertical';
          }
          if (this.aiMode === Game.AI_MODE.GUARD) {
            this.patrolDir = Math.random() < 0.5 ? 'vertical' : 'horizontal';
          }
          this.patrolSign = Math.random() < 0.5 ? 1 : -1;
        }
        this.stuckFrames = 0;
      }

      // ── 射击概率（守卫稳守 / 巡逻近距离感知加倍射速） ──
      var shootChance;
      if (this.aiMode === Game.AI_MODE.GUARD) {
        shootChance = Game.AI_GUARD_SHOOT_CHANCE;       // 0.025 — 守卫
      } else {
        shootChance = Game.AI_PATROL_SHOOT_CHANCE;       // 0.02 — 巡逻基础
        // 巡逻感知：仅加倍射速，不干扰巡逻移动方向（避免卡住感）
        var player = Game.player;
        if (player && player.active) {
          var pdx = player.x - this.x;
          var pdy = player.y - this.y;
          var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdist < Game.AI_PATROL_AWARE_RANGE) {
            shootChance *= Game.AI_PATROL_AWARE_SHOOT_MULT;   // 2x → 0.04
          }
        }
      }

      if (Math.random() < shootChance && this.fireCooldown <= 0) {
        this.fire(enemyBuls, true);
      }
    }

    /**
     * 辅助：按给定方向移动一段距离
     * @returns {boolean} 是否成功位移
     */
    _moveToward(direction, spd, wallList, tankList) {
      var dx = 0, dy = 0;
      switch (direction) {
        case 'up':    dy = -spd; break;
        case 'down':  dy =  spd; break;
        case 'left':  dx = -spd; break;
        case 'right': dx =  spd; break;
      }
      this.direction = direction;
      return this.move(dx, dy, wallList, tankList);
    }

    // ── 巡逻模式（含反弹计数防钢墙卡死 + 定期换轴 + 协同避让） ──

    _patrolMove(wallList, tankList) {
      var spd = this.getSpeed();

      // ── 定期换轴：每 3-5 秒有 25% 概率切换巡逻主轴 ──
      //   防止多辆巡逻坦克同向拥堵
      this.patrolTimer = (this.patrolTimer || 1) - 1;
      if (this.patrolTimer <= 0) {
        if (Math.random() < 0.25) {
          this.patrolDir = this.patrolDir === 'vertical' ? 'horizontal' : 'vertical';
          this.patrolSign = Math.random() < 0.5 ? 1 : -1;
          this.bounceCount = 0;                 // 换轴即重置反弹计数
        }
        this.patrolTimer = 180 + Math.floor(Math.random() * 120);
      }

      // ── 反弹过多则强制换轴（防钢墙间来回弹跳卡死） ──
      if (this.bounceCount >= 4) {
        this.patrolDir = this.patrolDir === 'vertical' ? 'horizontal' : 'vertical';
        this.patrolSign = Math.random() < 0.5 ? 1 : -1;
        this.bounceCount = 0;
      }

      var dir = (this.patrolDir === 'vertical')
        ? (this.patrolSign > 0 ? 'down' : 'up')
        : (this.patrolSign > 0 ? 'right' : 'left');

      var moved = this._moveToward(dir, spd, wallList, tankList);
      if (!moved) {
        // 主方向受阻 → 反弹：反转方向 + 累加反弹计数
        this.patrolSign *= -1;
        this.bounceCount++;
        dir = (this.patrolDir === 'vertical')
          ? (this.patrolSign > 0 ? 'down' : 'up')
          : (this.patrolSign > 0 ? 'right' : 'left');
        moved = this._moveToward(dir, spd, wallList, tankList);
        if (moved) {
          // 反弹方向成功：反弹计数累加（可能下次又反弹回来）
        }
      } else {
        // 主方向顺利前进 → 缓慢衰减反弹计数（连续前进证明不在弹跳循环中）
        if (this.bounceCount > 0) this.bounceCount--;
      }

      if (!moved) {
        // 双方向均受阻 → 尝试垂直轴（大概率是被其他坦克堵路）
        var perpDirs = (this.patrolDir === 'vertical')
          ? ['right', 'left']
          : ['up', 'down'];
        var perpOk = false;
        for (var p = 0; p < 2; p++) {
          if (this._moveToward(perpDirs[p], spd, wallList, tankList)) {
            // 垂直轴可行 → 切换巡逻主轴
            this.patrolDir = this.patrolDir === 'vertical' ? 'horizontal' : 'vertical';
            this.patrolSign = (perpDirs[p] === 'right' || perpDirs[p] === 'down') ? 1 : -1;
            this.bounceCount = 0;
            perpOk = true;
            break;
          }
        }
        // 四面全堵 → 反弹次数归零（下一帧 stuckFrames 会触发突围）
        if (!perpOk) this.bounceCount = 0;
      }
    }

    // ── 守卫模式（含坦克避让 + 范围内巡逻） ──

    _guardMove(wallList, tankList) {
      var spd = this.getSpeed();
      var gx = this.guardPos ? this.guardPos.x : this.x;
      var gy = this.guardPos ? this.guardPos.y : this.y;
      var dx = gx - this.x;
      var dy = gy - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // 超出守卫范围 → 移回出生点
      if (dist > this.guardRange) {
        var dir;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? 'right' : 'left';
        } else {
          dir = dy > 0 ? 'down' : 'up';
        }
        var moved = this._moveToward(dir, spd, wallList, tankList);
        if (!moved) {
          // 回位受阻 → 尝试垂直方向绕过坦克
          var altDir;
          if (Math.abs(dx) > Math.abs(dy)) {
            altDir = dy > 0 ? 'down' : 'up';
          } else {
            altDir = dx > 0 ? 'right' : 'left';
          }
          this._moveToward(altDir, spd, wallList, tankList);
        }
        return;
      }

      // ── 范围内巡逻（含定期换轴防拥堵） ──
      // 守卫坦克也享用定期换轴逻辑，防止多辆守卫坦克同向拥堵
      this.patrolTimer = (this.patrolTimer || 1) - 1;
      if (this.patrolTimer <= 0) {
        if (Math.random() < 0.12) {
          this.patrolDir = this.patrolDir === 'vertical' ? 'horizontal' : 'vertical';
          this.patrolSign = Math.random() < 0.5 ? 1 : -1;
        }
        this.patrolTimer = 200 + Math.floor(Math.random() * 160);
      }

      this._patrolMove(wallList, tankList);
    }

    // ── 渲染 ──

    /** 绘制坦克（车身 + 履带 + 炮塔 + 炮管 + 特效 + AI 指示灯） */
    draw(ctx) {
      if (!this.active) return;

      // 无敌闪烁（每 10 帧切换显隐）
      var flicker = this.isPlayer && Game.playerInvincible > 0 &&
                    Math.floor(Game.playerInvincible / 5) % 2 === 0;
      if (flicker) return;

      ctx.save();
      var cx = this.x + this.width / 2;
      var cy = this.y + this.height / 2;

      ctx.translate(cx, cy);
      var angle = 0;
      switch (this.direction) {
        case 'up':    angle = 0;            break;
        case 'right': angle = Math.PI / 2;  break;
        case 'down':  angle = Math.PI;      break;
        case 'left':  angle = -Math.PI / 2; break;
      }
      ctx.rotate(angle);

      var hw = this.width / 2;
      var hh = this.height / 2;

      // 护盾可视化
      if (this.isPlayer && Game.activePower === 'shield') {
        ctx.beginPath();
        ctx.arc(0, 0, hw + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(78, 205, 196, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 坦克车身
      ctx.fillStyle = this.color;
      ctx.fillRect(-hw + 2, -hh + 4, this.width - 4, this.height - 6);

      // 履带（左右各 5px 宽）
      ctx.fillStyle = '#333';
      ctx.fillRect(-hw, -hh, 5, this.height);
      ctx.fillRect(hw - 5, -hh, 5, this.height);

      // 履带纹理线
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      for (var i = -hh + 4; i < hh - 2; i += 6) {
        ctx.beginPath(); ctx.moveTo(-hw, i);     ctx.lineTo(-hw + 5, i); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hw - 5, i);  ctx.lineTo(hw, i);     ctx.stroke();
      }

      // 炮塔（圆形）
      ctx.fillStyle = this.isPlayer ? '#2ecc71' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(0, 0, hw * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // 炮管
      ctx.fillStyle = '#888';
      ctx.fillRect(-3, -hh, 6, hh * 0.6);

      // 炮管口
      ctx.fillStyle = '#aaa';
      ctx.fillRect(-2, -hh + 2, 4, 5);

      ctx.restore();

      // ── AI 模式指示灯（敌坦头顶，不受旋转影响） ──
      if (!this.isPlayer && this.aiMode) {
        var indicatorY = this.y - 6;
        var indicatorColor;
        if (this.aiMode === Game.AI_MODE.GUARD) {
          indicatorColor = '#ffaa00';       // 守卫：琥珀色
        } else {
          indicatorColor = '#44aaff';       // 巡逻：蓝色
        }

        // 外发光环
        ctx.beginPath();
        ctx.arc(cx, indicatorY, 5, 0, Math.PI * 2);
        if (indicatorColor.startsWith('#')) {
          ctx.fillStyle = 'rgba(' +
            parseInt(indicatorColor.slice(1,3), 16) + ',' +
            parseInt(indicatorColor.slice(3,5), 16) + ',' +
            parseInt(indicatorColor.slice(5,7), 16) + ', 0.25)';
        } else {
          ctx.fillStyle = indicatorColor.replace(')', ', 0.25)').replace('rgb', 'rgba');
        }
        ctx.fill();

        // 内实心点
        ctx.beginPath();
        ctx.arc(cx, indicatorY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = indicatorColor;
        ctx.fill();

        // 微脉冲动画（随时间明暗呼吸）
        var pulseAlpha = 0.5 + Math.sin(Game.frameCount * 0.12) * 0.35;
        ctx.beginPath();
        ctx.arc(cx, indicatorY, 6, 0, Math.PI * 2);
        if (indicatorColor.startsWith('#')) {
          ctx.strokeStyle = 'rgba(' +
            parseInt(indicatorColor.slice(1,3), 16) + ',' +
            parseInt(indicatorColor.slice(3,5), 16) + ',' +
            parseInt(indicatorColor.slice(5,7), 16) + ', ' + pulseAlpha + ')';
        } else {
          ctx.strokeStyle = indicatorColor.replace(')', ', ' + pulseAlpha + ')').replace('rgb', 'rgba');
        }
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 无敌护盾圈（不受旋转影响）
      if (this.isPlayer && Game.playerInvincible > 0) {
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, hw + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 加速效果（虚线圆环）
      if (this.isPlayer && Game.activePower === 'speed') {
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, hw + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

})(window.Game = window.Game || {});
