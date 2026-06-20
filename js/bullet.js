// ================================================================
//  坦克大战 — 子弹类
//  职责：子弹实体生命周期（移动、拖尾、碰撞墙壁、渲染）
//  依赖：Game.rectCollide, Game.addExplosion, Game.CANVAS_W, Game.CANVAS_H,
//        Game.BULLET_SPEED, Game.ENEMY_BULLET_SPEED
//  加载顺序：必须在 utils.js 之后
// ================================================================
(function(Game) {
  'use strict';

  Game.Bullet = class Bullet {
    constructor(x, y, direction, isEnemy) {
      this.x = x;
      this.y = y;
      this.width = isEnemy ? 7 : 6;           // 敌人子弹稍大，更显眼
      this.height = isEnemy ? 7 : 6;
      this.direction = direction;
      this.speed = isEnemy ? Game.ENEMY_BULLET_SPEED : Game.BULLET_SPEED;
      this.isEnemy = !!isEnemy;
      this.active = true;
      this.trail = [];                    // 拖尾轨迹 [{x, y}, ...]
    }

    /** 更新位置与拖尾 */
    update() {
      // 记录拖尾
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 5) this.trail.shift();

      // 按方向移动
      switch (this.direction) {
        case 'up':    this.y -= this.speed; break;
        case 'down':  this.y += this.speed; break;
        case 'left':  this.x -= this.speed; break;
        case 'right': this.x += this.speed; break;
      }

      // 越界销毁（留 10px 余量让拖尾完整显示）
      if (this.x < -10 || this.x > Game.CANVAS_W + 10 ||
          this.y < -10 || this.y > Game.CANVAS_H + 10) {
        this.active = false;
      }
    }

    /** 与墙壁碰撞：砖墙可摧毁、钢墙不可摧毁，均返回 true 表示子弹销毁 */
    collidesWithWall(wallList) {
      for (let i = wallList.length - 1; i >= 0; i--) {
        const w = wallList[i];
        if (Game.rectCollide(
          { x: this.x, y: this.y, w: this.width, h: this.height },
          { x: w.x, y: w.y, w: w.width, h: w.height }
        )) {
          if (w.type === 'brick') {
            // 摧毁砖墙 + 粒子效果
            wallList.splice(i, 1);
            Game.addExplosion(w.x + w.width / 2, w.y + w.height / 2, '#cc9966', 10);
          }
          return true;                    // 子弹销毁
        }
      }
      return false;
    }

    /** 与目标矩形碰撞检测（坦克 / 道具等） */
    collidesWith(other) {
      const b = typeof other.getBounds === 'function'
        ? other.getBounds()
        : { x: other.x, y: other.y, w: other.width || other.w, h: other.height || other.h };
      return Game.rectCollide(
        { x: this.x, y: this.y, w: this.width, h: this.height },
        b
      );
    }

    /** 绘制子弹（拖尾 + 发光 + 本体） */
    draw(ctx) {
      if (!this.active) return;

      // 拖尾渲染
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const alpha = (i / this.trail.length) * 0.4;
        ctx.fillStyle = this.isEnemy
          ? 'rgba(255, 107, 107, ' + alpha + ')'
          : 'rgba(255, 255, 100, ' + alpha + ')';
        ctx.fillRect(t.x, t.y, this.width, this.height);
      }

      // 发光光晕
      ctx.save();
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const gradient = ctx.createRadialGradient(cx, cy, 1, cx, cy, 8);
      if (this.isEnemy) {
        gradient.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 8, cy - 8, 16, 16);
      ctx.restore();

      // 子弹本体
      ctx.fillStyle = this.isEnemy ? '#ff4444' : '#ffff44';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  };

})(window.Game = window.Game || {});
