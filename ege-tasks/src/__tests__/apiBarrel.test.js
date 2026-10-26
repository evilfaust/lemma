import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { api } from '../shared/services/pocketbase';

// Сторож barrel-а API: `api` = spread доменных объектов, и одноимённый метод
// следующего модуля МОЛЧА перекрывает предыдущий. Так с v3.9.115 по v3.9.409
// `getCourses` онлайн-курсов (teaching_groups) подменял список КТП: на экране
// КТП были интенсивы, а открыть/удалить «КТП» сервер отвечал 404.

const modules = import.meta.glob('../shared/services/pb/*.js', { eager: true });
const barrelSrc = readFileSync(resolve(__dirname, '../shared/services/pocketbase.js'), 'utf8');

// Какие объекты (`fooApi`) реально разворачиваются в api — по самому barrel-у.
function spreadObjects() {
  const out = [];
  for (const [, names, file] of barrelSrc.matchAll(/import \{([^}]+)\} from '\.\/pb\/(\w+)\.js'/g)) {
    const mod = modules[`../shared/services/pb/${file}.js`];
    for (const name of names.split(',').map((s) => s.trim())) {
      if (name.endsWith('Api') && barrelSrc.includes(`...${name},`)) out.push({ file, name, obj: mod[name] });
    }
  }
  return out;
}

describe('barrel API', () => {
  it('ни один метод не объявлен в двух доменных модулях', () => {
    const owners = {};
    for (const { file, name, obj } of spreadObjects()) {
      for (const key of Object.keys(obj)) (owners[key] ||= []).push(`${file}.${name}`);
    }
    const dups = Object.entries(owners).filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.join(', ')}`);
    expect(dups).toEqual([]);
  });

  it('КТП и онлайн-курсы — разные методы', () => {
    expect(typeof api.getKtps).toBe('function');
    expect(typeof api.getKtp).toBe('function');
    expect(api.getCourses).toBe(modules['../shared/services/pb/courses.js'].coursesApi.getCourses);
  });
});
