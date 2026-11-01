/* Author: Leon Fang */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Letterwise = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0';
  const MAX_RAW = 130;
  const REQUIRED = ['letterType', 'endorsement', 'months', 'offline', 'match', 'activity', 'title', 'region', 'school'];
  const OPTIONS = {
    letterType: [
      { value: 'research', label: '研究推', points: 20 },
      { value: 'course', label: '课程推', points: 10 },
      { value: 'professional', label: '职业推', points: 0 }
    ],
    endorsement: [
      { value: 'strong', label: '明确承诺积极推荐 / 强推', points: 10 },
      { value: 'agreed', label: '答应写信，尚未承诺强推', points: 0 },
      { value: 'unasked', label: '尚未沟通推荐意愿', points: 0 },
      { value: 'reserved', label: '有所保留 / 不愿积极推荐', points: 0 }
    ],
    offline: [
      { value: 'yes', label: '有线下合作', points: 5 },
      { value: 'no', label: '纯线上合作', points: 0 }
    ],
    match: [
      { value: 'field', label: '完全同 field', points: 25 },
      { value: 'school', label: '同 school，不同方向', points: 20 },
      { value: 'related', label: '跨 school，但有研究联系', points: 15 },
      { value: 'none', label: '纯课程推 / 完全无联系', points: 0 }
    ],
    activity: [
      { value: 'leading', label: '持续产出，且有较强代表作', points: 15 },
      { value: 'active', label: '持续有相关成果', points: 10 },
      { value: 'some', label: '有少量相关成果', points: 5 },
      { value: 'none', label: '近两年无相关成果', points: 0 }
    ],
    title: [
      { value: 'professor', label: '正教授 / Full Professor', points: 20 },
      { value: 'associate', label: '副教授 / Associate Professor', points: 15 },
      { value: 'assistant', label: '助理教授 / Assistant Professor', points: 10 },
      { value: 'other', label: '其他职称', points: 0 }
    ],
    region: [
      { value: 'current', label: '目前在申请地任职，直接匹配', points: 20 },
      { value: 'employment', label: '曾在申请地正式任职', points: 15 },
      { value: 'phd', label: '曾在申请地取得 PhD', points: 10 },
      { value: 'visiting', label: '曾在申请地访问 / 做博后', points: 5 },
      { value: 'other', label: '有其他海外背景，无上述匹配', points: 0 },
      { value: 'domestic', label: '无上述匹配，且为纯国内背景', points: -5 }
    ],
    school: [
      { value: 'top', label: '清北 / 美国专排前 20 / 英国 G5', points: 10 },
      { value: 'strong', label: '其他 Top 985 / 美国专排 21–50 / 英国前 10 非 G5', points: 5 },
      { value: 'other', label: '其他学校', points: 0 }
    ]
  };
  const WEIGHTS = [
    { key: 'relationship', label: '指导关系', max: 20 },
    { key: 'strength', label: '推荐力度', max: 20 },
    { key: 'match', label: '方向匹配', max: 25 },
    { key: 'activity', label: '学术活跃', max: 15 },
    { key: 'title', label: '职称资历', max: 20 },
    { key: 'region', label: '地区背景', max: 20 },
    { key: 'school', label: '学校等级', max: 10 }
  ];
  const RATIONALE = {
    relationship: '指导关系用于区分推荐人主要观察过什么。研究推对应研究过程、独立贡献和解决问题的经历，因此设为 20 分；课程推主要反映课程学习表现，设为 10 分；职业推在本项计 0 分。企业研究导师也可按研究推填写，身份与推荐类型分别判断。',
    strength: '推荐力度同时看支持意愿和观察机会。明确承诺积极推荐占 10 分，合作超过 6 个月和线下合作各占 5 分。前者直接表达支持态度，后两项在本模型中作为了解申请人工作过程的辅助信号。三项分别计分，合作时间长不会自动替代强推承诺。',
    match: '方向匹配设为基础分中最高的 25 分，体现本模型对目标研究方向相关性的重视。同 field 25 分，同 school 的不同方向 20 分，跨 school 但有联系 15 分，无联系 0 分。纯课程推的 10 分已在指导关系中计入，方向项固定为 0，避免把课程评价再次当作研究方向的支持。',
    activity: '近两年学术活跃度占 15 分，用于描述推荐人的近期研究背景。持续产出且有较强代表作、持续产出、少量成果和无相关成果，分别对应 15、10、5、0 分。按所在学科的成果形式与发表习惯判断，不跨学科直接比较论文篇数。',
    title: '职称资历占 20 分，是本模型对学术评价经验的背景赋值：正教授 20，副教授 15，助理教授 10，其他职称 0。推荐人是否愿意积极支持、是否直接参与过你的研究，仍由推荐力度和指导关系分别反映。',
    region: '地区背景是最高加 20 分的修正项，表达本模型对申请地科研环境与博士培养经历的熟悉程度的偏好。目前在当地任职、曾正式任职、当地 PhD、访问或博后，依次为 +20、+15、+10、+5；有其他海外背景但无直接匹配计 0，纯国内且无上述匹配计 −5。只取一档，避免同一段经历在多个身份下重复加分。',
    school: '学校档次最高加 10 分，作为任职平台与目标学科背景的补充。清北、美国专业前 20、英国 G5 加 10；其他 Top 985、美国专业 21–50、英国前 10 中的非 G5 加 5；其他为 0。只看当前任职学校且只取一档，保持这项加分小于研究关系、推荐力度和方向匹配各自的满分。'
  };
  const METHOD_NOTES = [
    '五项基础分合计 100 分，地区最高加 20 分，学校最高加 10 分，原始满分因此为 130。单人分用原始分除以 130 再乘 100；负原始分按 0 处理。这样既保留背景加分，也保留高分推荐人之间的差异。',
    '组合分采用 80% 的单人平均分加 20% 的最低单人分。平均分保留三封信的整体水平，最低分项使较弱的一封产生更明显的影响。计算使用未取整的单人分，最后才四舍五入。',
    '分档用于帮助选择推荐人：低于 50 分建议换人，50–59 分建议优化组合，60–79 分为还行，80–89 分为很强，90–100 分为无敌。这些档位表示本规则下的组合强度。'
  ];
  const REFERENCES = [
    { title: '斯坦福：推荐人选择与推荐信内容', url: 'https://gradadmissions.stanford.edu/apply/recommendations' },
    { title: '伯克利：研究生申请推荐信建议', url: 'https://career.berkeley.edu/get-into-grad-school/graduate-school/grad-school-letters-of-recommendation/' }
  ];

  function option(key, value) {
    return (OPTIONS[key] || []).find(item => item.value === value);
  }
  function points(key, value) {
    return option(key, value)?.points ?? 0;
  }
  function blankRecommender() {
    return { identity: '', letterType: '', endorsement: '', months: '', offline: '', match: '', activity: '', title: '', region: '', school: '' };
  }
  function blankState() {
    return { version: VERSION, active: 0, recommenders: Array.from({ length: 3 }, blankRecommender) };
  }
  function normalizeTo100(raw) {
    return Math.round(Math.max(0, Math.min(MAX_RAW, Number(raw) || 0)) / MAX_RAW * 100);
  }
  function monthsValid(value) {
    return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 600;
  }
  function isKnown(person, key) {
    if (key === 'months') return monthsValid(person.months);
    if (key === 'match' && person.letterType === 'course') return true;
    return Boolean(option(key, person[key]));
  }
  function grade(score) {
    if (score === null || score === undefined || !Number.isFinite(Number(score))) return { label: '待评估', tone: 'pending', description: '填写评分项后，自动生成分数解读。' };
    if (score >= 90) return { label: '无敌', tone: 'excellent', description: '推荐人组合条件突出，可以作为申请中的核心支持。' };
    if (score >= 80) return { label: '很强', tone: 'strong', description: '推荐人组合有很强的支撑力，优先确认每封信的具体内容。' };
    if (score >= 60) return { label: '还行', tone: 'okay', description: '组合具备一定支撑力，补强分数最低的一封信会更有效。' };
    if (score >= 50) return { label: '偏弱', tone: 'weak', description: '建议优化推荐人组合，优先补充更相关、了解你更多的推荐人。' };
    return { label: '不及格', tone: 'poor', description: '建议换推荐人，优先寻找能直接评价你研究能力的人。' };
  }
  function scoreRecommender(person) {
    const safe = person || blankRecommender();
    const missing = REQUIRED.filter(key => !isKnown(safe, key));
    const dimensions = {
      relationship: points('letterType', safe.letterType),
      strength: points('endorsement', safe.endorsement) + (monthsValid(safe.months) && Number(safe.months) > 6 ? 5 : 0) + points('offline', safe.offline),
      match: safe.letterType === 'course' ? 0 : points('match', safe.match),
      activity: points('activity', safe.activity),
      title: points('title', safe.title),
      region: points('region', safe.region),
      school: points('school', safe.school)
    };
    const base = dimensions.relationship + dimensions.strength + dimensions.match + dimensions.activity + dimensions.title;
    const raw = base + dimensions.region + dimensions.school;
    const complete = missing.length === 0;
    const score = complete ? normalizeTo100(raw) : null;
    return { complete, completed: REQUIRED.length - missing.length, total: REQUIRED.length, missing, dimensions, base, raw, score, grade: grade(score) };
  }
  function scoreCombination(recommenders) {
    const people = Array.isArray(recommenders) ? recommenders.slice(0, 3) : [];
    const individuals = people.map(scoreRecommender);
    const completed = individuals.filter(result => result.complete).length;
    const complete = individuals.length === 3 && completed === 3;
    if (!complete) return { complete: false, completed, individuals, score: null, average: null, minimum: null, weakestIndex: -1, grade: grade(null) };
    // Aggregate unrounded individual values, then round once for the displayed result.
    const exact = individuals.map(result => Math.max(0, result.raw) / MAX_RAW * 100);
    const average = exact.reduce((sum, value) => sum + value, 0) / 3;
    const minimum = Math.min(...exact);
    const score = Math.round(average * 0.8 + minimum * 0.2);
    return { complete: true, completed: 3, individuals, average, minimum, weakestIndex: exact.indexOf(minimum), score, grade: grade(score) };
  }
  function personName(_person, index) {
    return `推荐人 ${index + 1}`;
  }
  function personAdvice(person, result) {
    if (!result.complete) return ['完成剩余评分项后生成建议。'];
    const advice = [];
    if (result.score < 50) advice.push('建议换推荐人，优先考虑直接指导过你研究、且愿意积极推荐的人。');
    if (person.endorsement === 'reserved') advice.push('这位推荐人对积极推荐有所保留，建议优先寻找替代人选。');
    else if (person.endorsement !== 'strong') advice.push('先确认对方是否愿意写积极、具体的推荐信。');
    if (person.letterType !== 'research') advice.push('可比较是否有能评价研究过程与独立贡献的导师。');
    if (result.dimensions.match < 25 && person.letterType !== 'course') advice.push('可比较研究方向与申请 field 更直接匹配的推荐人。');
    if (!advice.length) advice.push('保留这位推荐人，整理项目贡献和研究成果，帮助对方写出具体评价。');
    return advice.slice(0, 2);
  }
  function analyzeRecommender(person, result = scoreRecommender(person)) {
    if (!result.complete) return null;
    const dimensions = result.dimensions;
    const support = WEIGHTS.map(item => ({ ...item, value: dimensions[item.key] }))
      .filter(item => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 2);
    const gaps = WEIGHTS.map(item => ({ ...item, value: dimensions[item.key], gap: item.max - dimensions[item.key] }))
      .filter(item => item.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 2);
    const signedRegion = dimensions.region > 0 ? '+' + dimensions.region : String(dimensions.region);
    const summary = `基础分 ${result.base}/100，地区修正 ${signedRegion}，学校加分 ${dimensions.school}，原始分 ${result.raw}/130，折算为 ${result.score}/100。` + (result.raw < 0 ? '原始分低于 0，按下限 0 计分。' : '');
    const strengths = support.length ? `主要得分来自${support.map(item => `${item.label}（${item.value}/${item.max}）`).join('和')}。` : '当前填写的条件未产生正向得分。';
    const weaknesses = gaps.length ? `与模型满分的主要差距来自${gaps.map(item => `${item.label}（当前 ${item.value}，满档 ${item.max}）`).join('和')}。` : '各项均达到当前模型的满档。';
    const durationPoints = Number(person.months) > 6 ? 5 : 0;
    const endorsementPoints = points('endorsement', person.endorsement);
    const offlinePoints = points('offline', person.offline);
    const strengthDetail = `${option('endorsement', person.endorsement).label}：${endorsementPoints}/10；合作 ${Number(person.months)} 个月${Number(person.months) > 6 ? '，超过 6 个月' : '，未超过 6 个月'}：${durationPoints}/5；${option('offline', person.offline).label}：${offlinePoints}/5。三项合计 ${dimensions.strength}/20。`;
    const explanations = {
      relationship: `你选择${option('letterType', person.letterType).label}，按指导关系档位计 ${dimensions.relationship}/20。${person.letterType === 'research' ? '这一分类把研究过程中的直接观察作为核心支持。' : person.letterType === 'course' ? '课程学习表现提供一部分学术支持，因此保留一半分值。' : '职业推荐在研究指导关系这一项计 0，其他已填写维度继续各自计算。'}`,
      strength: strengthDetail,
      match: person.letterType === 'course' ? '这封信选择了课程推，方向匹配按规则固定计 0/25；课程推荐的作用已在指导关系中计入。' : `你选择“${option('match', person.match).label}”，方向匹配计 ${dimensions.match}/25。${person.match === 'field' ? '达到本模型对专业背景直接相关性的最高档。' : person.match === 'school' ? '同属一个学科所属学院，但未达到完全同 field 的档位。' : person.match === 'related' ? '保留跨学院研究联系对应的分值。' : '未填写直接的研究方向联系，因此这一项未得分。'}`,
      activity: `你选择“${option('activity', person.activity).label}”，近期学术活跃度计 ${dimensions.activity}/15。这部分描述推荐人的研究背景，与你们的合作关系分开计算。`,
      title: `你选择${option('title', person.title).label}，按本工具预设的资历档位计 ${dimensions.title}/20。`,
      region: `你选择“${option('region', person.region).label}”，地区修正为 ${signedRegion}。任职、博士和访问经历采用最高匹配档位，不相加。`,
      school: `你选择“${option('school', person.school).label}”，学校背景加 ${dimensions.school} 分。此处依据当前任职学校，只计一次。`
    };
    const rows = WEIGHTS.map(item => ({ ...item, value: dimensions[item.key], explanation: explanations[item.key] }));
    return { summary, strengths, weaknesses, strengthDetail, rows, gaps };
  }
  function analyzeCombination(recommenders, result = scoreCombination(recommenders)) {
    if (!result.complete) return [];
    const exactCombination = result.average * 0.8 + result.minimum * 0.2;
    const adjustment = result.average - exactCombination;
    const researchCount = recommenders.filter(person => person.letterType === 'research').length;
    const confirmedCount = recommenders.filter(person => person.endorsement === 'strong').length;
    const paragraphs = [
      `三封信的单人分均值约为 ${result.average.toFixed(1)}，最低单人分约为 ${result.minimum.toFixed(1)}。把未取整的均值乘以 80%，再加上未取整最低分的 20%，最后取整得到组合分 ${result.score}。`,
      adjustment > 0.000001 ? `与单纯取均分相比，较弱一封使组合分在取整前下调约 ${adjustment.toFixed(1)} 分。本模型用这部分修正体现组合的短板，避免只看到最高分的一封。` : '三封信分数一致，最低分与均分相同，因此短板项没有进一步拉低组合分。',
      `当前组合有 ${researchCount} 封研究推，${confirmedCount} 位推荐人明确承诺积极推荐。研究推数量反映研究经历在三封信中的覆盖；明确承诺的数量反映你已经确认的积极支持。两者分别计算，合作时间和学校背景不会自动替代推荐意愿。`
    ];
    const weakest = result.individuals[result.weakestIndex];
    const highest = Math.max(...result.individuals.map(item => item.score));
    if (highest !== weakest.score) paragraphs.push(`推荐人 ${result.weakestIndex + 1} 的单人分为 ${weakest.score}，是当前组合的最低值。优先调整这一封，可以同时影响平均分和短板项；更换后，系统会重新判断哪一封最低。`);
    return paragraphs;
  }
  function interpretation(state) {
    const result = scoreCombination(state.recommenders);
    if (!result.complete) return { ...result, headline: '完成三位推荐人的信息', summary: `已完成 ${result.completed}/3 位推荐人，评分项填齐后自动生成完整解读。`, reasons: [], actions: [] };
    const names = state.recommenders.map(personName);
    const weak = result.weakestIndex;
    const researchCount = state.recommenders.filter(person => person.letterType === 'research').length;
    const confirmedCount = state.recommenders.filter(person => person.endorsement === 'strong').length;
    const reasons = [
      `三位推荐人的平均分为 ${result.average.toFixed(1)}，最低分为 ${result.minimum.toFixed(1)}；按 80% 均分与 20% 最低分计算，组合得分 ${result.score}。`,
      `组合包含 ${researchCount} 封研究推，${confirmedCount} 位推荐人已明确承诺积极推荐。`,
      `${names[weak]}为当前最低分推荐人（${result.individuals[weak].score} 分）。`
    ];
    const actions = [];
    const reserved = state.recommenders.map((person, index) => person.endorsement === 'reserved' ? names[index] : null).filter(Boolean);
    if (reserved.length) actions.push(`${reserved.join('、')}对积极推荐有所保留，优先寻找替代人选。`);
    if (result.score < 50) actions.push('建议换推荐人，优先更换分数最低、且缺少直接研究指导的人选。');
    else if (result.score < 80) actions.push(`优先优化${names[weak]}这一封：${personAdvice(state.recommenders[weak], result.individuals[weak])[0]}`);
    else actions.push('保留当前组合，分别整理各位推荐人熟悉的项目、贡献与具体事例。');
    if (confirmedCount < 3) actions.push(`还有 ${3 - confirmedCount} 位尚未明确承诺积极推荐，建议先完成沟通。`);
    if (researchCount < 2) actions.push('当前研究推少于两封，可比较是否有熟悉你研究工作的其他导师。');
    if (researchCount >= 2 && confirmedCount === 3) actions.push('让三封信各自覆盖不同经历与能力，减少重复描述。');
    return { ...result, headline: `${result.score} 分，${result.grade.label}`, summary: result.grade.description, reasons, actions: actions.slice(0, 3) };
  }
  function restoreState(saved) {
    if (!saved || saved.version !== VERSION || !Array.isArray(saved.recommenders) || saved.recommenders.length !== 3) return blankState();
    const next = blankState();
    next.demo = saved.demo === true;
    next.active = Number.isInteger(saved.active) && saved.active >= 0 && saved.active < 3 ? saved.active : 0;
    next.recommenders = saved.recommenders.map(person => {
      const safe = blankRecommender();
      safe.identity = ['academic', 'nonacademic'].includes(person?.identity) ? person.identity : '';
      for (const key of REQUIRED) {
        if (key === 'months') safe[key] = monthsValid(person?.[key]) ? String(Number(person[key])) : '';
        else safe[key] = option(key, person?.[key]) ? person[key] : '';
      }
      if (safe.letterType === 'course') safe.match = 'none';
      return safe;
    });
    return next;
  }
  function exampleState() {
    return {
      version: VERSION, active: 0, 
      recommenders: [
        { ...blankRecommender(), identity: 'academic', letterType: 'research', endorsement: 'strong', months: '18', offline: 'yes', match: 'field', activity: 'leading', title: 'professor', region: 'current', school: 'top' },
        { ...blankRecommender(), identity: 'academic', letterType: 'research', endorsement: 'strong', months: '10', offline: 'yes', match: 'school', activity: 'active', title: 'associate', region: 'phd', school: 'strong' },
        { ...blankRecommender(), identity: 'academic', letterType: 'course', endorsement: 'agreed', months: '4', offline: 'yes', match: 'none', activity: 'some', title: 'assistant', region: 'domestic', school: 'other' }
      ]
    };
  }
  function reportMarkdown(state, date) {
    const result = interpretation(state);
    if (!result.complete) return null;
    const lines = ['# 荐力 Letterwise · 推荐人评估报告', '', '作者：Leon Fang', `日期：${date}`, `评分规则：v${VERSION}`, '', `## 组合得分：${result.score}/100 · ${result.grade.label}`, '', result.summary, '', '## 组合分析', '', ...analyzeCombination(state.recommenders, result).flatMap(text => [text, '']), '## 建议', '', ...result.actions.map(text => `- ${text}`)];
    state.recommenders.forEach((person, index) => {
      const scored = result.individuals[index];
      const analysis = analyzeRecommender(person, scored);
      lines.push('', `## ${personName(person, index)}：${scored.score}/100 · ${scored.grade.label}`, '', analysis.summary, '', analysis.strengths, '', analysis.weaknesses, '', '| 维度 | 本次判断与理由 | 得分 |', '| --- | --- | ---: |', ...analysis.rows.map(item => `| ${item.label} | ${item.explanation} | ${item.value}/${item.max} |`), '', ...personAdvice(person, scored).map(text => `- ${text}`));
    });
    lines.push('', '## 为什么这样评分', '', '以下权重为本工具的预设比较规则，分数衡量推荐信组合的支撑程度。');
    WEIGHTS.forEach(item => lines.push('', `### ${item.label}（最高 ${item.max} 分）`, '', RATIONALE[item.key]));
    lines.push('', ...METHOD_NOTES.flatMap(text => [text, '']), '熟悉程度、具体事例与评价能力的相关建议：', '', ...REFERENCES.map(source => `- [${source.title}](${source.url})`));
    lines.push('', '## 计算规则', '', '单人分 = round(max(0, 原始分) ÷ 130 × 100)。', '组合分 = round(单人未取整分的均值 × 80% + 单人未取整分的最低值 × 20%)。', '评级：低于 50 不及格；50–59 偏弱；60–79 还行；80–89 很强；90–100 无敌。', '评分衡量推荐人组合强度，不表示录取概率。', '');
    return lines.join('\n');
  }

  return { VERSION, MAX_RAW, REQUIRED, OPTIONS, WEIGHTS, RATIONALE, METHOD_NOTES, REFERENCES, analyzeRecommender, analyzeCombination, option, points, blankRecommender, blankState, normalizeTo100, monthsValid, scoreRecommender, scoreCombination, grade, interpretation, personAdvice, personName, restoreState, exampleState, reportMarkdown };
});
