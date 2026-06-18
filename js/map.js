// ================================================================
//  坦克大战 — 地图模块
//  职责：模板地图生成（5 套循环 + 随机砖块）、敌人出生与 AI 分配
//  依赖：Game.MAP_TEMPLATES, Game.TILE_SIZE, Game.COLS, Game.ROWS,
//        Game.CANVAS_W, Game.MAX_ENEMIES_CAP, Game.getEnemyColor,
//        Game.Tank, Game.AI_MODE, Game.AI_GUARD_RANGE
//  加载顺序：必须在 constants.js 和 tank.js 之后
// ================================================================
(function(Game) {
  'use strict';

  // ── 地图模板轮转计数器 ──
  var templateIndex = 0;

  /** 根据关卡选择模板生成墙壁，叠加随机砖块，强制清空出生区 */
  Game.buildWalls = function() {
    // 1. 创建空地图（20x26）
    var map = [];
    for (var row = 0; row < Game.ROWS; row++) {
      map[row] = [];
      for (var col = 0; col < Game.COLS; col++) {
        map[row][col] = 0;
      }
    }

    // 2. 应用模板（每关轮换，确保首关用模板 0）
    var tmplFn = Game.MAP_TEMPLATES[templateIndex % Game.MAP_TEMPLATES.length];
    templateIndex++;
    tmplFn(map);

    // 3. 随机添加散落砖块（密度减半，保持地图通透）
    var extraDensity = 0.025 + Game.level * 0.008; // 原 0.04+0.015→减半
    for (var row = 2; row < Game.ROWS - 2; row++) {
      for (var col = 0; col < Game.COLS; col++) {
        // 不覆盖已有墙壁和钢墙
        if (map[row][col] !== 0) continue;
        // 不在出生区生成
        if (row < 3 || row > 16) continue;
        if (Math.random() < extraDensity) {
          map[row][col] = 1;              // 只生成砖墙（可摧毁）
        }
      }
    }

    // 4. 强制清空出生区（行 0-2 上部和 17-19 下部）
    for (var col = 0; col < Game.COLS; col++) {
      // 顶部出生区（行 0-2 完全清空）
      map[0][col] = 0;
      map[1][col] = 0;
      map[2][col] = 0;
      // 底部出生区（行 17-19 完全清空）
      map[17][col] = 0;
      map[18][col] = 0;
      map[19][col] = 0;
    }

    // 5. 转换为 Wall 对象数组
    Game.walls = [];
    for (var row = 0; row < Game.ROWS; row++) {
      for (var col = 0; col < Game.COLS; col++) {
        var tile = map[row][col];
        if (tile === 1) {
          Game.walls.push({
            x: col * Game.TILE_SIZE,
            y: row * Game.TILE_SIZE,
            width: Game.TILE_SIZE,
            height: Game.TILE_SIZE,
            type: 'brick'
          });
        } else if (tile === 2) {
          Game.walls.push({
            x: col * Game.TILE_SIZE,
            y: row * Game.TILE_SIZE,
            width: Game.TILE_SIZE,
            height: Game.TILE_SIZE,
            type: 'steel'
          });
        }
      }
    }
  };

  /** 重置地图模板轮转（新游戏时调用） */
  Game.resetMapTemplates = function() {
    templateIndex = 0;
  };

  // ==============================================================
  //  敌人 AI 模式分配（巡逻 + 守卫双模式）
  //  关卡越深守卫比例越高，形成渐进式防守压力
  // ==============================================================

  /**
   * 按关卡决定 AI 行为分配比例
   * @returns {string} 'patrol' | 'guard'
   */
  function pickAIMode() {
    var lvl = Game.level;
    var r = Math.random();

    if (lvl <= 2) {
      // 第 1-2 关：全巡逻，轻松入门
      return Game.AI_MODE.PATROL;
    } else if (lvl <= 4) {
      // 第 3-4 关：80% 巡逻，20% 守卫（引入警戒概念）
      return r < 0.2 ? Game.AI_MODE.GUARD : Game.AI_MODE.PATROL;
    } else if (lvl <= 6) {
      // 第 5-6 关：60% 巡逻，40% 守卫（守卫威胁显著）
      return r < 0.4 ? Game.AI_MODE.GUARD : Game.AI_MODE.PATROL;
    } else {
      // 第 7+ 关：30% 巡逻，70% 守卫（要塞防御战）
      return r < 0.7 ? Game.AI_MODE.GUARD : Game.AI_MODE.PATROL;
    }
  }

  /** 给已创建的敌人坦克设置 AI 行为 */
  function assignAI(enemy) {
    enemy.aiMode = pickAIMode();

    // 守卫模式：扩大警戒范围 + 设置出生点
    if (enemy.aiMode === Game.AI_MODE.GUARD) {
      enemy.guardPos = { x: enemy.x, y: enemy.y };
      enemy.guardRange = Game.AI_GUARD_RANGE;    // 5 格半径
    }
  }

  // ==============================================================
  //  敌人生成
  // ==============================================================

  /** 在随机出生点生成一个敌人（带偏移防重叠），并分配 AI 行为 */
  Game.spawnEnemy = function() {
    var currentMax = Game.levelEnemyCount || Game.MAX_ENEMIES_CAP;
    // 遍历查活跃数（兼容 IE）
    var activeCount = 0;
    for (var i = 0; i < Game.enemies.length; i++) {
      if (Game.enemies[i].active) activeCount++;
    }
    if (activeCount >= currentMax) return;

    // 三个基础出生点 + 随机偏移
    var basePoints = [
      { x: Game.TILE_SIZE,                     y: Game.TILE_SIZE },
      { x: Game.CANVAS_W / 2 - Game.TILE_SIZE, y: Game.TILE_SIZE },
      { x: Game.CANVAS_W - Game.TILE_SIZE * 3, y: Game.TILE_SIZE },
    ];

    // 随机打乱
    for (var i = basePoints.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = basePoints[i];
      basePoints[i] = basePoints[j];
      basePoints[j] = tmp;
    }

    var allTanks = [Game.player].concat(Game.enemies);

    // 按出生点尝试
    for (var a = 0; a < basePoints.length; a++) {
      var bp = basePoints[a];
      var ox = (Math.random() - 0.5) * Game.TILE_SIZE * 0.5;
      var oy = (Math.random() - 0.5) * Game.TILE_SIZE * 0.5;
      var enemy = new Game.Tank(bp.x + ox, bp.y + oy, Game.getEnemyColor(Game.level), 'down', false);

      if (!enemy.collidesWithTank(allTanks)) {
        assignAI(enemy);                        // 分配 AI 模式
        Game.enemies.push(enemy);
        return;
      }
    }

    // 顶部两行随机尝试
    for (var a = 0; a < 10; a++) {
      var rx = Game.TILE_SIZE + Math.random() * (Game.CANVAS_W - Game.TILE_SIZE * 2);
      var ry = Math.random() * Game.TILE_SIZE * 2;
      var enemy = new Game.Tank(rx, ry, Game.getEnemyColor(Game.level), 'down', false);

      if (!enemy.collidesWithTank(allTanks)) {
        assignAI(enemy);                        // 分配 AI 模式
        Game.enemies.push(enemy);
        return;
      }
    }
  };

})(window.Game = window.Game || {});
