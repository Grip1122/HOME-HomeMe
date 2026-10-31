/* global RF */
(function () {
  const RF = window.RF;

  const COLOR_LEXICON = [
    ["红色", "红"], ["红", "红"], ["赤色", "红"], ["赤", "红"],
    ["蓝色", "蓝"], ["蓝", "蓝"], ["靛蓝", "蓝"],
    ["黑色", "黑"], ["黑", "黑"], ["乌黑", "黑"],
    ["黄色", "黄"], ["黄", "黄"], ["金色", "黄"], ["金", "黄"],
    ["白色", "白"], ["白", "白"], ["米白", "白"], ["银白", "白"],
    ["橙色", "橙"], ["橙", "橙"], ["橘色", "橙"], ["橘", "橙"],
    ["紫色", "紫"], ["紫", "紫"], ["葡萄紫", "紫"],
    ["绿色", "绿"], ["绿", "绿"], ["墨绿", "绿"],
    ["灰色", "灰"], ["灰", "灰"], ["粉色", "粉"], ["粉", "粉"],
    ["棕色", "棕"], ["棕", "棕"], ["咖啡色", "棕"],
  ].sort((a, b) => b[0].length - a[0].length);

  const SIZE_LEXICON = [
    ["大号", "大"], ["大型", "大"], ["大", "大"],
    ["小号", "小"], ["小型", "小"], ["小", "小"],
    ["中号", "中"], ["中型", "中"], ["中等", "中"], ["中", "中"],
  ];

  const SHAPE_LEXICON = [
    ["圆柱", "圆柱"], ["圆筒", "圆柱"], ["杯子形", "圆柱"],
    ["长方体", "长方体"], ["方形", "长方体"], ["方盒", "长方体"], ["盒子", "长方体"],
    ["长条", "长条"], ["细长", "长条"], ["条形", "长条"],
    ["环形", "环形"], ["圆环", "环形"], ["圈形", "环形"],
    ["圆形", "圆形"], ["圆", "圆形"],
  ];

  const ROOM_LEXICON = ["客厅", "卧室", "书房"];

  function normalize(q) {
    return String(q || "")
      .replace(/[\s，。！？、,.!?;；:："'“”‘’（）()【】\[\]]/g, "")
      .trim();
  }

  function collectTermMatches(query, catalog) {
    const terms = new Set();
    for (const obj of catalog) {
      const pool = [obj.name, obj.category, ...(obj.aliases || [])];
      for (const t of pool) {
        if (!t) continue;
        if (query.indexOf(t) >= 0) terms.add(t);
      }
    }
    const sorted = Array.from(terms).sort((a, b) => b.length - a.length);
    const out = [];
    for (const t of sorted) {
      let contained = false;
      for (const longer of out) {
        if (longer.indexOf(t) >= 0) {
          contained = true;
          break;
        }
      }
      if (!contained) out.push(t);
    }
    return out.slice(0, 5);
  }

  function scoreRecord(rec, profile) {
    let score = 0.05;
    const reasons = [];
    const hay = [rec.name, rec.category, ...(rec.aliases || [])].join(" ");
    const raw = profile.raw || "";

    if (profile.nameTerms && profile.nameTerms.length) {
      for (const term of profile.nameTerms) {
        if (hay.indexOf(term) >= 0) {
          score += term.length >= 2 ? 0.58 : 0.5;
          reasons.push("类别:" + term);
          break;
        }
      }
    }
    if (profile.colors && profile.colors.length && profile.colors.indexOf(rec.colorName) >= 0) {
      score += 0.3;
      reasons.push("颜色:" + rec.colorName);
    }
    if (profile.sizes && profile.sizes.length && profile.sizes.indexOf(rec.size) >= 0) {
      score += 0.08;
      reasons.push("尺寸:" + rec.size);
    }
    if (profile.shapes && profile.shapes.length && profile.shapes.indexOf(rec.shape) >= 0) {
      score += 0.08;
      reasons.push("形状:" + rec.shape);
    }
    if (profile.rooms && profile.rooms.length && profile.rooms.indexOf(rec.room) >= 0) {
      score += 0.12;
      reasons.push("房间:" + rec.room);
    }
    if (raw && raw.indexOf(rec.name) >= 0) {
      score += 0.15;
      reasons.push("名称命中");
    }
    const conf = rec.confidence === undefined ? 0.8 : rec.confidence;
    score *= 0.78 + 0.22 * conf;
    return { score: Math.min(1, score), reasons };
  }

  class Agent {
    constructor(catalog) {
      this.catalog = catalog;
      this.mode = "L2";
    }

    parse(query, records) {
      const raw = normalize(query);
      const colors = [];
      for (const [word, canon] of COLOR_LEXICON) {
        if (raw.indexOf(word) >= 0 && colors.indexOf(canon) < 0) colors.push(canon);
      }
      const sizes = [];
      for (const [word, canon] of SIZE_LEXICON) {
        if (raw.indexOf(word) >= 0 && sizes.indexOf(canon) < 0) sizes.push(canon);
      }
      const shapes = [];
      for (const [word, canon] of SHAPE_LEXICON) {
        if (raw.indexOf(word) >= 0 && shapes.indexOf(canon) < 0) shapes.push(canon);
      }
      const rooms = ROOM_LEXICON.filter((r) => raw.indexOf(r) >= 0);
      const nameTerms = collectTermMatches(raw, this.catalog);
      return {
        raw,
        colors,
        sizes,
        shapes,
        rooms,
        nameTerms,
        hasSignal: colors.length + sizes.length + shapes.length + rooms.length + nameTerms.length > 0,
      };
    }

    match(profile, records) {
      const pool = records && records.length ? records : this.catalog.map((o) => ({
        object_id: o.id,
        id: o.id,
        name: o.name,
        category: o.category,
        aliases: o.aliases,
        colorName: o.colorName,
        color: o.color,
        shape: o.shape,
        size: o.size,
        room: o.room,
        roomIndex: o.roomIndex,
        pos: o.currentPos,
        confidence: 0.8,
      }));
      const scored = pool.map((rec) => {
        const s = scoreRecord(rec, profile);
        return { record: rec, score: s.score, reasons: s.reasons };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored;
    }

    plan(query, opts) {
      opts = opts || {};
      const records = opts.records || [];
      const memoryEnabled = opts.memoryEnabled !== false;
      const profile = this.parse(query, records);

      if (!profile.hasSignal) {
        return {
          ok: false,
          say: "我还没听懂要找什么。可以告诉我颜色或物品名，例如「红色的杯子」。",
          profile,
          candidates: [],
          target: null,
          mode: "clarify",
          actionCount: 0,
        };
      }

      const memMatches = this.match(profile, records);
      const catalogMatches = this.match(profile, []);
      const memoryBest = memMatches[0];
      const memoryUsable = memoryEnabled && records.length > 0 && memoryBest && memoryBest.score >= 0.3;
      const candidates = memoryUsable ? memMatches : catalogMatches;
      const best = candidates[0];
      const target = best && best.score >= 0.28 ? best.record : null;

      if (!target) {
        return {
          ok: false,
          say: "记忆里没有找到匹配的物品。可以换个说法，或先让我扫描全屋。",
          profile,
          candidates: candidates.slice(0, 4),
          target: null,
          mode: "miss",
          actionCount: 0,
        };
      }

      const confident = best.score >= 0.45;
      const inMemory = memoryEnabled && records.some((r) => (r.object_id || r.id) === (target.object_id || target.id));
      const useMemory = inMemory && confident;
      const attr = this.describeProfile(profile);

      let say;
      if (useMemory) {
        say = "记忆命中：" + target.name + "在" + target.room + "的" + (target.furniture || "角落") + "。我直接过去。";
      } else if (memoryEnabled) {
        say = "记忆里没有十足把握，我先扫描全屋，再按" + (attr || "外观特征") + "找" + target.name + "。";
      } else {
        say = "记忆增强已关闭。我先扫描全屋，再按" + (attr || "外观特征") + "找" + target.name + "。";
      }

      const actions = useMemory
        ? ["go", "verify", "found"]
        : ["scan", "scan", "scan", "go", "verify", "found"];

      return {
        ok: true,
        say,
        profile,
        candidates: candidates.slice(0, 4),
        target,
        targetId: target.object_id || target.id,
        useMemory,
        attrText: attr,
        mode: useMemory ? "memory" : "scan",
        actionCount: actions.length,
        actions,
      };
    }

    describeProfile(profile) {
      const parts = [];
      for (const c of profile.colors || []) parts.push(c + "色");
      for (const s of profile.sizes || []) parts.push(s + "号");
      for (const s of profile.shapes || []) parts.push(s);
      if (profile.nameTerms && profile.nameTerms.length) parts.push(profile.nameTerms[0]);
      if (profile.rooms && profile.rooms.length) parts.push("在" + profile.rooms[0]);
      return parts.join(" · ");
    }
  }

  RF.Agent = Agent;
  RF.scoreRecord = scoreRecord;
})();
