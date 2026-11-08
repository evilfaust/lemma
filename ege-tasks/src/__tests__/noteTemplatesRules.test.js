// @vitest-environment node
// Проверка настоящих правил PocketBase на синтетической БД в temp, без доступа
// к боевому серверу. Для запуска нужен локальный pocketbase 0.36.x в PATH.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let available = false;
try { available = /0\.36\./.test(execFileSync('pocketbase', ['--version'], { encoding: 'utf8' })); } catch { /* optional integration dependency */ }

describe.skipIf(!available)('личные шаблоны: настоящие правила PocketBase', () => {
  let directory;
  let process;
  let base;
  let logs = '';
  const teachers = {};
  let template;
  async function request(path, method = 'GET', data, token) {
    const response = await fetch(`${base}/api/${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lemma-note-templates-'));
    const migrations = join(directory, 'migrations');
    await mkdir(migrations);
    await mkdir(join(directory, 'hooks'));
    await writeFile(join(migrations, '1700000000_fixture.js'), `
migrate((app) => {
  const teachers = new Collection({ name: 'teachers', type: 'auth', fields: [
    { name: 'role', type: 'select', values: ['editor', 'viewer', 'superadmin'], maxSelect: 1 }
  ] });
  app.save(teachers);
  for (const name of ['first', 'second', 'viewer', 'superadmin']) {
    const r = new Record(teachers);
    r.set('email', name + '@example.test');
    r.set('password', 'Test-only-pass-123');
    r.set('role', name === 'viewer' || name === 'superadmin' ? name : 'editor');
    app.save(r);
  }
}, () => {});
`);
    await copyFile(new URL('../../../pocketbase/pb_migrations/1789700000_note_templates.js', import.meta.url), join(migrations, '1789700000_note_templates.js'));
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    base = `http://127.0.0.1:${port}`;
    process = spawn('pocketbase', ['serve', `--http=127.0.0.1:${port}`, `--dir=${join(directory, 'data')}`,
      `--migrationsDir=${migrations}`, `--hooksDir=${join(directory, 'hooks')}`, `--publicDir=${join(directory, 'public')}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.on('data', (chunk) => { logs += chunk; });
    process.stderr.on('data', (chunk) => { logs += chunk; });
    let ready = false;
    for (let i = 0; i < 80; i += 1) {
      try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!ready) throw new Error(`PocketBase fixture did not start: ${logs}`);
    for (const name of ['first', 'second', 'viewer', 'superadmin']) {
      const result = await request('collections/teachers/auth-with-password', 'POST', { identity: `${name}@example.test`, password: 'Test-only-pass-123' });
      expect(result.status).toBe(200);
      teachers[name] = { id: result.body.record.id, token: result.body.token };
    }
  }, 15000);

  afterAll(async () => {
    if (process && process.exitCode === null) {
      await new Promise((resolve) => { process.once('exit', resolve); process.kill('SIGTERM'); });
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('редактор создаёт личный шаблон и читает его по сортировке updated', async () => {
    const result = await request('collections/teacher_note_templates/records', 'POST', {
      owner: teachers.first.id, title: 'Личный конспект', type: 'lesson', body: [{ type: 'paragraph', content: 'Текст' }],
    }, teachers.first.token);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    template = result.body;
    const list = await request('collections/teacher_note_templates/records?sort=-updated', 'GET', null, teachers.first.token);
    expect(list.status).toBe(200);
    expect(list.body.items.map((r) => r.id)).toEqual([template.id]);
  });

  it('чужой учитель, superadmin и аноним не читают личный шаблон', async () => {
    for (const token of [teachers.second.token, teachers.superadmin.token, undefined]) {
      const list = await request('collections/teacher_note_templates/records', 'GET', null, token);
      expect(list.body.items).toEqual([]);
      const one = await request(`collections/teacher_note_templates/records/${template.id}`, 'GET', null, token);
      expect(one.status).toBe(404);
    }
  });

  it('viewer не создаёт шаблон, редактор не создаёт его от чужого имени', async () => {
    const data = { title: 'Шаблон', body: [{ type: 'paragraph' }] };
    for (const [token, owner] of [[teachers.viewer.token, teachers.viewer.id], [teachers.first.token, teachers.second.id], [undefined, teachers.first.id]]) {
      const result = await request('collections/teacher_note_templates/records', 'POST', { ...data, owner }, token);
      expect(result.status).toBe(400);
    }
  });

  it('нельзя менять владельца или редактировать/удалять чужой шаблон', async () => {
    const path = `collections/teacher_note_templates/records/${template.id}`;
    expect((await request(path, 'PATCH', { owner: teachers.second.id }, teachers.first.token)).status).toBe(404);
    expect((await request(path, 'PATCH', { title: 'Чужая правка' }, teachers.second.token)).status).toBe(404);
    expect((await request(path, 'DELETE', null, teachers.second.token)).status).toBe(404);
  });

  it('владелец может править и удалять свой шаблон', async () => {
    const path = `collections/teacher_note_templates/records/${template.id}`;
    expect((await request(path, 'PATCH', { title: 'Правка' }, teachers.first.token)).status).toBe(200);
    expect((await request(path, 'DELETE', null, teachers.first.token)).status).toBe(204);
  });
});
