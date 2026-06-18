// ================================================================
//  坦克大战 — 粒子爆炸特效
//  职责：生成爆炸碎片粒子 & 火花粒子，由 Game.update() 驱动衰减
//  依赖：Game.explosions（数组，由 Game 核心持有）
// ================================================================
(function(Game) {
  'use strict';

  /** 在 (x, y) 处生成 count 粒主体碎片 + count/2 粒火花 */
  Game.addExplosion = function(x, y, color, count) {
    const expl = Game.explosions;
    if (!expl) return;                      // 防御：尚未初始化

    // 主体碎片
    for (let i = 0; i < count; i++) {
      expl.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 25 + Math.random() * 15,
        maxLife: 40,
        color: color,
        size: 2 + Math.random() * 4
      });
    }

    // 火花粒子（黄色亮点）
    const sparkCount = Math.floor(count * 0.5);
    for (let i = 0; i < sparkCount; i++) {
      expl.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        life: 8 + Math.random() * 12,
        maxLife: 20,
        color: '#ffcc00',
        size: 1 + Math.random() * 2
      });
    }
  };

})(window.Game = window.Game || {});
