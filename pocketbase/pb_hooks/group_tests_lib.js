// Проекция назначенных тестов для кабинета: только название, срок и СОБСТВЕННЫЙ
// статус ученика. Ни варианты/ответы теста, ни попытки одноклассников не выходят.
function all(app, collection, filter, params) {
  const out = [];
  for (let offset = 0; ; offset += 500) {
    const page = app.findRecordsByFilter(collection, filter, 'id', 500, offset, params);
    for (const r of page) out.push(r);
    if (page.length < 500) return out;
  }
}

function assignedTests(app, groupIds, studentId) {
  // Фронтенд/хук можно выложить раньше аддитивной миграции.
  if (!app.findCollectionByNameOrId('work_sessions').fields.getByName('groups')) return [];
  const ids = groupIds.filter((id) => {
    try {
      const g = app.findRecordById('teaching_groups', id);
      return !(g.getString('kind') === 'course' && (g.getBool('completed') || g.getBool('archived')));
    } catch { return false; }
  });
  if (!ids.length) return [];
  const params = { s: studentId };
  const any = (prefix) => ids.map((id, i) => {
    params['g' + i] = id;
    return prefix + 'groups.id ?= {:g' + i + '}';
  }).join(' || ');
  const sessions = all(app, 'work_sessions', 'is_open = true && (' + any('') + ')', params);
  if (!sessions.length) return [];
  const states = {};
  const attempts = all(app, 'attempts', 'student = {:s} && session.is_open = true && (' + any('session.') + ')', params);
  for (const a of attempts) {
    const id = a.getString('session');
    const status = a.getString('status');
    if (status === 'submitted' || status === 'corrected') states[id] = 'submitted';
    else if (status === 'started' && !states[id]) states[id] = 'started';
  }
  const generic = /^(самостоятельная работа|самостоятельная|работа|тест|тест с выбором ответа|контрольная работа|проверочная работа)$/;
  return sessions.map((s) => {
    let title = s.getString('student_title').trim();
    if (!title || generic.test(title.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' '))) {
      for (const pair of [['work', 'works'], ['mc_test', 'mc_tests'], ['trig_mc_test', 'trig_mc_tests']]) {
        const id = s.getString(pair[0]);
        if (!id) continue;
        try {
          const named = app.findRecordById(pair[1], id).getString('title').trim();
          if (named) { title = named; break; }
        } catch { /* удалённая работа — остаётся заголовок выдачи */ }
      }
    }
    return { id: s.id, title: title || 'Тест', deadline: s.getString('deadline'), status: states[s.id] || 'untouched' };
  });
}

module.exports = { assignedTests };
