import { describe, it, expect } from 'vitest';
import {
  taskToGeometryRecord, findAlreadyTransferred, geometryCodeSequence,
  geometryTitleFromStatement, transferKey,
} from '../utils/taskToGeometry';

const urlOf = (rec) => (rec.file ? `https://pb/api/files/task_images/${rec.id}/${rec.file}` : '');

describe('taskToGeometryRecord', () => {
  it('переносит поля задачи и пишет откуда она', () => {
    const { record, drawingUrl, keepsSourceLinks } = taskToGeometryRecord({
      code: '1-014',
      statement_md: 'В треугольнике $ABC$ угол $C$ равен $90^\\circ$. Найдите $AB$.',
      answer: '5',
      solution_md: 'По теореме Пифагора.',
      source: ['РЕШУ ЕГЭ'],
      difficulty: '2',
      year: 2025,
    }, { code: 'GEO-101', note: '*Из банка задач: 1-014.*', topic: 'gt1', subtopic: 'gs1' });

    expect(record).toMatchObject({
      code: 'GEO-101',
      origin: 'manual',
      section: 'planim',
      answer: '5',
      source: 'РЕШУ ЕГЭ',
      difficulty: 2,
      year: 2025,
      topic: 'gt1',
      subtopic: 'gs1',
    });
    expect(record.solution_md).toBe('*Из банка задач: 1-014.*\n\nПо теореме Пифагора.');
    expect(record.title.startsWith('В треугольнике … угол … равен …')).toBe(true);
    expect(drawingUrl).toBe('');
    expect(keepsSourceLinks).toBe(false);
  });

  it('стереозадача по тексту и по теме', () => {
    expect(taskToGeometryRecord({ statement_md: 'Найдите объём пирамиды.' }, { code: 'GEO-1' }).record.section)
      .toBe('stereo');
    expect(taskToGeometryRecord({ statement_md: 'Найдите x.' }, { code: 'GEO-1', topicTitle: 'Стереометрия' }).record.section)
      .toBe('stereo');
  });

  it('пустые сложность и год не пишутся', () => {
    const { record } = taskToGeometryRecord({ statement_md: 'x', difficulty: '', year: 0 }, { code: 'GEO-1' });
    expect('difficulty' in record).toBe(false);
    expect('year' in record).toBe(false);
    expect('topic' in record).toBe(false);
  });

  it('legacy-картинка уходит в чертёж', () => {
    const { drawingUrl } = taskToGeometryRecord({ statement_md: 'x' }, {
      code: 'GEO-1', legacyImageUrl: 'https://pb/api/files/tasks/t1/a.png',
    });
    expect(drawingUrl).toBe('https://pb/api/files/tasks/t1/a.png');
  });

  it('единственный чертёж условия из task_images — в чертёж, ссылка из условия убирается', () => {
    const images = [{
      id: 'i1', file: 'f.png', role: 'condition', order: 0,
      original_url: 'https://ege.sdamgia.ru/get_file?id=145381',
    }];
    const { record, drawingUrl, keepsSourceLinks } = taskToGeometryRecord({
      statement_md: 'Найдите угол.\n\n![image](https://ege.sdamgia.ru/get_file?id=145381&png=1)\n\nОтвет дайте в градусах.',
    }, { code: 'GEO-1', images, imageUrlOf: urlOf });
    expect(drawingUrl).toBe(urlOf(images[0]));
    expect(record.statement_md).toBe('Найдите угол.\n\nОтвет дайте в градусах.');
    expect(keepsSourceLinks).toBe(false);
  });

  it('при legacy-картинке ссылки на task_images переписываются на наши файлы и держат исходник', () => {
    const images = [
      { id: 'i1', file: 'a.png', role: 'condition', order: 0, sdamgia_file_id: '11' },
      { id: 'i2', file: 'b.png', role: 'solution', order: 0, sdamgia_file_id: '22' },
    ];
    const { record, keepsSourceLinks } = taskToGeometryRecord({
      statement_md: 'Условие ![image](https://x/get_file?id=11){M}',
      solution_md: 'Решение ![](https://x/get_file?id=22)',
    }, { code: 'GEO-1', legacyImageUrl: 'L', images, imageUrlOf: urlOf });
    expect(record.statement_md).toBe(`Условие ![image](${urlOf(images[0])}){M}`);
    expect(record.solution_md).toBe(`Решение ![image](${urlOf(images[1])})`);
    expect(keepsSourceLinks).toBe(true);
  });

  it('несколько чертежей условия остаются ссылками в тексте', () => {
    const images = [
      { id: 'i1', file: 'a.png', role: 'condition', order: 0, sdamgia_file_id: '1' },
      { id: 'i2', file: 'b.png', role: 'condition', order: 1, sdamgia_file_id: '2' },
    ];
    const { drawingUrl, keepsSourceLinks } = taskToGeometryRecord({
      statement_md: '![](https://x/get_file?id=1) ![](https://x/get_file?id=2)',
    }, { code: 'GEO-1', images, imageUrlOf: urlOf });
    expect(drawingUrl).toBe('');
    expect(keepsSourceLinks).toBe(true);
  });

  it('внешние ссылки без записи task_images не трогаются', () => {
    const { record, keepsSourceLinks } = taskToGeometryRecord({
      statement_md: '![](https://example.com/a.png)',
    }, { code: 'GEO-1', images: [], imageUrlOf: urlOf });
    expect(record.statement_md).toBe('![](https://example.com/a.png)');
    expect(keepsSourceLinks).toBe(false);
  });
});

describe('findAlreadyTransferred', () => {
  it('узнаёт задачу по тексту условия без картинок и форматирования', () => {
    const tasks = [
      { id: 't1', statement_md: 'Найдите  $AB$.\n\n![image](https://ege.sdamgia.ru/get_file?id=1)' },
      { id: 't2', statement_md: 'Другая задача.' },
      { id: 't3', statement_md: '' },
    ];
    const geo = [
      { id: 'g1', code: 'GEO-007', statement_md: 'найдите $AB$' },
      { id: 'g2', code: 'GEO-008', statement_md: '' },
    ];
    const found = findAlreadyTransferred(tasks, geo);
    expect([...found]).toEqual([['t1', 'GEO-007']]);
  });

  it('transferKey игнорирует регистр, ё и пунктуацию', () => {
    expect(transferKey('Найдите ёлку.')).toBe(transferKey('найдите елку'));
  });
});

describe('коды и названия', () => {
  it('geometryCodeSequence продолжает нумерацию', () => {
    expect(geometryCodeSequence('GEO-098', 3)).toEqual(['GEO-098', 'GEO-099', 'GEO-100']);
    expect(geometryCodeSequence('GEO-1000', 2)).toEqual(['GEO-1000', 'GEO-1001']);
    expect(geometryCodeSequence('GEO-005', 0)).toEqual([]);
  });

  it('название без картинок, блоков и формул', () => {
    expect(geometryTitleFromStatement('```planim\nA = (0; 0)\n```\nНайдите **угол** $x$.', 'X'))
      .toBe('Найдите угол ….');
    expect(geometryTitleFromStatement('![](u)', 'GEO-1')).toBe('GEO-1');
  });
});
