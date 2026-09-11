import { describe, it, expect } from 'vitest';
import {
  parseRouteMarkdown, buildRouteMarkdown, routeMarkdownFilename,
  normalizePlaceholders, buildRouteAiPrompt,
} from '../utils/routeImport';

const SAMPLE = `---
маршрут: Проценты и площади
класс: 7
---

### 1
ответ: 48

Найдите 12 % от 400.

### 2
ответ: 2304

Сторона квадрата равна [1] см. Найдите его площадь (в см$^2$).

### 3
ответ: 4

Во сколько раз [2] больше, чем 576?`;

describe('routeImport — плейсхолдеры', () => {
  it('человеческая запись приводится к кружковым цифрам', () => {
    expect(normalizePlaceholders('возьмите [1] и [2]')).toBe('возьмите [①] и [②]');
    expect(normalizePlaceholders('возьмите [#3] и [№12]')).toBe('возьмите [③] и [⑫]');
  });

  it('скобки с числом НЕ трогаются — в условиях это обычный текст', () => {
    expect(normalizePlaceholders('пункт (1) и число (2)')).toBe('пункт (1) и число (2)');
  });

  it('номер вне диапазона кружковых цифр остаётся как был', () => {
    expect(normalizePlaceholders('[21]')).toBe('[21]');
  });

  it('уже кружковые не ломаются', () => {
    expect(normalizePlaceholders('[①] и [⑫]')).toBe('[①] и [⑫]');
  });
});

describe('routeImport — разбор', () => {
  it('читает шапку, задачи и ответы', () => {
    const r = parseRouteMarkdown(SAMPLE);
    expect(r.errors).toEqual([]);
    expect(r.title).toBe('Проценты и площади');
    expect(r.classNumber).toBe(7);
    expect(r.tasks).toHaveLength(3);
    expect(r.tasks[0]).toMatchObject({ statement_md: 'Найдите 12 % от 400.', answer: '48' });
    expect(r.tasks[1].statement_md).toContain('[①]');
  });

  it('целая цепочка проходит без замечаний', () => {
    expect(parseRouteMarkdown(SAMPLE).warnings).toEqual([]);
  });

  it('условие может содержать строку, начинающуюся со слова «Ответ»', () => {
    const md = '### 1\nответ: 5\n\nРешите уравнение.\nОтвет округлите до целых.';
    const r = parseRouteMarkdown(md);
    expect(r.tasks[0].answer).toBe('5');
    expect(r.tasks[0].statement_md).toContain('Ответ округлите');
  });

  it('без шапки тоже читается', () => {
    const r = parseRouteMarkdown('### 1\nответ: 2\n\nДважды один.');
    expect(r.errors).toEqual([]);
    expect(r.title).toBe('');
    expect(r.tasks).toHaveLength(1);
  });

  it('текст без заголовков задач — ошибка, а не пустой лист', () => {
    const r = parseRouteMarkdown('просто какой-то текст без разметки');
    expect(r.tasks).toEqual([]);
    expect(r.errors[0]).toContain('Не найдено ни одной задачи');
  });

  it('пустое условие — ошибка', () => {
    const r = parseRouteMarkdown('### 1\nответ: 5\n\n### 2\nответ: 6\n\nВторая задача.');
    expect(r.errors.some(e => e.includes('пустое условие'))).toBe(true);
  });

  it('задача без ответа — предупреждение, но импорт возможен', () => {
    const r = parseRouteMarkdown('### 1\n\nНайдите 12 % от 400.');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some(w => w.includes('нет строки «ответ:»'))).toBe(true);
  });

  it('сбитая нумерация — предупреждение, порядок берётся по факту', () => {
    const md = '### 1\nответ: 1\n\nПервая.\n\n### 5\nответ: 2\n\nВторая, берём [1].';
    const r = parseRouteMarkdown(md);
    expect(r.tasks).toHaveLength(2);
    expect(r.warnings.some(w => w.includes('Нумерация задач в файле'))).toBe(true);
  });

  it('ссылка вперёд ловится тем же разбором, что и в редакторе листа', () => {
    const md = '### 1\nответ: 1\n\nВозьмите [2].\n\n### 2\nответ: 2\n\nВторая.';
    const r = parseRouteMarkdown(md);
    expect(r.warnings.some(w => w.includes('ниже по листу'))).toBe(true);
  });

  it('заголовки ## и #### тоже считаются задачами', () => {
    const r = parseRouteMarkdown('## 1\nответ: 1\n\nПервая.\n\n#### 2\nответ: 2\n\nВторая с [1].');
    expect(r.tasks).toHaveLength(2);
  });

  it('CRLF из Windows не ломает разбор', () => {
    const r = parseRouteMarkdown(SAMPLE.replace(/\n/g, '\r\n'));
    expect(r.errors).toEqual([]);
    expect(r.tasks).toHaveLength(3);
  });
});

describe('routeImport — выгрузка', () => {
  it('собранный маршрут читается своим же разбором', () => {
    const tasks = [
      { statement_md: 'Найдите 12 % от 400.', answer: '48' },
      { statement_md: 'Сторона квадрата равна [①] см. Найдите площадь.', answer: '2304' },
    ];
    const md = buildRouteMarkdown({ title: 'Проценты', classNumber: 7, tasks });
    const back = parseRouteMarkdown(md);
    expect(back.errors).toEqual([]);
    expect(back.title).toBe('Проценты');
    expect(back.classNumber).toBe(7);
    expect(back.tasks.map(t => t.answer)).toEqual(['48', '2304']);
    expect(back.tasks[1].statement_md).toContain('[①]');
  });

  it('имя файла без запрещённых символов', () => {
    expect(routeMarkdownFilename('Маршрут: 7/8 класс')).toBe('Маршрут 78 класс.md');
    expect(routeMarkdownFilename('')).toBe('marshrut.md');
  });
});

describe('routeImport — промпт для ИИ', () => {
  it('несёт формат, правила и параметры учителя', () => {
    const p = buildRouteAiPrompt({ classNumber: 7, topic: 'проценты', length: 5 });
    expect(p).toContain('### 1');
    expect(p).toContain('ответ:');
    expect(p).toContain('[N]');
    expect(p).toContain('цепочку из 5 задач');
    expect(p).toContain('«проценты»');
    expect(p).toContain('7 класса');
  });

  it('без параметров тоже осмысленный', () => {
    const p = buildRouteAiPrompt();
    expect(p).toContain('цепочку из 4 задач');
    expect(p).not.toContain('undefined');
  });
});
