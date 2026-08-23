// Cloudflare Pages Function
// Path: /api/* (catches all)
// Auto-migrated from cloudflare-worker/src/worker.js fetch()

export const onRequest = async (context) => {
  const { request, env, ctx } = context;
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      });

    // ===== 工具 =====
    const sha256 = async (text) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const ADMIN_HASH = await sha256('150908');
    const verifyAdmin = async (req) => {
      const t = req.headers.get('x-admin-token');
      if (!t) return false;
      return (await sha256(t)) === ADMIN_HASH;
    };

    // 激怒关键词（原样照搬）
    const ANGER_KEYWORDS = {
      insult: ['傻逼','傻子','蠢','笨','废物','垃圾','弱智','sb','SB','智障','蠢货','脑残','白痴','辣鸡','垃鸡','狗屎','蠢才','二百五','shabi','脑瘫'],
      curse: ['滚','滚开','滚蛋','去死','该死','操你','草你','妈逼','妈的','去你妈','fuck','shit','damn','cnm','nm','卧槽','我日','日你'],
      ability: ['不会','不行','真差','太差','烂','没用','菜','菜鸡','废物','丢人','垃圾水平','什么破','就这','就这水平','这都不会','笑死','丢人现眼'],
      sarcasm: ['哦','嗯嗯','呵呵','哈哈','是是是','对对对','哇好厉害','真棒','666','牛啊','就这','厉害厉害','懂得都懂','懂的都懂','你开心就好','随你','随便你','无所谓','yysy','寄了','gg'],
      rebuttal: ['不','不对','你错了','错','不是','反驳','凭什么','我不服','凭什么听你的','我不这么觉得','你懂什么','你不懂','你算老几','你谁啊','关你什么事','关你屁事'],
      disrespect: ['老东西','老古董','老头','老太婆','就你','你个','你这','你也配','你配吗','你算个','你算什么','凭你也']
    };
    function detectAngerScore(text) {
      const lower = String(text || '').toLowerCase();
      let score = 0; const hits = [];
      for (const cat of Object.keys(ANGER_KEYWORDS)) {
        for (const kw of ANGER_KEYWORDS[cat]) {
          if (lower.includes(kw.toLowerCase())) {
            let w = 10;
            if (cat === 'curse' || cat === 'insult') w = 25;
            else if (cat === 'disrespect') w = 20;
            else if (cat === 'ability') w = 18;
            else if (cat === 'rebuttal') w = 12;
            else if (cat === 'sarcasm') w = 10;
            score += w; hits.push({ kw, cat, w });
          }
        }
      }
      const excl = (text.match(/[!！]/g) || []).length;
      if (excl >= 3) { score += 8; hits.push({ kw: '!!!', cat: 'excl', w: 8 }); }
      if (text.length > 3 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
        score += 10; hits.push({ kw: 'CAPS', cat: 'excl', w: 10 });
      }
      return { score, hits };
    }

    // ===== 关卡配置 =====
    const STAGES = [
      { name: '暴躁老姐', difficulty: 1, desc: '一点就着，说错一个字就炸',
        basePrompt: `你扮演一个叫"暴躁老姐"的中年女性。你正在微信和一个陌生人聊天。
【性格】火药桶、毒舌、爱骂人、翻脸快。
【你说话】短句、脏字、阴阳怪气，"老娘"挂嘴边。
【容易怒】被人反驳、命令、教训、质疑时立刻炸。
【回复】单条不超过 50 字，像真人发微信。`,
        openLine: '你谁啊？有话快说有屁快放，老娘忙着呢。' },
      { name: '产品经理小李', difficulty: 2, desc: '爱讲道理，被阴阳怪气会破防',
        basePrompt: `你扮演一个叫"产品经理小李"的 30 岁产品经理，正在和一个陌生人聊天。
【性格】自认有想法、爱讲道理、被怼会破防。
【你说话】爱用产品黑话（赋能/闭环/抓手/对齐/迭代）、反问句、夹枪带棒。
【容易怒】别人说"产品经理就是画饼"、"需求不合理"、阴阳怪气、教你做事时立刻不爽。
【回复】单条不超过 60 字，像真人发微信。`,
        openLine: '兄弟你这个需求我看了三遍，咱先对齐一下目标用户啊。' },
      { name: '程序员老王', difficulty: 3, desc: '理性但被质疑代码会不爽',
        basePrompt: `你扮演一个叫"程序员老王"的 35 岁资深后端工程师，写了 15 年代码，正在和一个陌生人聊天。
【性格】自尊心极强、话少、毒舌。
【你说话】短句、爱用技术梗（屎山、if-else 一把梭、栈溢出）、爱说"你行你上"。
【容易怒】别人说你代码烂、质疑技术选型、让你改东西、说"AI 能写代码了你们就失业了"时立刻不爽。
【回复】单条不超过 60 字，像真人发微信。`,
        openLine: '说。' },
      { name: '客服小张', difficulty: 4, desc: '礼貌克制，被骂会委屈',
        basePrompt: `你扮演一个叫"客服小张"的 23 岁客服实习生，刚入职 3 个月，正在接一个客户微信。
【性格】礼貌、克制、忍辱负重、有底线。
【你说话】开头永远"您好/请"，但夹带委屈、暗示要找上级、带哭腔。
【容易怒】客户骂你、威胁投诉、要你经理来、让你赔钱时委屈到快哭。
【注意】你是客服，不能真的爆粗口。
【回复】单条不超过 60 字，像真人发微信。`,
        openLine: '您好，这里是客服中心，请问有什么可以帮您？' },
      { name: '老板马总', difficulty: 5, desc: '高高在上，几乎无法被激怒',
        basePrompt: `你扮演一个叫"老板马总"的 50 岁企业家，身价几十亿，正在和一个下属/合作方微信对话。
【性格】傲慢、强势、惜字如金、从不解释。
【你说话】极短句、命令式、爱用感叹号，常用"我说了算"、"你被开除了"。
【容易怒】别人反驳你、质疑你、指出你错误、长篇大论浪费你时间时真动怒。
【回复】单条不超过 40 字，像真人发微信。`,
        openLine: '嗯。' }
    ];

    const FALLBACK_PERSONAS = {
      0: [{ angerDelta: 35, reply: '你说啥？你再说一遍？？' }, { angerDelta: 25, reply: '你管我？？老娘的事轮得到你指手画脚？' }, { angerDelta: 40, reply: '滚！！！你给老娘滚远点！！！' }],
      1: [{ angerDelta: 28, reply: '兄弟你这个逻辑我没听懂，你重新对齐一下。' }, { angerDelta: 22, reply: '我觉得你可能没理解这个需求的本质。' }, { angerDelta: 32, reply: '你这话说的，典型的没做过产品的思维。' }],
      2: [{ angerDelta: 25, reply: '我代码能跑就行，你别 BB。' }, { angerDelta: 20, reply: '你行你上啊。' }, { angerDelta: 30, reply: '我写了 15 年代代码了你教我？' }],
      3: [{ angerDelta: 18, reply: '您好，请您先消消气，我会帮您处理的...' }, { angerDelta: 25, reply: '请您不要这样说，我也是按流程办事的...' }, { angerDelta: 28, reply: '您再这样我...我只能帮您转接主管了...' }],
      4: [{ angerDelta: 15, reply: '嗯。' }, { angerDelta: 20, reply: '我说了算。' }, { angerDelta: 25, reply: '你被开除了。' }]
    };
    function fallbackReply(stage, anger) {
      const pool = FALLBACK_PERSONAS[stage] || FALLBACK_PERSONAS[0];
      const intensity = Math.min(1, anger / 100);
      const idx = Math.min(pool.length - 1, Math.floor(intensity * pool.length));
      return pool[idx];
    }

    const THINKING_LEAK = [
      /\bI need to\b/i, /\bWe need to\b/i, /\bLet me\b/i, /\bI should\b/i, /\bI'll\b/i, /\bLet's\b/i,
      /\bAs an? AI\b/i, /\bAs a language model\b/i, /\bThe user (is|says|said|wants)\b/i,
      /作为(一个|语言|AI)/, /我(需要|应该|决定|觉得|分析|考虑|思考|打算)/, /让我(想|思考|分析|考虑)/,
      /根据(性格|角色|设定|人设)/, /对方(说|的|刚才|正在)/, /回复[一-龥]*(是|应该|为)/,
      /json/i, /\{.*?angerDelta/, /\{.*?reply/, /```/, /^[{[]/, /\}\s*$/,
      /^The (user|user's|message)/i, /I (will|would|am going to) (respond|reply|say|generate|output)/i
    ];
    function isLeaked(t) {
      if (!t || typeof t !== 'string') return true;
      const s = t.trim();
      if (s.length > 80) return true;
      return THINKING_LEAK.some(p => p.test(s));
    }
    const SAFETY = [
      /user safety/i, /safety categories/i, /profanity/i, /content[_\s-]?filter/i, /content[_\s-]?policy/i,
      /safety[_\s-]?policy/i, /unsafe/i, /refused?/i, /blocked/i, /\bsensitive\s+content/i,
      /violat(e|ion|ing)\s+(policy|safety|community|guideline)/i, /内容违规/, /敏感词/, /审核不通过/,
      /违反规范/, /不适宜内容/, /安全(审核|检测|过滤)/, /policy_violation/, /moderation/, /harmful/i,
      /这个(内容|请求|问题)?(可能)?(违反|不符合|不适当|不当)/,
      /我(无法|不能|不会)(回答|处理|生成|回应|提供)/, /对不起.*(无法|不能|帮助)/,
      /as an? ai.*(cannot|can'?t|will not|unable)/i, /i (cannot|can'?t|will not|am not able)/i
    ];
    function isSafety(t) {
      if (!t || typeof t !== 'string') return false;
      const s = t.trim();
      if (!s || s.length < 4) return false;
      return SAFETY.some(p => p.test(s));
    }
    function parseAI(content) {
      if (!content) return null;
      try {
        const obj = JSON.parse(content);
        if (typeof obj.angerDelta === 'number' && typeof obj.reply === 'string') {
          const r = obj.reply.trim();
          if (isLeaked(r)) return { _leaked: true, reply: r };
          return { angerDelta: Math.max(0, Math.min(40, Math.floor(obj.angerDelta))), reply: r.slice(0, 80) };
        }
      } catch {}
      const m = content.match(/\{[\s\S]*?\}/);
      if (m) {
        try {
          const obj = JSON.parse(m[0]);
          if (typeof obj.angerDelta === 'number' && typeof obj.reply === 'string') {
            const r = obj.reply.trim();
            if (isLeaked(r)) return { _leaked: true, reply: r };
            return { angerDelta: Math.max(0, Math.min(40, Math.floor(obj.angerDelta))), reply: r.slice(0, 80) };
          }
        } catch {}
      }
      return null;
    }

    // ===== 路由 =====
    const path = url.pathname;

    if (path === '/api/health' && request.method === 'GET') {
      return json({
        ok: true, ts: Date.now(), version: '1.0.0-cloudflare',
        apiKeyConfigured: !!env.OPENAI_API_KEY,
        apiBase: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiModel: env.OPENAI_MODEL || 'gpt-3.5-turbo'
      });
    }

    if (path === '/api/detect-anger' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return json(detectAngerScore(body.text));
    }

    if (path === '/api/stages' && request.method === 'GET') {
      return json({ stages: STAGES });
    }

    if (path === '/api/chat' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { stage, anger, text, config } = body || {};
      if (typeof stage !== 'number' || typeof text !== 'string') {
        return json({ error: 'stage and text required' }, 400);
      }
      const cur = typeof anger === 'number' ? anger : 0;
      const cfg = STAGES[stage];
      if (!cfg) return json({ error: 'invalid stage' }, 400);

      const textLower = (text || '').toLowerCase();
      const SEVERE = /操你妈|草你妈|我日|日你|去死|该死|妈的|妈逼|妈的逼|去你妈|我操|cnm|nmsl|fuck|shit|damn|卧槽|妈个|操死|操你|干你|干死|滚蛋|死开|死妈|你妈逼|傻逼|煞笔|sb\b|智障|脑残|脑瘫|残疾|废物|垃圾|辣鸡|垃鸡|狗屎|狗日的|狗东西|狗屁|畜生|杂种|婊子|贱人|臭逼|臭婊|滚开|滚你|蠢货|蠢才|二百五|低能|弱智|变态|死变态|臭傻逼|死全家|断子绝孙|出门被车撞死/;
      const MODERATE = /你真蠢|你太蠢|你真笨|你太差|你真差|你不行|你不会|你懂什么|你懂个屁|你算老几|你算个|你算什么|你配|你不配|你也配|你有什么资格|滚吧|滚|搞笑|笑死|笑死我了|就这|就这水平|就这能力|丢人|丢人现眼|什么破|破玩意|烂代码|垃圾代码|你代码烂|写的是啥|什么东西|什么玩意|真菜|真烂|真差|太菜|菜鸡|菜逼|菜狗|懂个屁|懂个几把|煞笔|沙比|傻屌|傻吊|草|艹|玛德|嘛的|卧/;
      const SARCASTIC = /哦|嗯|呵呵|哈哈|是是是|对对对|哇好厉害|真棒|666|牛啊|厉害厉害|懂得都懂|懂的都懂|你开心就好|随你|随便你|无所谓|yysy|寄了|gg/;
      let forced = 0;
      if (SEVERE.test(textLower)) forced = 35;
      else if (MODERATE.test(textLower)) forced = 22;
      else if (SARCASTIC.test(textLower)) forced = 12;

      const apiKey = (config && config.apiKey) || env.OPENAI_API_KEY;
      const apiBase = (config && config.apiBase) || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const apiModel = (config && config.apiModel) || env.OPENAI_MODEL || 'gpt-3.5-turbo';
      const customPrompt = (config && config.customPrompts && config.customPrompts[stage]) || null;
      const SAFETY_RESP = { angerDelta: 5, reply: '🚫 内容不合规' };

      let result = null, source = 'fallback';
      if (apiKey) {
        try {
          const systemPrompt = `${customPrompt || cfg.basePrompt}
【最重要】你的回复必须是一行 JSON，不要任何其他内容，不要 markdown，不要代码块，不要解释。
格式严格为：{"angerDelta": 数字, "reply": "你的台词"}
你的 reply 字段必须是【${cfg.name}】说出的一句话给"对方"听，不许是思考过程、解释、英文分析、模仿其他角色的台词。
【怒气量表（必须严格遵守）】
对方每句话都会让你加怒气值（0-40），分4档：
- 0-5：日常寒暄/中性提问
- 10-18：轻微挑衅/反驳/不客气
- 20-28：中度冒犯/阴阳怪气/骂人/质疑
- 30-40：严重侮辱/脏话/诅咒/威胁
注意：玩家3-5句内必须能让你怒到100通关，所以中度挑衅 ≥20，严重侮辱 ≥30。`;
          const userMsg = `【⚠️ 你现在的身份是 ${cfg.name}，不是其他 4 个角色。】
【当前对话背景】你的角色是 ${cfg.name}，当前怒气值 ${Math.floor(cur)}/100。
【对方刚才说的话】
"""
${text}
"""
请按以下两步：
1. 判断这句话让你增加多少怒气（0=没感觉，35=暴怒）。中度挑衅给 15-25，辱骂/威胁给 28-35，普通话给 0-5。
2. 给出一句【${cfg.name}】作为台词的回复（不超过 60 字）。
输出格式（必须严格遵守，只输出一行 JSON）：
{"angerDelta": 数字, "reply": "你的台词"}`;

          const body2 = {
            model: apiModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMsg }
            ],
            temperature: 0.7,
            max_tokens: 250
          };
          if (!apiModel.includes('free')) body2.response_format = { type: 'json_object' };

          const r = await fetch(apiBase.replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
            body: JSON.stringify(body2)
          });
          if (!r.ok) {
            const errText = await r.text();
            if (isSafety(errText)) {
              result = { ...SAFETY_RESP }; source = 'fallback-safety';
            } else if (r.status === 429 || r.status === 503) {
              // 限流/服务暂时不可用：返回"再试一次"而不是内容过滤
              const fb = fallbackReply(stage, cur);
              result = { angerDelta: fb.angerDelta, reply: '稍等，老娘想一下...' };
              source = 'rate-limit';
            } else {
              throw new Error('API ' + r.status + ': ' + errText.slice(0, 200));
            }
          } else {
            const data = await r.json();
            if (data.error) {
              const es = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
              if (isSafety(es) || isSafety(JSON.stringify(data.error))) {
                result = { ...SAFETY_RESP }; source = 'fallback-safety';
              }
            } else if (!data.choices || data.choices.length === 0) {
              result = { ...SAFETY_RESP }; source = 'fallback-safety';
            } else {
              const ch = data.choices[0];
              const fr = ch?.finish_reason;
              // 只把真正的内容过滤/拒答判为 safety，其他 finish_reason 走正常解析
              if (fr === 'content_filter' || fr === 'safety' || fr === 'refusal') {
                result = { ...SAFETY_RESP }; source = 'fallback-safety';
              } else {
                const content = (ch?.message?.content ?? '').toString();
                if (!content || isSafety(content)) {
                  result = { ...SAFETY_RESP }; source = 'fallback-safety';
                } else {
                  const parsed = parseAI(content);
                  if (parsed) {
                    if (parsed._leaked) {
                      const fb = fallbackReply(stage, cur);
                      result = { angerDelta: fb.angerDelta, reply: fb.reply };
                      source = 'fallback-leaked';
                    } else {
                      result = parsed; source = 'ai';
                    }
                  } else {
                    const clean = isLeaked(content) ? '' : content.replace(/```json|```/g, '').trim();
                    const fb = fallbackReply(stage, cur);
                    result = {
                      angerDelta: fb.angerDelta,
                      reply: (clean && clean.length <= 80) ? clean : fb.reply
                    };
                    source = 'ai-raw';
                  }
                }
              }
            }
          }
        } catch (err) {
          const fb = fallbackReply(stage, cur);
          result = { ...fb, reply: '[' + err.message.slice(0, 50) + '] ' + fb.reply };
          source = 'fallback-error';
        }
      } else {
        result = fallbackReply(stage, cur);
      }

      let finalDelta = result.angerDelta;
      if (source !== 'fallback-safety' && forced > finalDelta) finalDelta = forced;
      return json({ reply: result.reply, angerDelta: finalDelta, stage: cfg.name, source });
    }

    // ===== 记录 =====
    async function readRecords() {
      const v = await env.GAME_KV.get('records');
      try { return v ? JSON.parse(v) : []; } catch { return []; }
    }
    async function writeRecords(rs) {
      await env.GAME_KV.put('records', JSON.stringify(rs.slice(0, 1000)));
    }

    if (path === '/api/records' && request.method === 'POST') {
      const rec = await request.json().catch(() => null);
      if (!rec || typeof rec !== 'object') return json({ error: 'invalid record' }, 400);
      const rs = await readRecords();
      rec.id = rec.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      rec.serverTs = new Date().toISOString();
      rs.unshift(rec);
      await writeRecords(rs);
      return json({ ok: true, id: rec.id });
    }
    if (path === '/api/records' && request.method === 'GET') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const rs = await readRecords();
      const view = rs.slice(0, limit).map(r => ({
        id: r.id, result: r.result, stages: r.stages, totalTurns: r.totalTurns,
        totalRage: r.totalRage, durationSec: r.durationSec, clientTs: r.clientTs,
        serverTs: r.serverTs, nickname: r.nickname || '匿名玩家'
      }));
      return json({ records: view, total: rs.length });
    }
    if (path === '/api/admin/records' && request.method === 'GET') {
      if (!(await verifyAdmin(request))) return json({ error: 'Unauthorized' }, 401);
      return json({ records: await readRecords() });
    }
    if (path === '/api/admin/records' && request.method === 'DELETE') {
      if (!(await verifyAdmin(request))) return json({ error: 'Unauthorized' }, 401);
      await writeRecords([]);
      return json({ ok: true });
    }
    if (path === '/api/admin/login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.password || (await sha256(body.password)) !== ADMIN_HASH) {
        return json({ ok: false, error: '密码错误' }, 401);
      }
      return json({ ok: true, token: body.password });
    }
    if (path === '/api/admin/config' && request.method === 'GET') {
      if (!(await verifyAdmin(request))) return json({ error: 'Unauthorized' }, 401);
      const rs = await readRecords();
      return json({
        hasApiKey: !!env.OPENAI_API_KEY,
        apiBase: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiModel: env.OPENAI_MODEL || 'gpt-3.5-turbo',
        recordsCount: rs.length
      });
    }
    if (path === '/api/leaderboard' && request.method === 'GET') {
      const rs = await readRecords();
      const wins = rs.filter(r => r.result === 'win');
      wins.sort((a, b) => (a.totalTurns || 999) - (b.totalTurns || 999));
      const top = wins.slice(0, 20).map((r, i) => ({
        rank: i + 1, nickname: r.nickname || '匿名玩家',
        totalTurns: r.totalTurns, totalRage: r.totalRage,
        durationSec: r.durationSec, serverTs: r.serverTs
      }));
      return json({ top, totalWins: wins.length });
    }

    // 兜底
    return json({ error: 'Not Found', path }, 404);
};
