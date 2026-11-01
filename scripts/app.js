/* Author: Leon Fang */
(function () {
  'use strict';
  const L = window.Letterwise;
  const STORAGE_KEY = 'letterwise.leonfang.v1';
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  let screen = 'workspace';
  let state;
  let toastTimer;
  try { state = L.restoreState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { state = L.blankState(); }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function selected(a, b) { return a === b ? ' selected' : ''; }
  function disabled(value) { return value ? ' disabled' : ''; }
  function toast(message) {
    const element = document.getElementById('toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 3000);
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('浏览器未能保存本次填写。'); }
  }
  function hasData() {
    return state.recommenders.some(person => L.scoreRecommender(person).completed > 0);
  }
  function shell() {
    app.innerHTML = `<main id="workspace" tabindex="-1">
      <header class="page-header"><h1>${screen === 'report' ? '评估结果' : 'PhD 推荐人评估'}</h1>${screen === 'report' ? '<button data-action="workspace">返回填写</button>' : ''}</header>
      <div id="page-content">${screen === 'report' ? reportView() : workspaceView()}</div>
    </main>`;
    if (screen === 'workspace') updateProgress();
  }
  function switcher() {
    return state.recommenders.map((person, index) => {
      return `<button class="person-tab${index === state.active ? ' active' : ''}" data-person-index="${index}" aria-pressed="${index === state.active}">推荐人 ${index + 1}</button>`;
    }).join('');
  }
  function selectField(key, label, wide) {
    const person = state.recommenders[state.active];
    const course = key === 'match' && person.letterType === 'course';
    return `<label${wide ? ' class="wide"' : ''}>${label}<select data-person-field="${key}" id="person-${key}"${disabled(course)}><option value="">请选择</option>${L.OPTIONS[key].map(item => `<option value="${esc(item.value)}"${selected(person[key], item.value)}>${esc(item.label)}</option>`).join('')}</select></label>`;
  }
  function personForm() {
    const person = state.recommenders[state.active];
    const progress = L.scoreRecommender(person);
    return `<form id="person-form" autocomplete="off" novalidate>
      <div class="section-header"><h2>推荐人 ${state.active + 1}</h2><span id="form-progress">${progress.completed}/${progress.total} 项已填</span></div>
      <div class="field-grid">
        <label>身份（选填）<select data-person-field="identity"><option value="">请选择</option><option value="academic"${selected(person.identity, 'academic')}>学术界</option><option value="nonacademic"${selected(person.identity, 'nonacademic')}>非学术界</option></select></label>
        ${selectField('title', '职称', false)}
        ${selectField('school', '任职学校档次', true)}
        <fieldset class="wide"><legend>推荐类型</legend><div class="radio-options">${L.OPTIONS.letterType.map(item => `<label><input type="radio" name="letterType" data-person-field="letterType" value="${item.value}"${person.letterType === item.value ? ' checked' : ''}>${item.label}</label>`).join('')}</div></fieldset>
        ${selectField('endorsement', '推荐意愿', false)}
        <label>合作时长（月）<input type="number" min="0" max="600" step="0.5" inputmode="decimal" data-person-field="months" value="${esc(person.months)}"></label>
        ${selectField('offline', '合作方式', false)}
        ${selectField('match', '方向匹配', false)}
        ${selectField('activity', '近两年学术活跃度', false)}
        ${selectField('region', '与申请地区的关联', false)}
      </div>
      <div class="form-actions">${state.active > 0 ? `<button type="button" data-person-index="${state.active - 1}">上一位</button>` : ''}${state.active < 2 ? `<button type="button" data-person-index="${state.active + 1}">下一位</button>` : ''}</div>
    </form>`;
  }
  function workspaceView() {
    return `<div class="person-nav"><div id="person-switcher" class="person-switcher" aria-label="选择推荐人">${switcher()}</div><span id="overall-progress"></span></div><div id="person-form-wrapper">${personForm()}</div><div class="result-action"><button class="result-button" data-action="report"${disabled(!L.scoreCombination(state.recommenders).complete)}>查看结果</button></div><div class="workspace-actions"><button class="text-button" data-action="reset">清空</button><button class="text-button" data-action="example">示例</button></div>`;
  }
  function updateProgress() {
    const result = L.scoreCombination(state.recommenders);
    const tabs = document.getElementById('person-switcher');
    if (tabs) tabs.innerHTML = switcher();
    const overall = document.getElementById('overall-progress');
    if (overall) overall.textContent = `已完成 ${result.completed}/3`;
    const progress = document.getElementById('form-progress');
    if (progress) {
      const active = result.individuals[state.active];
      progress.textContent = `${active.completed}/${active.total} 项已填`;
    }
    document.querySelectorAll('[data-action="report"]').forEach(button => { button.disabled = !result.complete; });
  }
  function methodologyView() {
    return `<section class="methodology"><h2>为什么这样评分</h2><p>以下权重为本工具的预设比较规则，分数衡量推荐信组合的支撑程度。</p><dl>${L.WEIGHTS.map(item => `<dt>${item.label} · 最高 ${item.max} 分</dt><dd>${esc(L.RATIONALE[item.key])}</dd>`).join('')}</dl><h3>为什么折算为百分制，以及为什么考虑最低分</h3>${L.METHOD_NOTES.map(text => `<p>${esc(text)}</p>`).join('')}<p class="reference-links">关于熟悉程度、具体事例与评价能力，可参照${L.REFERENCES.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>`).join('、')}。</p></section>`;
  }
  function reportView() {
    const result = L.interpretation(state);
    if (!result.complete) return '<button data-action="workspace">继续填写</button>';
    return `<section class="result-summary"><h2>组合得分：${result.score}/100 · ${esc(result.grade.label)}</h2><p>${esc(result.summary)}</p></section>
      <section class="combination-analysis"><h2>组合分析</h2>${L.analyzeCombination(state.recommenders, result).map(text => `<p>${esc(text)}</p>`).join('')}</section>
      <section class="recommendations"><h2>优先调整</h2><ol>${result.actions.map(action => `<li>${esc(action)}</li>`).join('')}</ol></section>
      <section class="individual-results"><h2>三位推荐人的得分分析</h2>${state.recommenders.map((person, index) => {
        const scored = result.individuals[index];
        const analysis = L.analyzeRecommender(person, scored);
        return `<details${index === result.weakestIndex ? ' open' : ''}><summary>推荐人 ${index + 1}：${scored.score}/100 · ${esc(scored.grade.label)}</summary><div class="person-analysis"><p>${esc(analysis.summary)}</p><p>${esc(analysis.strengths)}</p><p>${esc(analysis.weaknesses)}</p><table class="analysis-table"><thead><tr><th>维度</th><th>本次判断与理由</th><th>得分</th></tr></thead><tbody>${analysis.rows.map(item => `<tr><td>${esc(item.label)}</td><td>${esc(item.explanation)}</td><td>${item.value}/${item.max}</td></tr>`).join('')}</tbody></table><p>${L.personAdvice(person, scored).map(esc).join('<br>')}</p><button class="text-button" data-edit-person="${index}">修改</button></div></details>`;
      }).join('')}</section>
      ${methodologyView()}
      <div class="report-actions"><button data-action="export">导出报告</button><button data-action="print">打印</button><button data-action="rules">评分规则</button></div>`;
  }
  function table(rows) {
    return `<table><thead><tr><th>条件</th><th>分值</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}</tbody></table>`;
  }
  function showModal(title, body) {
    modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="text-button" data-action="close-modal">关闭</button></div><div class="modal-body">${body}</div>`;
    if (!modal.open) modal.showModal();
  }
  function showRules() {
    showModal('评分规则', `<h3>基础分</h3>${table([
      ['研究推 / 课程推 / 职业推', '20 / 10 / 0'],
      ['明确积极推荐 / 合作超过 6 个月 / 线下合作', '10 / 5 / 5'],
      ['同 field / 同 school / 跨 school 有联系 / 无联系', '25 / 20 / 15 / 0'],
      ['近两年成果：持续且有较强代表作 / 持续 / 少量 / 无', '15 / 10 / 5 / 0'],
      ['正教授 / 副教授 / AP / 其他', '20 / 15 / 10 / 0']
    ])}<p>纯课程推的方向匹配为 0。school 指学科所属学院。</p><h3>地区背景（取一档）</h3>${table(L.OPTIONS.region.map(item => [esc(item.label), item.points]))}<h3>学校档次（取一档）</h3>${table(L.OPTIONS.school.map(item => [esc(item.label), item.points]))}<h3>计算</h3><p>单人分 = max(0, 原始分) ÷ 130 × 100。<br>组合分 = 单人分均值 × 80% + 最低单人分 × 20%。<br>组合使用未取整的单人分计算，最后取整。</p>${table([['不及格，建议换推荐人', '0–49'], ['偏弱', '50–59'], ['还行', '60–79'], ['很强', '80–89'], ['无敌', '90–100']])}`);
  }
  function confirmAction(title, action, label) {
    showModal(title, `<div class="modal-actions"><button data-action="close-modal">取消</button><button data-action="${action}">${label}</button></div>`);
  }
  function setScreen(next) {
    screen = next;
    shell();
    document.getElementById('workspace').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function selectPerson(index) {
    if (!Number.isInteger(index) || index < 0 || index > 2) return;
    state.active = index;
    persist();
    if (screen !== 'workspace') { setScreen('workspace'); return; }
    document.getElementById('person-form-wrapper').innerHTML = personForm();
    updateProgress();
  }
  function downloadReport() {
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const report = L.reportMarkdown(state, date);
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Letterwise-${date}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function loadExample() {
    state = L.exampleState();
    state.demo = true;
    persist();
    setScreen('workspace');
  }
  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-person]');
    if (edit) { state.active = Number(edit.dataset.editPerson); persist(); setScreen('workspace'); return; }
    const person = event.target.closest('[data-person-index]');
    if (person) { event.preventDefault(); selectPerson(Number(person.dataset.personIndex)); return; }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const action = button.dataset.action;
    if (action === 'workspace') setScreen('workspace');
    else if (action === 'report' && L.scoreCombination(state.recommenders).complete) setScreen('report');
    else if (action === 'rules' && screen === 'report') showRules();
    else if (action === 'close-modal') modal.close();
    else if (action === 'print') {
      const closed = Array.from(document.querySelectorAll('.individual-results details, .calculation')).filter(item => !item.open);
      closed.forEach(item => { item.open = true; });
      window.addEventListener('afterprint', () => closed.forEach(item => { item.open = false; }), { once: true });
      window.print();
    }
    else if (action === 'export') downloadReport();
    else if (action === 'example') {
      if (hasData()) confirmAction('用示例替换当前填写？', 'confirm-example', '替换');
      else loadExample();
    } else if (action === 'confirm-example') { modal.close(); loadExample(); }
    else if (action === 'reset') confirmAction('清空当前填写？', 'confirm-reset', '清空');
    else if (action === 'confirm-reset') { modal.close(); state = L.blankState(); persist(); setScreen('workspace'); }
  });
  document.addEventListener('input', event => {
    const input = event.target;
    if (!input.matches('input[data-person-field]') || input.type === 'radio') return;
    state.recommenders[state.active][input.dataset.personField] = input.value;
    if (input.type === 'number') input.setCustomValidity(input.value !== '' && !L.monthsValid(input.value) ? '请输入 0 到 600 之间的月数。' : '');
    persist();
    updateProgress();
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (!input.matches('[data-person-field]')) return;
    const person = state.recommenders[state.active];
    const key = input.dataset.personField;
    const previous = person[key];
    person[key] = input.value;
    if (key === 'letterType') {
      if (input.value === 'course') person.match = 'none';
      else if (previous === 'course') person.match = '';
      const match = document.getElementById('person-match');
      if (match) { match.disabled = input.value === 'course'; match.value = person.match; }
    }
    persist();
    updateProgress();
  });
  document.addEventListener('submit', event => event.preventDefault());
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const bounds = modal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) modal.close();
  });
  persist();
  shell();
})();
