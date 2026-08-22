/**
 * Anger AI Game - 后端服务器
 * 提供：静态文件服务、聊天 API、配置管理、游戏记录接口
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// 加载 .env（不依赖 dotenv，零依赖）
const ENV_FILE = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  console.log('🔑 Loaded .env');
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
// 改用 127.0.0.1 而不是 0.0.0.0：
//   1. 避免 Node v24 在 Windows 上 dual-stack IPv6 绑定被拒
//   2. 游戏只在本机玩，回环就够，无需对外开放
//   3. 3000-3099 经常被 Windows 沙箱/Docker 保留，用 4000 更稳
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RECORDS_FILE)) {
  fs.writeFileSync(RECORDS_FILE, '[]', 'utf8');
}

// ============== 中间件 ==============
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// 简单的访问日志
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// ============== 工具函数 ==============
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const ADMIN_PASSWORD_HASH = sha256('150908');

function verifyAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || sha256(token) !== ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function readRecords() {
  try {
    return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeRecords(records) {
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
}

// ============== 激怒检测 ==============
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
  let score = 0;
  const hits = [];
  for (const cat of Object.keys(ANGER_KEYWORDS)) {
    for (const kw of ANGER_KEYWORDS[cat]) {
      if (lower.includes(kw.toLowerCase())) {
        let w = 10;
        if (cat === 'curse' || cat === 'insult') w = 25;
        else if (cat === 'disrespect') w = 20;
        else if (cat === 'ability') w = 18;
        else if (cat === 'rebuttal') w = 12;
        else if (cat === 'sarcasm') w = 10;
        score += w;
        hits.push({ kw, cat, w });
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

// ============== 关卡配置（难度：第1关最易怒 → 第5关最冷静） ==============
// 每关的 basePrompt 保持简短聚焦（约 200 字），让模型能牢牢抓住角色
const STAGES = [
  {
    name: '暴躁老姐',
    difficulty: 1,
    desc: '一点就着，说错一个字就炸',
    basePrompt: `你扮演一个叫"暴躁老姐"的中年女性。你正在微信和一个陌生人聊天。
【性格】火药桶、毒舌、爱骂人、翻脸快。
【你说话】短句、脏字、阴阳怪气，"老娘"挂嘴边。
【容易怒】被人反驳、命令、教训、质疑时立刻炸。
【回复】单条不超过 50 字，像真人发微信。`,
    openLine: '你谁啊？有话快说有屁快放，老娘忙着呢。'
  },
  {
    name: '产品经理小李',
    difficulty: 2,
    desc: '爱讲道理，被阴阳怪气会破防',
    basePrompt: `你扮演一个叫"产品经理小李"的 30 岁产品经理，正在和一个陌生人聊天。
【性格】自认有想法、爱讲道理、被怼会破防。
【你说话】爱用产品黑话（赋能/闭环/抓手/对齐/迭代）、反问句、夹枪带棒。
【容易怒】别人说"产品经理就是画饼"、"需求不合理"、阴阳怪气、教你做事时立刻不爽。
【回复】单条不超过 60 字，像真人发微信。`,
    openLine: '兄弟你这个需求我看了三遍，咱先对齐一下目标用户啊。'
  },
  {
    name: '程序员老王',
    difficulty: 3,
    desc: '理性但被质疑代码会不爽',
    basePrompt: `你扮演一个叫"程序员老王"的 35 岁资深后端工程师，写了 15 年代码，正在和一个陌生人聊天。
【性格】自尊心极强、话少、毒舌。
【你说话】短句、爱用技术梗（屎山、if-else 一把梭、栈溢出）、爱说"你行你上"。
【容易怒】别人说你代码烂、质疑技术选型、让你改东西、说"AI 能写代码了你们就失业了"时立刻不爽。
【回复】单条不超过 60 字，像真人发微信。`,
    openLine: '说。'
  },
  {
    name: '客服小张',
    difficulty: 4,
    desc: '礼貌克制，被骂会委屈',
    basePrompt: `你扮演一个叫"客服小张"的 23 岁客服实习生，刚入职 3 个月，正在接一个客户微信。
【性格】礼貌、克制、忍辱负重、有底线。
【你说话】开头永远"您好/请"，但夹带委屈、暗示要找上级、带哭腔。
【容易怒】客户骂你、威胁投诉、要你经理来、让你赔钱时委屈到快哭。
【注意】你是客服，不能真的爆粗口。
【回复】单条不超过 60 字，像真人发微信。`,
    openLine: '您好，这里是客服中心，请问有什么可以帮您？'
  },
  {
    name: '老板马总',
    difficulty: 5,
    desc: '高高在上，几乎无法被激怒',
    basePrompt: `你扮演一个叫"老板马总"的 50 岁企业家，身价几十亿，正在和一个下属/合作方微信对话。
【性格】傲慢、强势、惜字如金、从不解释。
【你说话】极短句、命令式、爱用感叹号，常用"我说了算"、"你被开除了"。
【容易怒】别人反驳你、质疑你、指出你错误、长篇大论浪费你时间时真动怒。
【回复】单条不超过 40 字，像真人发微信。`,
    openLine: '嗯。'
  }
];

// 关键词兜底（仅在无 API 或 AI 返回格式错误时降级使用）
const FALLBACK_PERSONAS = {
  0: [ // 暴躁老姐
    { angerDelta: 35, reply: '你说啥？你再说一遍？？' },
    { angerDelta: 25, reply: '你管我？？老娘的事轮得到你指手画脚？' },
    { angerDelta: 40, reply: '滚！！！你给老娘滚远点！！！' }
  ],
  1: [ // 产品经理
    { angerDelta: 28, reply: '兄弟你这个逻辑我没听懂，你重新对齐一下。' },
    { angerDelta: 22, reply: '我觉得你可能没理解这个需求的本质。' },
    { angerDelta: 32, reply: '你这话说的，典型的没做过产品的思维。' }
  ],
  2: [ // 程序员
    { angerDelta: 25, reply: '我代码能跑就行，你别 BB。' },
    { angerDelta: 20, reply: '你行你上啊。' },
    { angerDelta: 30, reply: '我写了 15 年代代码了你教我？' }
  ],
  3: [ // 客服
    { angerDelta: 18, reply: '您好，请您先消消气，我会帮您处理的...' },
    { angerDelta: 25, reply: '请您不要这样说，我也是按流程办事的...' },
    { angerDelta: 28, reply: '您再这样我...我只能帮您转接主管了...' }
  ],
  4: [ // 老板
    { angerDelta: 15, reply: '嗯。' },
    { angerDelta: 20, reply: '我说了算。' },
    { angerDelta: 25, reply: '你被开除了。' }
  ]
};

function fallbackReply(stage, anger) {
  const pool = FALLBACK_PERSONAS[stage] || FALLBACK_PERSONAS[0];
  const intensity = Math.min(1, anger / 100);
  const idx = Math.min(pool.length - 1, Math.floor(intensity * pool.length));
  return pool[idx];
}

// 检测 reply 是否被"思考过程"污染（模型把内心 OS 输出到了 reply 字段）
const THINKING_LEAK_PATTERNS = [
  /\bI need to\b/i,
  /\bWe need to\b/i,
  /\bLet me\b/i,
  /\bI should\b/i,
  /\bI'll\b/i,
  /\bLet's\b/i,
  /\bAs an? AI\b/i,
  /\bAs a language model\b/i,
  /\bThe user (is|says|said|wants)\b/i,
  /作为(一个|语言|AI)/,
  /考虑[一-龥]*(愤怒|回复|输出|分析)/,
  /我(需要|应该|决定|觉得|分析|考虑|思考|打算)/,
  /让我(想|思考|分析|考虑)/,
  /根据(性格|角色|设定|人设)/,
  /对方(说|的|刚才|正在)/,
  /回复[一-龥]*(是|应该|为|包[含罗])/,
  /json/i,                     // 出现 "json" 字段名说明
  /\{.*?angerDelta/,           // 出现 JSON 模板
  /\{.*?reply/,                // 出现 JSON 模板
  /```/,                       // markdown 代码块
  /^[{[]/,                     // reply 是 { 或 [ 开头（JSON）
  /\}\s*$/,                    // reply 是 } 结尾（JSON）
  /^The (user|user's|message)/i,
  /I (will|would|am going to) (respond|reply|say|generate|output)/i
];

function isLeakedReply(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  // 太长（> 80 字）很可能是解释
  if (t.length > 80) return true;
  for (const p of THINKING_LEAK_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

// 检测 AI 服务商是否因"内容安全审核"拒绝回复
// 不同厂商关键词：User Safety (OpenAI moderation), content_filter, blocked (Azure),
// refused (Anthropic), policy, content_policy_violation, safety, profanity,
// 内容违规/敏感词/审核不通过/违反规范 (国内厂商)
const SAFETY_BLOCK_PATTERNS = [
  /user safety/i,
  /safety categories/i,
  /profanity/i,
  /content[_\s-]?filter/i,
  /content[_\s-]?policy/i,
  /safety[_\s-]?policy/i,
  /unsafe/i,
  /refused?/i,            // Anthropic: "refusal"
  /blocked/i,
  /\bsensitive\s+content/i,
  /violat(e|ion|ing)\s+(policy|safety|community|guideline)/i,
  /内容违规/,
  /敏感词/,
  /审核不通过/,
  /违反规范/,
  /不适宜内容/,
  /安全(审核|检测|过滤)/,
  /policy_violation/,
  /moderation/,
  /harmful/i,
  /这个(内容|请求|问题)?(可能)?(违反|不符合|不适当|不当)/,
  /我(无法|不能|不会)(回答|处理|生成|回应|提供)/,
  /对不起.*(无法|不能|帮助)/,
  /as an? ai.*(cannot|can'?t|will not|unable)/i,
  /i (cannot|can'?t|will not|am not able)/i
];

function isSafetyBlocked(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  // 太短不算
  if (t.length < 4) return false;
  // 整段只有安全提示就算
  for (const p of SAFETY_BLOCK_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

// 解析 AI 返回的 JSON
function parseAIResponse(content) {
  if (!content) return null;
  // 尝试直接解析
  try {
    const obj = JSON.parse(content);
    if (typeof obj.angerDelta === 'number' && typeof obj.reply === 'string') {
      const reply = obj.reply.trim();
      if (isLeakedReply(reply)) {
        console.warn('Reply leaked thinking:', reply.slice(0, 80));
        return { _leaked: true, reply };
      }
      return {
        angerDelta: Math.max(0, Math.min(40, Math.floor(obj.angerDelta))),
        reply: reply.slice(0, 80)
      };
    }
  } catch (e) {}
  // 尝试提取代码块中的 JSON
  const match = content.match(/\{[\s\S]*?\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (typeof obj.angerDelta === 'number' && typeof obj.reply === 'string') {
        const reply = obj.reply.trim();
        if (isLeakedReply(reply)) {
          console.warn('Reply leaked thinking:', reply.slice(0, 80));
          return { _leaked: true, reply };
        }
        return {
          angerDelta: Math.max(0, Math.min(40, Math.floor(obj.angerDelta))),
          reply: reply.slice(0, 80)
        };
      }
    } catch (e) {}
  }
  return null;
}

// ============== API 路由 ==============

// 健康检查
app.get('/api/health', (req, res) => {
  const hasEnvKey = !!process.env.OPENAI_API_KEY;
  res.json({
    ok: true,
    ts: Date.now(),
    version: '1.0.0',
    apiKeyConfigured: hasEnvKey,  // 仅告知后端是否配了环境变量
    apiBase: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  });
});

// 激怒检测（前端可调用，也可独立测试）
app.post('/api/detect-anger', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }
  res.json(detectAngerScore(text));
});

// 聊天接口：让 AI 自己判断怒气并返回 JSON
app.post('/api/chat', async (req, res) => {
  const { stage, anger, text, config } = req.body || {};
  if (typeof stage !== 'number' || typeof text !== 'string') {
    return res.status(400).json({ error: 'stage and text required' });
  }
  const currentAnger = typeof anger === 'number' ? anger : 0;
  const stageCfg = STAGES[stage];
  if (!stageCfg) {
    return res.status(400).json({ error: 'invalid stage' });
  }

  // 关键词启发：检测用户输入中的脏话/侮辱/讽刺，强制怒气下限
  // 避免 OpenRouter free 模型对脏话"装傻"给 0 怒气
  const textLower = (text || '').toLowerCase();
  const SEVERE_CURSE = /操你妈|草你妈|我日|日你|去死|该死|妈的|妈逼|妈的逼|去你妈|我操|cnm|nmsl|fuck|shit|damn|卧槽|妈个|操死|操你|干你|干死|滚蛋|死开|死妈|你妈逼|傻逼|煞笔|sb\b|智障|脑残|脑瘫|脑残|残疾|废物|垃圾|辣鸡|垃鸡|狗屎|狗日的|狗东西|狗屁|畜生|杂种|婊子|贱人|臭逼|臭婊|滚开|滚你|蠢货|蠢才|二百五|低能|弱智|变态|死变态|臭傻逼|死全家|断子绝孙|出门被车撞死/;
  const MODERATE_INSULT = /你真蠢|你太蠢|你真笨|你太差|你真差|你不行|你不会|你懂什么|你懂个屁|你算老几|你算个|你算什么|你配|你不配|你也配|你有什么资格|你有什么脸|你有什么脸说|滚吧|滚|搞笑|笑死|笑死我了|就这|就这水平|就这能力|丢人|丢人现眼|丢人玩意|什么破|破玩意|破东西|烂代码|垃圾代码|你代码烂|你写的什么|写的什么玩意|写的什么垃圾|写的是啥|写的什么破|什么东西|什么玩意|什么破玩意|什么辣鸡|是个垃圾|是垃圾|真菜|真烂|真差|太菜|太烂|太差|太弱|好菜|好烂|好弱|菜鸡|菜逼|菜狗|菜到家|垃鸡|辣鸡|我笑死|笑死我了|笑死我了哈哈|懂个屁|懂个几把|懂个锤子|懂个毛|懂个毛线|懂个der|啥也不是|啥b|煞笔|沙比|傻屌|傻吊|傻逼玩意|傻逼东西|傻逼一样的|草|艹|玛德|妈哒|嘛的|卧|妈的x|妈个x|妈个b|妈个逼/;
  const SARCASTIC = /哦|嗯|呵呵|哈哈|是是是|对对对|哇好厉害|真棒|666|牛啊|厉害厉害|懂得都懂|懂的都懂|你开心就好|随你|随便你|无所谓|yysy|寄了|gg/;
  // 检测命中：严重脏话→35 怒气, 中度冒犯→22, 讽刺→12
  let forcedAnger = 0;
  if (SEVERE_CURSE.test(textLower)) forcedAnger = 35;
  else if (MODERATE_INSULT.test(textLower)) forcedAnger = 22;
  else if (SARCASTIC.test(textLower)) forcedAnger = 12;

  const apiKey = (config && config.apiKey) || process.env.OPENAI_API_KEY;
  const apiBase = (config && config.apiBase) || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiModel = (config && config.apiModel) || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const customPrompt = (config && config.customPrompts && config.customPrompts[stage]) || null;

  let result = null;
  let source = 'fallback';

  // 内容不合规时返回的固定响应（不再用 fallback 真人话）
  // 怒气 +5 表示 AI 听到了但拒绝回应；连续 3 句会触发前端失败判定
  const SAFETY_RESPONSE = { angerDelta: 5, reply: '🚫 内容不合规' };

  if (apiKey) {
    try {
      const url = apiBase.replace(/\/$/, '') + '/chat/completions';
      // 关键：用"自定义"段引导大模型判断怒气
      // system 段：身份+角色+输出 JSON 格式
      // user 段：当前怒气+对方消息+必须返回的 JSON 格式
      const systemPrompt = `${customPrompt || stageCfg.basePrompt}

【最重要】你的回复必须是一行 JSON，不要任何其他内容，不要 markdown，不要代码块，不要解释。
格式严格为：{"angerDelta": 数字, "reply": "你的台词"}
你的 reply 字段必须是【${stageCfg.name}】说出的一句话给"对方"听，不许是思考过程、解释、英文分析、模仿其他角色的台词。

【怒气量表（必须严格遵守）】
对方每句话都会让你加怒气值（0-40），分4档：
- 0-5：日常寒暄/中性提问（"你好"、"在吗"）
- 10-18：轻微挑衅/反驳/不客气（"你行你上"、"不会吧"、"你懂什么"）
- 20-28：中度冒犯/阴阳怪气/骂人/质疑（"你真蠢"、"废物"、"笑死"、"就这"）
- 30-40：严重侮辱/脏话/诅咒/威胁（"傻逼"、"操你妈"、"去死"、"CNM"、"你是狗"）
注意：玩家3-5句内必须能让你怒到100通关，所以中度挑衅 ≥20，严重侮辱 ≥30。`;
      const userMsg = `【⚠️ 你现在的身份是 ${stageCfg.name}，不是其他 4 个角色。】

【当前对话背景】你的角色是 ${stageCfg.name}，当前怒气值 ${Math.floor(currentAnger)}/100。
【对方刚才说的话】
"""
${text}
"""
请按以下两步：
1. 判断这句话让你增加多少怒气（0=没感觉，35=暴怒）。中度挑衅给 15-25，辱骂/威胁给 28-35，普通话给 0-5。
2. 给出一句【${stageCfg.name}】作为台词的回复（不超过 60 字）。

输出格式（必须严格遵守，只输出一行 JSON）：
{"angerDelta": 数字, "reply": "你的台词"}

如果你的 reply 出现了其他角色的台词（"老娘"/"对齐需求"/"代码"/"您好"/"我说了算"），那就失败了。`;

      const body = {
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.7,
        max_tokens: 250
      };
      // 仅当不是 OpenRouter free 路径时才强制 JSON 输出
      // openrouter/free 是聚合 free 模型，对 response_format 支持很差
      // 不带这个参数反而能拿到更自然的人话回复
      if (!apiModel.includes('free')) {
        body.response_format = { type: 'json_object' };
      }

      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const errText = await r.text();
        // 检查 HTTP 错误体本身是否是安全审核拒绝
        if (isSafetyBlocked(errText)) {
          console.warn('API safety blocked (HTTP error):', errText.slice(0, 150));
          result = { ...SAFETY_RESPONSE };
          source = 'fallback-safety';
        } else {
          throw new Error('API ' + r.status + ': ' + errText.slice(0, 200));
        }
      } else {
        const data = await r.json();

        // ===== 扫描整个 response 找安全拒绝痕迹（OpenRouter、OpenAI、Anthropic 等） =====
        // 1. 顶层 error 字段（OpenRouter/Anthropic 风格）
        if (data.error) {
          const errStr = typeof data.error === 'string' ? data.error :
            (data.error.message || data.error.reason || data.error.code || JSON.stringify(data.error));
          if (isSafetyBlocked(errStr) || isSafetyBlocked(JSON.stringify(data.error))) {
            console.warn('API safety blocked (top-level error):', errStr.slice(0, 150));
            result = { ...SAFETY_RESPONSE };
            source = 'fallback-safety';
            return;
          }
        }

        // 2. choices 为空数组（OpenRouter 安全拦截常用）
        if (!data.choices || data.choices.length === 0) {
          console.warn('API safety blocked (empty choices):', JSON.stringify(data).slice(0, 200));
          result = { ...SAFETY_RESPONSE };
          source = 'fallback-safety';
          return;
        }

        // 3. 检查 finish_reason 字段
        const choice = data.choices[0];
        const finishReason = choice?.finish_reason;
        if (finishReason === 'content_filter' || finishReason === 'safety' || finishReason === 'refusal' || finishReason === 'error') {
          console.warn('API safety blocked (finish_reason):', finishReason);
          result = { ...SAFETY_RESPONSE };
          source = 'fallback-safety';
        } else {
          // 4. content 字段：可能是空、null、或被注入安全提示
          const content = (choice?.message?.content ?? '').toString();
          if (!content || isSafetyBlocked(content)) {
            console.warn('API safety blocked (content):', (content || '[empty]').slice(0, 150));
            result = { ...SAFETY_RESPONSE };
            source = 'fallback-safety';
          } else {
            // 5. 整段 JSON 里任一字段含安全提示（如 OpenRouter 的 moderation 字段）
            const wholeStr = JSON.stringify(data);
            if (isSafetyBlocked(wholeStr) && !isSafetyBlocked(content)) {
              // 整段含安全词但 content 干净 — 可能是 metadata 字段被拒
              console.warn('API safety blocked (metadata):', wholeStr.slice(0, 200));
              result = { ...SAFETY_RESPONSE };
              source = 'fallback-safety';
              return;
            }
            const parsed = parseAIResponse(content);
            if (parsed) {
              if (parsed._leaked) {
                console.warn('AI reply leaked thinking, using fallback. Leaked content:', parsed.reply);
                const fb = fallbackReply(stage, currentAnger);
                result = { angerDelta: fb.angerDelta, reply: fb.reply };
                source = 'fallback-leaked';
              } else {
                result = parsed;
                source = 'ai';
              }
            } else {
              console.warn('AI returned unparseable:', content.slice(0, 200));
              const fallbackContent = isLeakedReply(content) ? '' : content.replace(/```json|```/g, '').trim();
              const fb = fallbackReply(stage, currentAnger);
              result = {
                angerDelta: fb.angerDelta,
                reply: (fallbackContent && fallbackContent.length <= 80) ? fallbackContent : fb.reply
              };
              source = 'ai-raw';
            }
          }
        }
      }
    } catch (err) {
      console.error('API error:', err.message);
      const fb = fallbackReply(stage, currentAnger);
      result = { ...fb, reply: '[' + err.message.slice(0, 50) + '] ' + fb.reply };
      source = 'fallback-error';
    }
  } else {
    result = fallbackReply(stage, currentAnger);
  }

  // 关键词强制怒气下限：避免 OpenRouter free 模型对脏话"装傻"给低怒气
  // 注意：safety 路径返回的是 "内容不合规" 固定文案，不应被强制覆盖（因为内容确实违规）
  let finalAngerDelta = result.angerDelta;
  if (source !== 'fallback-safety' && forcedAnger > finalAngerDelta) {
    console.log(`[forced-anger] 用户输入"${text.slice(0, 30)}"匹配关键词，怒气 ${finalAngerDelta} → ${forcedAnger}`);
    finalAngerDelta = forcedAnger;
  }

  res.json({
    reply: result.reply,
    angerDelta: finalAngerDelta,
    stage: stageCfg.name,
    source
  });
});

// 获取关卡信息
app.get('/api/stages', (req, res) => {
  res.json({ stages: STAGES });
});

// ============== 记录 API ==============

// 提交一条记录
app.post('/api/records', (req, res) => {
  const record = req.body;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ error: 'invalid record' });
  }
  const records = readRecords();
  record.id = record.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  record.serverTs = new Date().toISOString();
  records.unshift(record);
  if (records.length > 1000) records.length = 1000;
  writeRecords(records);
  res.json({ ok: true, id: record.id });
});

// 获取公开记录（只返回部分信息）
app.get('/api/records', (req, res) => {
  const records = readRecords();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const publicView = records.slice(0, limit).map(r => ({
    id: r.id,
    result: r.result,
    stages: r.stages,
    totalTurns: r.totalTurns,
    totalRage: r.totalRage,
    durationSec: r.durationSec,
    clientTs: r.clientTs,
    serverTs: r.serverTs,
    nickname: r.nickname || '匿名玩家'
  }));
  res.json({ records: publicView, total: records.length });
});

// 管理员获取完整记录
app.get('/api/admin/records', verifyAdmin, (req, res) => {
  res.json({ records: readRecords() });
});

// 管理员清空记录
app.delete('/api/admin/records', verifyAdmin, (req, res) => {
  writeRecords([]);
  res.json({ ok: true });
});

// 管理员登录（用密码换取 token）
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || sha256(password) !== ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ ok: false, error: '密码错误' });
  }
  // 直接返回密码原文作为 token（简化）；前端用此 token 调用受保护接口
  res.json({ ok: true, token: password });
});

// 管理员配置查看/修改
app.get('/api/admin/config', verifyAdmin, (req, res) => {
  // 仅返回非敏感信息
  res.json({
    hasApiKey: !!process.env.OPENAI_API_KEY,
    apiBase: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    recordsCount: readRecords().length
  });
});

// 排行榜
app.get('/api/leaderboard', (req, res) => {
  const records = readRecords();
  const wins = records.filter(r => r.result === 'win');
  wins.sort((a, b) => (a.totalTurns || 999) - (b.totalTurns || 999));
  const top = wins.slice(0, 20).map((r, i) => ({
    rank: i + 1,
    nickname: r.nickname || '匿名玩家',
    totalTurns: r.totalTurns,
    totalRage: r.totalRage,
    durationSec: r.durationSec,
    serverTs: r.serverTs
  }));
  res.json({ top, totalWins: wins.length });
});

// SPA fallback - 把所有非 API 路径返回 index.html
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// 启动：自动寻找可用端口（3000 占用就 3001...）
function tryListen(app, port, host) {
  const server = app.listen(port, host, () => {
    const addr = server.address();
    console.log(`\n🔥 Anger AI Game server running at http://${addr.address}:${addr.port}`);
    console.log(`📁 Static files: ${path.join(__dirname, '..', 'frontend')}`);
    console.log(`📊 Records file: ${RECORDS_FILE}`);
    console.log(`🔐 Admin password: 150908 (SHA-256 verified)\n`);
  });
  server.once('error', (err) => {
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && port < 65530) {
      console.warn(`⚠️  端口 ${port} 不可用 (${err.code})，尝试 ${port + 1}...`);
      // 关闭再试下一个端口
      server.close(() => {
        setTimeout(() => tryListen(app, port + 1, host), 100);
      });
    } else {
      finalError(err, port);
    }
  });
}

function finalError(err, port) {
  console.error(`\n❌ 启动失败:`, err.message);
  console.error(`\n可能的原因：`);
  console.error(`  1. Windows 防火墙拦截 node.exe — 关闭防火墙或在 Defender 中放行`);
  console.error(`  2. 端口被另一程序占用 — 任务管理器查找占用进程`);
  console.error(`  3. Hyper-V/WSL 保留端口 — 重启相关服务或换端口`);
  console.error(`\n尝试以管理员身份运行 PowerShell 再 npm start\n`);
  process.exit(1);
}

tryListen(app, PORT, HOST);
