// ================================================================
//  坦克大战 — 主入口（DOM 引用、事件绑定、启动）
//  职责：获取所有 DOM 元素引用，绑定 UI 按钮事件，初始化游戏
//  依赖：Game 上的全部模块
//  加载顺序：必须最后一个 JS 文件
// ================================================================
(function(Game) {
  'use strict';

  // ── DOM 元素引用 ──
  Game.canvas       = document.getElementById('gameCanvas');
  Game.ctx          = Game.canvas.getContext('2d');

  Game.scoreEl      = document.getElementById('score');
  Game.livesEl      = document.getElementById('lives');
  Game.levelEl      = document.getElementById('level');
  Game.powerIcon    = document.getElementById('powerIcon');

  Game.startOverlay    = document.getElementById('startOverlay');
  Game.startBtn        = document.getElementById('startBtn');
  Game.gameoverOverlay = document.getElementById('gameoverOverlay');
  Game.gameoverTitle   = document.getElementById('gameoverTitle');
  Game.finalScoreEl    = document.getElementById('finalScore');
  Game.finalLevelEl    = document.getElementById('finalLevel');
  Game.finalKillsEl    = document.getElementById('finalKills');
  Game.restartBtn      = document.getElementById('restartBtn');
  Game.levelTransition = document.getElementById('levelTransition');
  Game.pauseOverlay    = document.getElementById('pauseOverlay');
  Game.gameHeader      = document.getElementById('gameHeader');

  // ── 焦点管理：确保键盘事件持续流入 ──
  document.body.focus();
  document.addEventListener('click', function() {
    document.body.focus();
  });
  Game.canvas.addEventListener('click', function() {
    Game.initAudio();
    document.body.focus();
  });

  // ── 触屏输入绑定（延迟绑定，此时 Game.canvas 已就绪） ──
  Game.setupTouchInput();

  // ── 按钮事件绑定 ──
  Game.startBtn.addEventListener('click', function() {
    Game.initAudio();
    Game.resetGame();
  });

  Game.restartBtn.addEventListener('click', function() {
    Game.initAudio();
    Game.resetGame();
  });

  // ── 启动游戏 ──
  Game.buildWalls();           // 初始化墙壁，使开始界面背后有完整地图
  Game.gameLoop();             // 启动 requestAnimationFrame 主循环
  Game.canvas.focus();

  // 控制台欢迎信息
  console.log('坦克大战已就绪！');
  console.log('操作: \u2191\u2193\u2190\u2192 或 WASD 移动 | 空格射击 | P 暂停 | R 重新开始');
  console.log('新功能: 钢墙、道具系统、音效、增强AI、开始界面');
  console.log('道具: \uD83D\uDEE1护盾(免伤) \u26A1加速 \uD83D\uDD25速射 \u2764生命+1');

})(window.Game = window.Game || {});
