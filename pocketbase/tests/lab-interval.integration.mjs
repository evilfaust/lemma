// Только синтетическая БД во временном каталоге. Никаких обращений к VPS.
// POCKETBASE_BIN=/path/to/pocketbase node pocketbase/tests/lab-interval.integration.mjs
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

const binary = process.env.POCKETBASE_BIN;
if (!binary) throw new Error('Укажи POCKETBASE_BIN. Скрипт создаёт только временную синтетическую БД.');
const root = fileURLToPath(new URL('..', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'lemma-interval-check-'));
const migrations = join(dir, 'migrations'), hooks = join(dir, 'hooks');
await mkdir(migrations); await mkdir(hooks);
await copyFile(join(root, 'pb_migrations/1789900000_lab_interval_experiment.js'), join(migrations, '1789900000_lab_interval_experiment.js'));
for (const name of ['lab_interval.pb.js', 'lab_interval_lib.js']) await copyFile(join(root, 'pb_hooks', name), join(hooks, name));
await writeFile(join(migrations, '1700000000_fixture.js'), `
migrate(app => {
  const dates = () => [{ name: 'created', type: 'autodate', onCreate: true }, { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }];
  const rel = (name, col, max = 1) => ({ name, type: 'relation', collectionId: app.findCollectionByNameOrId(col).id, maxSelect: max });
  const col = (name, type, fields) => { const c = new Collection({ name, type, fields: fields.concat(dates()) }); app.save(c); return c; };
  col('teachers', 'auth', [{ name: 'role', type: 'text' }, { name: 'name', type: 'text' }, { name: 'allowed_sections', type: 'json' }]);
  col('teaching_groups', 'base', [{ name: 'name', type: 'text' }, { name: 'kind', type: 'text' }, rel('owner', 'teachers'), rel('co_teachers', 'teachers', 50)]);
  col('students', 'auth', [{ name: 'name', type: 'text' }, rel('teaching_group', 'teaching_groups')]);
  col('group_memberships', 'base', [rel('student', 'students'), rel('group', 'teaching_groups'), { name: 'status', type: 'text' }]);
  col('audit_log', 'base', ['teacher_id','teacher_name','action','collection_name','record_id','record_summary'].map(name => ({ name, type: 'text' })));
  function seed(name, id, values, password) { const r = new Record(app.findCollectionByNameOrId(name)); r.set('id', id); Object.keys(values).forEach(k => r.set(k, values[k])); if (password) r.setPassword(password); app.save(r); }
  const pw = 'Experiment-Test-2026';
  [['t11111111111111','editor',['lab']],['t22222222222222','editor',['lab']],['t33333333333333','viewer',['lab']],['t44444444444444','editor',[]]].forEach((t,i) => seed('teachers',t[0],{email:'teacher'+(i+1)+'@lab.invalid',name:'Учитель '+i,role:t[1],allowed_sections:t[2]},pw));
  seed('teaching_groups','g11111111111111',{name:'Тестовая группа',owner:'t11111111111111'});
  seed('teaching_groups','g22222222222222',{name:'Другая группа',owner:'t22222222222222'});
  seed('students','s11111111111111',{email:'student1@lab.invalid',name:'Ученик 1',teaching_group:'g11111111111111'},pw);
  seed('students','s22222222222222',{email:'student2@lab.invalid',name:'Ученик 2',teaching_group:'g22222222222222'},pw);
});
`);
const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(r => probe.close(r));
const base = `http://127.0.0.1:${port}`;
let logs = '', server;
let checks = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
async function request(path, token, method = 'GET', body, expected = 200) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  eq(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
const api = '/api/lab-interval';
const tasks = [1,2,3].map(i => ({ key: 'q'+i, skill: 'product', expression: '(x+1)(x-2)>0', roots: [-1,2], answerLatex: '(-\\infty;-1)\\cup(2;+\\infty)', expected: { changes: [true,true], points: [false,false], signs: [1,-1,1], answer: { gaps:[true,false,true], points:[false,false] } } }));
try {
  server = spawn(resolve(binary), ['serve', '--http', `127.0.0.1:${port}`, '--dir', join(dir, 'data'), '--migrationsDir', migrations, '--hooksDir', hooks], { stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', b => { logs += b; }); server.stderr.on('data', b => { logs += b; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch { /* Запуск изолированного процесса. */ }
    await new Promise(r => setTimeout(r, 100));
  }
  assert(ready, logs);
  const login = async (col, who) => (await request(`/api/collections/${col}/auth-with-password`, null, 'POST', { identity: `${who}@lab.invalid`, password: 'Experiment-Test-2026' })).token;
  const t1 = await login('teachers','teacher1'), t2 = await login('teachers','teacher2');
  const viewer = await login('teachers','teacher3'), limited = await login('teachers','teacher4');
  const s1 = await login('students','student1'), s2 = await login('students','student2');
  const body = { title:'Пилот', group:'g11111111111111', participants:['s11111111111111'], tasks, hints:true };
  await request(api+'/teacher', null, 'GET', undefined, 401);
  await request(api+'/teacher', limited, 'GET', undefined, 403);
  await request(api+'/teacher', viewer, 'POST', body, 403);
  await request(api+'/teacher', t2, 'POST', body, 403);
  await request(api+'/teacher', t1, 'POST', { ...body, participants:['s22222222222222'] }, 400);
  const { id } = await request(api+'/teacher', t1, 'POST', body);
  eq((await request(api+'/teacher', t1)).works.length, 1);
  eq((await request(api+'/teacher', t2)).works.length, 0);
  await request(api+`/teacher/${id}`, t2, 'GET', undefined, 404);
  await request(api+`/teacher/${id}/status`, viewer, 'POST', {isOpen:false}, 404);
  eq((await request(api+'/my', s2)).works, []);
  eq((await request(api+'/my', s1)).works[0].status, 'untouched');
  await request(api+`/student/${id}?version=2`, s2, 'GET', undefined, 404);
  await request(api+`/student/${id}/start?version=2`, s2, 'POST', {}, 404);
  for (const col of ['lab_interval_works','lab_interval_attempts']) {
    await request(`/api/collections/${col}/records`, s1, 'GET', undefined, 403);
    await request(`/api/collections/${col}/records`, s1, 'POST', {}, 403);
  }
  await request(api+`/student/${id}`, s1, 'GET', undefined, 409);
  await request(api+`/student/${id}/start`, s1, 'POST', {}, 409);
  let view = await request(api+`/student/${id}/start?version=2`, s1, 'POST', {});
  const aid = view.attempt.id;
  eq((await request(api+`/student/${id}/start?version=2`, s1, 'POST', {})).attempt.id, aid);
  eq(view.current.roots, undefined);
  eq(JSON.stringify(view).includes('expected'), false);
  await request(`/api/collections/lab_interval_works/records/${id}`, s1, 'GET', undefined, 403);
  await request(`/api/collections/lab_interval_attempts/records/${aid}`, s1, 'PATCH', { status:'completed' }, 403);
  const send = async (kind, value) => { view = await request(api+`/student/${id}/action`, s1, 'POST', { version:2, revision:view.attempt.state.revision, kind, value }); return view; };
  await send('check', '999'); eq(view.attempt.state.taskIndex, 0); eq(view.attempt.state.stepIndex, 0);
  const duplicate = () => fetch(base + api + `/student/${id}/action`, { method:'POST', headers:{Authorization:s1,'Content-Type':'application/json'}, body:JSON.stringify({version:2,revision:1,kind:'hint'}) });
  const parallel = await Promise.all([duplicate(), duplicate()]);
  eq(parallel.map(r => r.status).sort(), [200,409], 'Две одновременные отправки одной ревизии');
  view = await request(api+`/student/${id}?version=2`, s1);
  await request(api+`/student/${id}/action`, s1, 'POST', { version:2, revision:0, kind:'skip' }, 409);
  eq((await request(api+`/student/${id}?version=2`, s1)).attempt.state.revision, 2);
  await send('hint');
  await request(api+`/student/${id}/action`, s1, 'POST', { revision:view.attempt.state.revision,kind:'skip' }, 409);
  await send('check', '2;-1'); eq(view.attempt.state.stepIndex, 1);
  await send('check', [2,-1]); eq(view.attempt.state.stepIndex, 1);
  await send('check', [-1,2]); eq(view.current.roots, [-1,2]);
  for (const step of ['changes','points','signs','answer']) await send('check', tasks[0].expected[step]);
  eq(view.attempt.status, 'started');
  await send('check', '(-∞;-1) ∪ (2;+∞)');
  eq(view.attempt.summary.helped, 1);
  await request(api+`/teacher/${id}/status`, t1, 'POST', {isOpen:false});
  await request(api+`/student/${id}/action`, s1, 'POST', {version:2,revision:view.attempt.state.revision,kind:'skip'}, 403);
  eq((await request(api+`/student/${id}?version=2`, s1)).work.isOpen, false);
  await request(api+`/teacher/${id}/status`, t1, 'POST', {isOpen:true});
  await send('skip');
  await send('check', '-1; 2');
  await send('check', [-1,2]);
  for (const step of ['changes','points','signs','answer']) await send('check', tasks[2].expected[step]);
  await send('check', '(-∞;-1) ∪ (2;+∞)');
  eq(view.attempt.status, 'completed'); eq(view.current, null);
  eq(view.attempt.summary.independent, 1); eq(view.attempt.summary.skipped, 1);
  await request(api+`/student/${id}/action`, s1, 'POST', {version:2,revision:view.attempt.state.revision,kind:'skip'}, 409);
  const result = await request(api+`/teacher/${id}`, t1);
  eq(result.attempts.length, 1); eq(result.attempts[0].summary.errors, 2); eq(result.work.tasks[0].answerLatex, tasks[0].answerLatex);
  const noHints = await request(api+'/teacher', t1, 'POST', {...body, hints:false});
  await request(api+`/student/${noHints.id}/start?version=2`, s1, 'POST', {});
  await request(api+`/student/${noHints.id}/action`, s1, 'POST', {version:2,revision:0,kind:'hint'}, 403);
  console.log(`PocketBase: ${checks} проверок пройдено; миграция, права, изоляция группы, шаги, ревизии, отчёт и закрытие работы.`);
} catch (e) {
  console.error(logs.replace(/http:\/\/[^\s]*pbinstal\/[^\s]*/g, '[synthetic setup URL]').slice(-5000)); throw e;
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(dir, { recursive:true, force:true });
}
