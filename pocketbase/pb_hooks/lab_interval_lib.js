// CommonJS: исполняется и PocketBase/Goja, и изолированными Node-тестами.
const STEPS = ['roots', 'order', 'changes', 'points', 'signs', 'answer', 'notation'];
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
function json(record, key) {
  // JSONRaw через get() в Goja выглядит как массив байтов. getString()
  // возвращает исходный JSON; разбор одновременно отделяет mutable state.
  return JSON.parse(record.getString(key) || 'null');
}
function all(app, collection, filter, params) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = app.findRecordsByFilter(collection, filter, 'created,id', 500, offset, params || {});
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
function teacher(auth) {
  if (!auth || auth.collection().name !== 'teachers') fail(401, 'Нужен вход учителя');
  const sections = json(auth, 'allowed_sections') || [];
  if (auth.getString('role') !== 'superadmin' && (!Array.isArray(sections) || sections.indexOf('lab') < 0)) fail(403, 'Нет доступа к лаборатории');
  return auth;
}
function editor(auth) {
  teacher(auth);
  if (auth.getString('role') === 'viewer') fail(403, 'Недостаточно прав для изменения');
}
function owned(auth, work) {
  teacher(auth);
  if (auth.getString('role') !== 'superadmin' && work.getString('owner') !== auth.id) fail(404, 'Работа не найдена');
}
function assigned(auth, work) {
  if (!auth || auth.collection().name !== 'students') fail(401, 'Нужен вход ученика');
  if (work.getStringSlice('participants').indexOf(auth.id) < 0) fail(404, 'Тренировка не назначена');
}
function workById(app, id) {
  try { return app.findRecordById('lab_interval_works', id); }
  catch (_) { fail(404, 'Тренировка не найдена'); }
}
function getAttempt(app, workId, studentId) {
  return app.findRecordsByFilter('lab_interval_attempts', 'work = {:w} && student = {:s}', '', 1, 0, { w: workId, s: studentId })[0] || null;
}
function freshState() { return { version: 2, revision: 0, taskIndex: 0, stepIndex: 0, answers: {}, startedAt: new Date().toISOString() }; }
function arrayEqual(a, b) { return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]); }
function parseRoots(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  const chunks = value.replace(/−/g, '-').trim().split(/[;\s]+/).filter(Boolean);
  if (!chunks.length || chunks.length > 10) return null;
  const out = chunks.map((s) => {
    if (!/^[+-]?\d+(?:[.,]\d+)?(?:\/[+-]?\d+)?$/.test(s)) return NaN;
    const f = s.replace(',', '.').split('/');
    return Number(f[0]) / (f.length === 2 ? Number(f[1]) : 1);
  });
  return out.every(Number.isFinite) ? out : null;
}
function checkNotation(task, value) {
  const source = value.replace(/[−–]/g, '-').replace(/\s+/g, '').toLowerCase()
    .replace(/(?:infinity|inf|беск\.?)/g, '∞');
  const parts = [];
  if (/^(?:∅|\{\}|пусто|нетрешений)$/.test(source)) {
    // Пустое множество представлено пустым списком частей.
  } else if (/^(?:ℝ|r|всечисла)$/.test(source)) {
    parts.push({ lo: -Infinity, hi: Infinity, left: false, right: false });
  } else {
    const readBound = (v) => /^[+-]?\d{1,9}$/.test(v) ? Number(v)
      : v === '-∞' ? -Infinity : v === '∞' || v === '+∞' ? Infinity : NaN;
    for (const part of source.split(/∪|u|или/)) {
      const point = part.match(/^\{([+-]?\d{1,9}(?:[;,][+-]?\d{1,9})*)\}$/);
      if (point) {
        for (const token of point[1].split(/[;,]/)) {
          const x = Number(token);
          parts.push({ lo: x, hi: x, left: true, right: true });
        }
        continue;
      }
      if (!['(', '['].includes(part[0]) || ![')', ']'].includes(part.slice(-1))) return false;
      const bounds = part.slice(1, -1).split(/[;,]/);
      if (bounds.length !== 2) return false;
      const [lo, hi] = bounds.map(readBound);
      const left = part[0] === '[', right = part.slice(-1) === ']';
      if (!(lo < hi || (lo === hi && Number.isFinite(lo) && left && right))) return false;
      if ((!Number.isFinite(lo) && left) || (!Number.isFinite(hi) && right)) return false;
      parts.push({ lo, hi, left, right });
    }
  }
  const cuts = [...new Set(task.roots.concat(parts.flatMap(p => [p.lo, p.hi]).filter(Number.isFinite)))].sort((a, b) => a - b);
  const contains = (x) => parts.some(p => (x > p.lo || (p.left && x === p.lo)) && (x < p.hi || (p.right && x === p.hi)));
  const { gaps, points } = task.expected.answer;
  const expected = (x) => {
    const i = task.roots.findIndex(r => r >= x);
    return i < 0 ? gaps[task.roots.length] : task.roots[i] === x ? points[i] : gaps[i];
  };
  const probes = [cuts[0] - 1, ...cuts, cuts[cuts.length - 1] + 1];
  for (let i = 1; i < cuts.length; i++) probes.push((cuts[i - 1] + cuts[i]) / 2);
  return probes.every(x => contains(x) === expected(x));
}
function stepSolution(task, step) {
  if (step === 'roots') return task.roots.join('; ');
  if (step === 'order') return task.roots;
  if (step === 'notation') return task.answerLatex;
  return task.expected[step];
}
function check(task, step, value) {
  if (step === 'roots') return arrayEqual(parseRoots(value)?.sort((a, b) => a - b), task.roots);
  if (step === 'order') return arrayEqual(value, task.roots);
  if (step === 'notation') return typeof value === 'string' && checkNotation(task, value);
  if (step === 'answer') return !!value && arrayEqual(value.gaps, task.expected.answer.gaps) && arrayEqual(value.points, task.expected.answer.points);
  return arrayEqual(value, task.expected[step]);
}
function feedbackFor(task, step, value) {
  if (step === 'roots') {
    const roots = parseRoots(value);
    if (roots && new Set(roots).size !== roots.length) return 'Запиши каждую точку один раз, даже если она повторяется в множителях.';
    return 'Приравняй каждый множитель к нулю. У дроби проверь и числитель, и знаменатель.';
  }
  if (step === 'order') {
    const i = value.findIndex((x, j) => j > 0 && value[j - 1] > x);
    return i < 0 ? 'Расставь все найденные точки.' : `Сравни ${value[i - 1]} и ${value[i]}. Меньшее число должно быть левее.`;
  }
  if (step === 'notation') return 'Сверь запись со штриховкой. Закрашенной границе соответствует квадратная скобка, выколотой — круглая. У бесконечности скобка всегда круглая.';
  const expected = task.expected[step];
  const index = step === 'answer' ? expected.gaps.findIndex((v, i) => v !== value.gaps[i]) : expected.findIndex((v, i) => v !== value[i]);
  if (step === 'changes') return `Проверь кратность в точке ${task.roots[index]}. Знак ! ставят только при чётной кратности.`;
  if (step === 'points') return `Проверь точку ${task.roots[index]}. Нуль знаменателя всегда выколот. Нуль числителя закрашивают при нестрогом знаке.`;
  const interval = `(${task.roots[index - 1] ?? '−∞'}; ${task.roots[index] ?? '+∞'})`;
  if (step === 'signs') return `Проверь знак на промежутке ${interval}. Возьми число внутри и подставь его в выражение.`;
  return `Сверь штриховку на промежутке ${interval} со знаком неравенства.`;
}
function currentStep(task, state) {
  return STEPS.findIndex(step => !state.answers[task.key + '.' + step]?.correct);
}
function upgradeState(tasks, state) {
  if (state.version === 2) return state;
  const task = tasks[state.taskIndex];
  // Проверенные действия и история остаются на месте. В текущем примере
  // возвращаемся к первому действию, которого не было в старой схеме.
  return { ...state, version: 2, stepIndex: task ? currentStep(task, state) : 0 };
}
function rootChoices(task) {
  const values = task.roots.slice();
  let seed = 0;
  for (let i = 0; i < task.expression.length; i++) seed = (Math.imul(seed, 31) + task.expression.charCodeAt(i)) >>> 0;
  for (let i = values.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length < 3 || tasks.length > 20) fail(400, 'Нужно от 3 до 20 заданий');
  const keys = {};
  for (const t of tasks) {
    if (!t || !/^q\d{1,2}$/.test(t.key) || keys[t.key]) fail(400, 'Некорректные ключи заданий');
    keys[t.key] = true;
    if (['product', 'fraction', 'multiplicity'].indexOf(t.skill) < 0 || typeof t.expression !== 'string' || !t.expression || t.expression.length > 2000 || typeof t.answerLatex !== 'string' || t.answerLatex.length > 2000) fail(400, 'Некорректное задание');
    if (!Array.isArray(t.roots) || t.roots.length < 1 || t.roots.length > 6 || !t.roots.every((r, i) => Number.isInteger(r) && Math.abs(r) <= 100 && (!i || r > t.roots[i - 1]))) fail(400, 'Некорректные критические точки');
    const n = t.roots.length, e = t.expected;
    const bools = (a, len) => Array.isArray(a) && a.length === len && a.every(v => typeof v === 'boolean');
    if (!e || !bools(e.changes, n) || !bools(e.points, n) || !Array.isArray(e.signs) || e.signs.length !== n + 1 || !e.signs.every(v => v === 1 || v === -1) || !e.answer || !bools(e.answer.gaps, n + 1) || !bools(e.answer.points, n) || !arrayEqual(e.points, e.answer.points)) fail(400, 'Некорректные шаги решения');
  }
}
function summary(tasks, state) {
  const stats = { total: tasks.length, solved: 0, independent: 0, corrected: 0, helped: 0, skipped: 0, errors: 0, hints: 0, steps: {} };
  for (const step of STEPS) stats.steps[step] = { checks: 0, errors: 0, hints: 0, shown: 0 };
  for (const [index, task] of tasks.entries()) {
    const rows = STEPS.map(step => state.answers[task.key + '.' + step]);
    let errors = 0, hints = 0, shown = 0;
    STEPS.forEach((step, i) => {
      const row = rows[i];
      if (!row) return;
      stats.steps[step].checks += row.checks || 0;
      stats.steps[step].errors += row.errors || 0;
      stats.steps[step].hints += row.hinted ? 1 : 0;
      stats.steps[step].shown += row.revealed ? 1 : 0;
      errors += row.errors || 0;
      hints += row.hinted ? 1 : 0;
      shown += row.revealed ? 1 : 0;
    });
    stats.errors += errors; stats.hints += hints;
    if (rows.some(r => r && r.skipped)) stats.skipped++;
    else if (index < state.taskIndex && rows.some(r => r?.correct)) {
      stats.solved++;
      if (hints || shown) stats.helped++;
      else if (errors) stats.corrected++;
      else stats.independent++;
    }
  }
  return stats;
}
function workMeta(work) { return { id: work.id, title: work.getString('title'), isOpen: work.getBool('is_open'), count: json(work, 'tasks').length }; }
function studentView(work, attempt) {
  const tasks = json(work, 'tasks');
  const state = attempt ? upgradeState(tasks, json(attempt, 'state')) : null;
  const task = state && tasks[state.taskIndex];
  const current = task ? { key: task.key, expression: task.expression, skill: task.skill, rootCount: task.roots.length } : null;
  if (current && STEPS[state.stepIndex] === 'order') current.rootChoices = rootChoices(task);
  if (current && state.stepIndex > 1) current.roots = task.roots;
  return {
    work: workMeta(work),
    hintsAllowed: (json(work, 'settings') || {}).hints !== false,
    attempt: attempt ? { id: attempt.id, status: attempt.getString('status'), state, summary: summary(tasks, state) } : null,
    current,
  };
}
function audit(app, auth, work, action, text) {
  const row = new Record(app.findCollectionByNameOrId('audit_log'));
  row.set('teacher_id', auth.id); row.set('teacher_name', auth.getString('name') || auth.getString('username'));
  row.set('action', action); row.set('collection_name', 'lab_interval_works');
  row.set('record_id', work.id); row.set('record_summary', text.slice(0, 500)); app.save(row);
}
function createWork(app, auth, body) {
  editor(auth);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 200) fail(400, 'Укажи название до 200 символов');
  validateTasks(body.tasks);
  let group;
  try { group = app.findRecordById('teaching_groups', String(body.group || '')); }
  catch (_) { fail(400, 'Выбери тестовую группу'); }
  if (group.getString('kind') === 'course') fail(400, 'Для эксперимента выбери обычную учебную группу');
  if (auth.getString('role') !== 'superadmin' && group.getString('owner') !== auth.id && group.getStringSlice('co_teachers').indexOf(auth.id) < 0) fail(403, 'Нет доступа к группе');
  const ids = body.participants;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => typeof id !== 'string' || !/^[a-z0-9]{15}$/.test(id)) || new Set(ids).size !== ids.length) fail(400, 'Некорректный состав группы');
  // Клиент использует штатный getStudentsByGroup (правила исторического состава).
  // Сервер дополнительно проверяет принадлежность каждого адресата выбранной группе.
  const members = all(app, 'group_memberships', 'group = {:g}', { g: group.id });
  const memberIds = members.map(m => m.getString('student'));
  const roster = ids.map(id => {
    let s;
    try { s = app.findRecordById('students', id); } catch (_) { fail(400, 'Ученик не найден'); }
    if (memberIds.indexOf(id) < 0 && s.getString('teaching_group') !== group.id) fail(400, 'Состав группы изменился. Обнови список');
    return { id, name: s.getString('name') || s.getString('username') };
  });
  const work = new Record(app.findCollectionByNameOrId('lab_interval_works'));
  work.set('owner', auth.id); work.set('group', group.id); work.set('participants', ids);
  work.set('roster', roster); work.set('title', title); work.set('tasks', body.tasks);
  work.set('settings', { version: 2, hints: body.hints !== false, groupName: group.getString('name') });
  work.set('is_open', true); app.save(work);
  audit(app, auth, work, 'create', 'Эксперимент: ' + title + ', учеников: ' + ids.length);
  return { id: work.id };
}
function applyAction(tasks, state, body, hintsAllowed) {
  state = upgradeState(tasks, state);
  if (body.revision !== state.revision) fail(409, 'Попытка уже изменилась на другом устройстве. Загрузи сохранённое состояние');
  const task = tasks[state.taskIndex];
  if (!task) fail(409, 'Тренировка уже завершена');
  const step = STEPS[state.stepIndex], key = task.key + '.' + step;
  const row = state.answers[key] || { checks: 0, errors: 0, hinted: false, correct: false };
  if (row.revealed && !row.correct && body.kind !== 'continue' && body.kind !== 'skip') {
    fail(409, 'Сначала закончи разбор шага');
  }
  if (body.kind === 'reveal') {
    if (!hintsAllowed || row.errors < 3) fail(403, 'Показ шага пока недоступен');
    row.revealed = true;
    row.value = stepSolution(task, step);
    state.answers[key] = row;
  } else if (body.kind === 'continue') {
    if (!row.revealed) fail(400, 'Этот шаг ещё не разобран');
    row.correct = true;
  } else if (body.kind === 'hint') {
    if (!hintsAllowed) fail(403, 'Подсказки отключены учителем');
    row.hinted = true; row.hintedAt = row.hintedAt || new Date().toISOString(); state.answers[key] = row;
  } else if (body.kind === 'skip') {
    for (let i = state.stepIndex; i < STEPS.length; i++) {
      const k = task.key + '.' + STEPS[i];
      state.answers[k] = Object.assign({}, state.answers[k] || {}, { skipped: true, correct: false });
    }
    state.taskIndex++; state.stepIndex = 0;
  } else if (body.kind === 'check') {
    const n = task.roots.length, value = body.value;
    const bools = (v, len) => Array.isArray(v) && v.length === len && v.every(x => x === true || x === false || x === null);
    const valid = step === 'roots' || step === 'notation' ? typeof value === 'string' && value.length <= 300
      : step === 'order' ? Array.isArray(value) && value.length <= n && value.every(v => task.roots.includes(v))
      : step === 'answer' ? value && bools(value.gaps, n + 1) && arrayEqual(value.points, task.expected.points)
      : step === 'signs' ? Array.isArray(value) && value.length === n + 1 && value.every(x => x === 1 || x === -1 || x === null)
      : bools(value, n);
    if (!valid) fail(400, 'Некорректный формат ответа');
    const correct = check(task, step, value);
    row.value = step === 'answer' ? { gaps: value.gaps, points: value.points } : value;
    row.feedback = correct ? '' : feedbackFor(task, step, value);
    row.checks++; row.correct = correct;
    if (!correct) row.errors++;
    row.checkedAt = new Date().toISOString(); state.answers[key] = row;
    row.history = (row.history || []).concat([{ value: row.value, correct, at: row.checkedAt }]).slice(-10);
  } else fail(400, 'Неизвестное действие');
  if (row.correct && (body.kind === 'check' || body.kind === 'continue')) {
    const next = currentStep(task, state);
    if (next === -1) { state.taskIndex++; state.stepIndex = 0; }
    else state.stepIndex = next;
  }
  state.revision++;
  if (state.taskIndex === tasks.length) state.completedAt = new Date().toISOString();
  return state;
}
function route(app, c, action) {
  try {
    const info = c.requestInfo(), auth = info.auth, body = info.body || {};
    const id = c.request.pathValue('id');
    if (action === 'teacherList') {
      teacher(auth);
      const works = all(app, 'lab_interval_works', auth.getString('role') === 'superadmin' ? 'id != ""' : 'owner = {:o}', { o: auth.id });
      return c.json(200, { works: works.reverse().map(w => Object.assign(workMeta(w), { groupName: (json(w, 'settings') || {}).groupName, participants: w.getStringSlice('participants').length, created: w.getString('created') })) });
    }
    if (action === 'create') {
      let result;
      app.runInTransaction(tx => { result = createWork(tx, auth, body); });
      return c.json(200, result);
    }
    if (action === 'my') {
      if (!auth || auth.collection().name !== 'students') fail(401, 'Нужен вход ученика');
      const works = all(app, 'lab_interval_works', 'participants.id ?= {:s}', { s: auth.id });
      const attempts = all(app, 'lab_interval_attempts', 'student = {:s}', { s: auth.id });
      return c.json(200, { works: works.reverse().map(w => {
        const a = attempts.find(r => r.getString('work') === w.id);
        return Object.assign(workMeta(w), { status: a ? a.getString('status') : 'untouched', done: a ? json(a, 'state').taskIndex : 0 });
      }) });
    }
    if (action === 'teacherDetail') {
      const work = workById(app, id); owned(auth, work);
      const tasks = json(work, 'tasks');
      const attempts = all(app, 'lab_interval_attempts', 'work = {:w}', { w: id });
      return c.json(200, { work: Object.assign(workMeta(work), { tasks, roster: json(work, 'roster'), settings: json(work, 'settings') }), attempts: attempts.map(a => ({ id: a.id, student: a.getString('student'), status: a.getString('status'), state: json(a, 'state'), summary: summary(tasks, json(a, 'state')) })) });
    }
    if (action === 'status') {
      let result;
      app.runInTransaction(tx => {
        const work = workById(tx, id); owned(auth, work); editor(auth);
        if (typeof body.isOpen !== 'boolean') fail(400, 'Не указан статус');
        work.set('is_open', body.isOpen); tx.save(work);
        audit(tx, auth, work, 'update', (body.isOpen ? 'Открыта: ' : 'Закрыта: ') + work.getString('title'));
        result = workMeta(work);
      });
      return c.json(200, result);
    }
    if (action === 'view') {
      const work = workById(app, id); assigned(auth, work);
      if (info.query.version !== '2') fail(409, 'Тренажёр обновился. Перезагрузи страницу');
      return c.json(200, studentView(work, getAttempt(app, id, auth.id)));
    }
    if (action === 'start' || action === 'action') {
      let result;
      app.runInTransaction(tx => {
        const work = workById(tx, id); assigned(auth, work);
        if (action === 'start' && info.query.version !== '2') fail(409, 'Тренажёр обновился. Перезагрузи страницу');
        if (!work.getBool('is_open')) fail(403, 'Учитель закрыл тренировку');
        let attempt = getAttempt(tx, id, auth.id);
        if (action === 'start' && !attempt) {
          attempt = new Record(tx.findCollectionByNameOrId('lab_interval_attempts'));
          attempt.set('work', id); attempt.set('student', auth.id);
          attempt.set('state', freshState()); attempt.set('status', 'started'); tx.save(attempt);
        } else if (action === 'action') {
          if (!attempt) fail(409, 'Сначала начни тренировку');
          if (attempt.getString('status') === 'completed') fail(409, 'Тренировка уже завершена');
          if (body.version !== 2) fail(409, 'Тренажёр обновился. Перезагрузи страницу');
          const state = applyAction(json(work, 'tasks'), json(attempt, 'state'), body, (json(work, 'settings') || {}).hints !== false);
          attempt.set('state', state);
          if (state.completedAt) attempt.set('status', 'completed');
          tx.save(attempt);
        }
        result = studentView(work, attempt);
      });
      return c.json(200, result);
    }
    fail(404, 'Маршрут не найден');
  } catch (err) {
    if (!err.status) console.error('[lab-interval] ' + String(err));
    return c.json(err.status || 500, { error: err.status ? err.message : 'Не удалось выполнить действие. Попробуй ещё раз' });
  }
}
module.exports = { STEPS, parseRoots, check, validateTasks, summary, freshState, applyAction, studentView, teacher, assigned, owned, createWork, route };
