// ================================================================
//  坦克大战 — 游戏常量与静态数据
//  职责：定义所有不变的游戏参数、地图模板函数、道具类型
//  依赖：无
// ================================================================
(function(Game) {
  'use strict';

  // ── 画布尺寸 ──
  Game.CANVAS_W = 780;
  Game.CANVAS_H = 600;
  Game.TILE_SIZE = 30;
  Game.COLS = 26;
  Game.ROWS = 20;

  // ── 速度常量（像素/帧 @ 60fps） ──
  //   玩家 1.2（72px/s），敌人 0.5（30px/s），2.4:1 机动优势
  Game.PLAYER_SPEED        = 1.2;          // 玩家基础速度
  Game.PLAYER_SPEED_BOOST  = 1.8;          // 加速道具生效时
  Game.ENEMY_SPEED         = 0.5;          // 敌人基础速度
  Game.BULLET_SPEED        = 5;
  Game.ENEMY_BULLET_SPEED  = 1.5;          // 敌人子弹降速（好躲避）

  // ── 冷却 / 计时常量（帧数 @ 60fps） ──
  Game.PLAYER_FIRE_COOLDOWN   = 15;        // 玩家射击冷却 0.25s
  Game.PLAYER_RAPID_COOLDOWN  = 5;         // 速射道具冷却（15发/秒）
  Game.ENEMY_FIRE_COOLDOWN    = 100;       // 敌人射击冷却 1.67s（降低弹幕密度）
  Game.INVINCIBLE_TIME        = 90;
  Game.MAX_ENEMIES_CAP        = 6;         // 单关最多 6 辆敌坦
  Game.BASE_ENEMY_COUNT       = 2;         // 第 1 关 2 辆，每关 +1

  // ── 道具常量 ──
  Game.POWERUP_DROP_CHANCE = 0.15;
  Game.POWERUP_DURATION    = 450;
  Game.POWERUP_SIZE        = 21;           // TILE_SIZE * 0.7

  // ── 关卡过渡持续时间（帧数） ──
  Game.LEVEL_TRANSITION_FRAMES = 80;

  // ── AI 行为模式（巡逻 + 守卫双模式） ──
  Game.AI_MODE = { PATROL: 'patrol', GUARD: 'guard' };
  Game.AI_PATROL_SHOOT_CHANCE = 0.02;         // 巡逻基础射击概率
  Game.AI_PATROL_AWARE_RANGE = 150;           // 巡逻感知距离（5格，进入加倍射速）
  Game.AI_PATROL_AWARE_SHOOT_MULT = 2;        // 感知时射击概率倍数（0.02×2=0.04）
  Game.AI_GUARD_SHOOT_CHANCE = 0.025;         // 守卫射击概率
  Game.AI_GUARD_RANGE = Game.TILE_SIZE * 5;   // 守卫警戒半径 5 格

  // ==============================================================
  //  地图模板（5 套，函数式生成，每关循环使用）
  //  每个模板接收 20x26 二维数组，直接修改填入 0/1/2
  //  外围两行（行 0-1, 18-19）由 buildWalls 强制清空
  // ==============================================================
  Game.MAP_TEMPLATES = [
    // ── 模板 0：对称象限（经典风格） ──
    function(map) {
      // 四组 2x3 钢砖混搭区块
      var quads = [[2,2],[2,15],[15,2],[15,15]];
      for (var q = 0; q < quads.length; q++) {
        var r0 = quads[q][0], c0 = quads[q][1];
        map[r0][c0] = 2; map[r0][c0+1] = 1;
        map[r0+1][c0] = 1; map[r0+1][c0+1] = 1;
        map[r0+2][c0] = 1; map[r0+2][c0+1] = 2;
      }
      // 上下两组钢砖支柱
      for (var c = 3; c < 23; c += 5) {
        map[7][c] = 1; map[7][c+1] = 2; map[7][c+2] = 1;
        map[12][c] = 1; map[12][c+1] = 2; map[12][c+2] = 1;
      }
      // 中央钢墙堡垒
      map[9][12] = 2; map[9][13] = 2;
      map[10][12] = 2; map[10][13] = 2;
    },
    // ── 模板 1：水平走廊 ──
    //   三格通道（每间隔 3 格留空），确保坦克顺畅通过
    function(map) {
      for (var row = 3; row < 17; row += 4) {
        for (var col = 0; col < 26; col++) {
          // 三格宽通道（col 5-7, 12-14, 18-20 留空）
          if ((col >= 5 && col <= 7) ||
              (col >= 12 && col <= 14) ||
              (col >= 18 && col <= 20)) continue;
          if (col % 4 <= 1) {
            map[row][col] = (row % 8 === 3) ? 2 : 1;
          }
        }
      }
      // 纵向通道边缘钢墙加固
      map[5][5] = 2; map[5][7] = 2; map[5][18] = 2; map[5][20] = 2;
      map[13][5] = 2; map[13][7] = 2; map[13][18] = 2; map[13][20] = 2;
    },
    // ── 模板 2：竞技场环形 ──
    //   外圈砖墙带四个入口（上下中各留通道），内部钢柱 + 散砖
    function(map) {
      // 外圈砖墙（上下边：col 4→21，左右边：row 3→16）
      for (var col = 4; col < 22; col++) {
        if (col >= 11 && col <= 14) continue;   // 上入口（4格宽）
        map[3][col] = 1;
        if (col >= 11 && col <= 14) continue;   // 下入口
        map[16][col] = 1;
      }
      for (var row = 4; row < 16; row++) {
        if (row >= 8 && row <= 10) continue;    // 左入口（3格宽）
        map[row][4] = 1;
        if (row >= 8 && row <= 10) continue;    // 右入口
        map[row][21] = 1;
      }
      // 四角钢墙
      map[3][4] = 2; map[3][21] = 2; map[16][4] = 2; map[16][21] = 2;
      // 内部四根钢柱
      map[7][8] = 2; map[7][17] = 2; map[11][8] = 2; map[11][17] = 2;
      // 内部散落砖块
      map[9][11] = 1; map[9][12] = 1; map[9][13] = 1; map[9][14] = 1;
      map[10][11] = 1; map[10][14] = 1;
    },
    // ── 模板 3：要塞十字阵 ──
    //   中央竖墙在 row 7-8 和 11-12 留缺口，保证坦克可左右穿越
    function(map) {
      // 中央十字钢墙（竖墙留两个 2 格缺口）
      for (var row = 5; row < 15; row++) {
        if (row === 7 || row === 8 || row === 11 || row === 12) continue;
        map[row][12] = 2; map[row][13] = 2;
      }
      // 横梁保留完整钢墙
      for (var col = 3; col < 23; col++) {
        if (col === 12 || col === 13) continue;
        map[10][col] = (col % 6 === 0) ? 2 : 1;
      }
      // 四角小堡垒
      map[5][5] = 2; map[5][20] = 2; map[14][5] = 1; map[14][20] = 1;
      map[4][6] = 1; map[4][19] = 1; map[15][6] = 2; map[15][19] = 2;
    },
    // ── 模板 4：散落堡垒群 ──
    function(map) {
      var blocks = [[4,7],[4,17],[8,10],[8,16],[12,7],[12,17],[15,9],[15,15]];
      for (var b = 0; b < blocks.length; b++) {
        var r = blocks[b][0], c = blocks[b][1];
        // 2×2 钢砖混搭
        map[r][c] = 2;       map[r][c+1] = 1;
        map[r+1][c] = 1;     map[r+1][c+1] = 2;
      }
      // 中央散砖
      for (var i = 0; i < 8; i++) {
        var cr = 7 + Math.floor(i / 4) * 4;
        var cc = 5 + (i % 4) * 5;
        if (map[cr][cc] === 0) map[cr][cc] = 1;
        if (map[cr+1][cc] === 0) map[cr+1][cc] = 1;
      }
    }
  ];

  // ==============================================================
  //  道具类型定义
  // ==============================================================
  Game.POWERUP_TYPES = {
    shield: { label: '\uD83D\uDEE1', color: '#4ecdc4', name: '护盾' },
    speed:  { label: '\u26A1', color: '#ff8c00', name: '加速' },
    rapid:  { label: '\uD83D\uDD25', color: '#ff4444', name: '速射' },
    life:   { label: '\u2764', color: '#2ecc71', name: '生命+1' },
  };

})(window.Game = window.Game || {});
