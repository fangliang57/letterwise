// Author: Leon Fang
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../scoring.js');
function perfect(overrides = {}) { return { ...L.exampleState().recommenders[0], ...overrides }; }
function stateOf(people) { return { ...L.blankState(), recommenders: people }; }

test('all seven dimensions reach raw 130 and final 100', () => {
  const result = L.scoreRecommender(perfect());
  assert.equal(result.base, 100);
  assert.equal(result.raw, 130);
  assert.equal(result.score, 100);
  assert.equal(result.grade.label, '无敌');
});
test('base weights total 100 and all displayed maxima total 130', () => {
  assert.equal(L.WEIGHTS.slice(0, 5).reduce((sum, item) => sum + item.max, 0), 100);
  assert.equal(L.WEIGHTS.reduce((sum, item) => sum + item.max, 0), 130);
});
test('known zero answers produce a valid zero score; negative raw is floored', () => {
  const result = L.scoreRecommender(perfect({ letterType: 'professional', endorsement: 'agreed', months: '0', offline: 'no', match: 'none', activity: 'none', title: 'other', region: 'domestic', school: 'other' }));
  assert.equal(result.complete, true);
  assert.equal(result.raw, -5);
  assert.equal(result.score, 0);
});
test('blank and partially filled people do not display a score', () => {
  assert.equal(L.scoreRecommender(L.blankRecommender()).score, null);
  assert.equal(L.scoreRecommender({ ...L.blankRecommender(), title: 'professor' }).completed, 1);
  assert.equal(L.scoreRecommender({ ...L.blankRecommender(), title: 'professor' }).score, null);
});
test('six months exactly does not earn a bonus; more than six does', () => {
  assert.equal(L.scoreRecommender(perfect({ months: '6' })).dimensions.strength, 15);
  assert.equal(L.scoreRecommender(perfect({ months: '6.5' })).dimensions.strength, 20);
});
test('time and offline cooperation do not imply an explicit strong endorsement', () => {
  const result = L.scoreRecommender(perfect({ endorsement: 'unasked' }));
  assert.equal(result.dimensions.strength, 10);
  assert.equal(result.base, 90);
});
test('course letter always has zero direction points, including manipulated inputs', () => {
  const result = L.scoreRecommender(perfect({ letterType: 'course', match: 'field' }));
  assert.equal(result.dimensions.relationship, 10);
  assert.equal(result.dimensions.match, 0);
  assert.equal(result.raw, 95);
});
test('course direction is known automatically', () => {
  assert.equal(L.scoreRecommender(perfect({ letterType: 'course', match: '' })).complete, true);
});
test('all region categories award one tier only', () => {
  for (const [region, points] of [['current', 20], ['employment', 15], ['phd', 10], ['visiting', 5], ['other', 0], ['domestic', -5]]) {
    assert.equal(L.scoreRecommender(perfect({ region })).dimensions.region, points);
  }
});
test('school bands award 10, 5 and 0', () => {
  for (const [school, points] of [['top', 10], ['strong', 5], ['other', 0]]) assert.equal(L.scoreRecommender(perfect({ school })).dimensions.school, points);
});
test('title and direction scores follow the specified rules', () => {
  for (const [title, points] of [['professor', 20], ['associate', 15], ['assistant', 10], ['other', 0]]) assert.equal(L.scoreRecommender(perfect({ title })).dimensions.title, points);
  for (const [match, points] of [['field', 25], ['school', 20], ['related', 15], ['none', 0]]) assert.equal(L.scoreRecommender(perfect({ match })).dimensions.match, points);
});
test('invalid numeric inputs leave the score incomplete', () => {
  for (const months of ['', '-1', 'NaN', 'Infinity', '601']) assert.equal(L.scoreRecommender(perfect({ months })).score, null);
});
test('invalid enum values are not silently treated as zero', () => {
  assert.equal(L.scoreRecommender(perfect({ school: 'invented' })).score, null);
});
test('all score interpretation boundaries are inclusive and unambiguous', () => {
  for (const [value, label] of [[0, '不及格'], [49, '不及格'], [50, '偏弱'], [59, '偏弱'], [60, '还行'], [79, '还行'], [80, '很强'], [89, '很强'], [90, '无敌'], [100, '无敌']]) assert.equal(L.grade(value).label, label);
  assert.equal(L.grade(null).label, '待评估');
});
test('below 50 explicitly recommends replacement', () => {
  assert.match(L.grade(49).description, /建议换推荐人/);
});
test('combination requires exactly three complete people', () => {
  assert.equal(L.scoreCombination([perfect(), perfect()]).score, null);
  assert.equal(L.scoreCombination([perfect(), perfect(), L.blankRecommender()]).score, null);
});
test('identical perfect people score 100', () => {
  assert.equal(L.scoreCombination([perfect(), perfect(), perfect()]).score, 100);
});
test('one weaker letter reduces the combination below the arithmetic mean', () => {
  const result = L.scoreCombination(L.exampleState().recommenders);
  assert.ok(result.score < result.average);
  assert.equal(result.weakestIndex, 2);
});
test('slot order never changes the score', () => {
  const people = L.exampleState().recommenders;
  assert.equal(L.scoreCombination(people).score, L.scoreCombination([...people].reverse()).score);
});
test('combination rounds only once, after using exact individual values', () => {
  const people = [perfect(), perfect({ title: 'associate' }), perfect({ title: 'assistant' })];
  const exact = [130, 125, 120].map(raw => raw / 130 * 100);
  const expected = Math.round(exact.reduce((a, b) => a + b, 0) / 3 * 0.8 + Math.min(...exact) * 0.2);
  assert.equal(L.scoreCombination(people).score, expected);
});
test('explicit reservations always appear in recommendations', () => {
  const state = stateOf([perfect({ name: 'A', endorsement: 'reserved' }), perfect(), perfect()]);
  assert.ok(L.interpretation(state).actions.some(action => action.includes('有所保留')));
});
test('incomplete data cannot export a report', () => {
  assert.equal(L.reportMarkdown(L.blankState(), '2026-11-01'), null);
});
test('report includes score, reasoning, rules, and correct author', () => {
  const report = L.reportMarkdown(L.exampleState(), '2026-11-01');
  assert.match(report, /作者：Leon Fang/);
  assert.match(report, /建议换推荐人/);
  assert.match(report, /组合得分/);
  assert.match(report, /130/);
});
test('corrupt or incompatible local data is reset', () => {
  assert.deepEqual(L.restoreState({ version: 'bad', recommenders: [] }), L.blankState());
  const state = L.exampleState();
  state.recommenders[0].title = 'invented';
  assert.equal(L.restoreState(state).recommenders[0].title, '');
});
test('existing answers keep their scores while legacy identifiers are removed', () => {
  const state = L.exampleState();
  state.recommenders[0].name = 'Legacy identifier';
  state.recommenders[0].institution = 'Legacy institution';
  const restored = L.restoreState(state);
  assert.equal(L.scoreCombination(restored.recommenders).score, L.scoreCombination(state.recommenders).score);
  assert.equal('name' in restored.recommenders[0], false);
  assert.equal('institution' in restored.recommenders[0], false);
  const report = L.reportMarkdown(restored, '2026-11-01');
  assert.ok(!report.includes('Legacy identifier'));
  assert.ok(!report.includes('Legacy institution'));
  assert.match(report, /推荐人 1/);
  assert.match(report, /学校档次/);
});
test('restoring saved data preserves zero months and normalizes pure course letters', () => {
  const state = stateOf([perfect({ months: '0' }), perfect({ letterType: 'course', match: 'field' }), perfect()]);
  const restored = L.restoreState(state);
  assert.equal(restored.recommenders[0].months, '0');
  assert.equal(restored.recommenders[1].match, 'none');
});
test('every completed result stays in range across all region and school bands', () => {
  for (const region of L.OPTIONS.region) for (const school of L.OPTIONS.school) for (const title of L.OPTIONS.title) {
    const scored = L.scoreRecommender(perfect({ region: region.value, school: school.value, title: title.value }));
    assert.ok(scored.score >= 0 && scored.score <= 100);
  }
});
test('course explanation follows the zero match override even when a field was supplied', () => {
  const analysis = L.analyzeRecommender(perfect({ letterType: 'course', match: 'field' }));
  const direction = analysis.rows.find(item => item.key === 'match');
  assert.equal(direction.value, 0);
  assert.match(direction.explanation, /固定计 0\/25/);
  assert.equal(analysis.rows.reduce((sum, item) => sum + item.value, 0), 95);
});
test('strength explanation keeps all three signals separate at the six month boundary', () => {
  const analysis = L.analyzeRecommender(perfect({ endorsement: 'unasked', months: '6', offline: 'no' }));
  assert.match(analysis.strengthDetail, /未超过 6 个月/);
  assert.match(analysis.strengthDetail, /0\/10/);
  assert.match(analysis.strengthDetail, /合计 0\/20/);
});
test('combination explanation reports the actual weak letter adjustment', () => {
  const analysis = L.analyzeCombination(L.exampleState().recommenders).join('\n');
  assert.match(analysis, /下调约 9\.2 分/);
  assert.match(analysis, /推荐人 3 的单人分为 19/);
  const balanced = L.analyzeCombination([perfect(), perfect(), perfect()]).join('\n');
  assert.match(balanced, /没有进一步拉低/);
});
test('incomplete forms cannot generate a personal or combination analysis', () => {
  assert.equal(L.analyzeRecommender(L.blankRecommender()), null);
  assert.deepEqual(L.analyzeCombination(L.blankState().recommenders), []);
});
