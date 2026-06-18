// ================================================================
//  坦克大战 — 工具函数
//  职责：AABB 碰撞检测、颜色转换、敌人颜色循环
//  依赖：无
// ================================================================
(function(Game) {
  'use strict';

  /** 检测两个 AABB 矩形是否碰撞 */
  Game.rectCollide = function(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  };

  /** 获取敌人颜色（随关卡循环，6 种红橙色系） */
  Game.getEnemyColor = function(lvl) {
    const colors = ['#ff6b6b', '#ff8e53', '#ff4757', '#ee5a24', '#ff3838', '#ff6348'];
    return colors[(lvl - 1) % colors.length];
  };

  /** 将十六进制颜色转为 rgba 字符串 */
  Game.hexToRgba = function(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  };

})(window.Game = window.Game || {});
