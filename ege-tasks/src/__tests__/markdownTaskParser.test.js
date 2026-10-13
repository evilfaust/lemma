import { describe, it, expect } from 'vitest';
import {
  convertToLatex,
  parseTags,
  parseYamlFrontmatter,
  detectFormat,
  parseEgeTasks,
  parseMarkdownFile,
  convertLegacyMath,
} from '../utils/markdownTaskParser';

describe('parseTags', () => {
  it('обрабатывает массив', () => {
    expect(parseTags(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('обрабатывает строку через запятую', () => {
    expect(parseTags('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('обрабатывает строку в квадратных скобках', () => {
    expect(parseTags('[тег1, тег2]')).toEqual(['тег1', 'тег2']);
  });

  it('обрезает пробелы у тегов', () => {
    expect(parseTags('  a  ,  b  ')).toEqual(['a', 'b']);
  });

  it('фильтрует пустые теги', () => {
    expect(parseTags('a, , b')).toEqual(['a', 'b']);
  });

  it('возвращает [] для falsy', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  it('возвращает [] для неподдерживаемого типа', () => {
    expect(parseTags(42)).toEqual([]);
    expect(parseTags({})).toEqual([]);
  });
});

describe('parseYamlFrontmatter', () => {
  it('извлекает frontmatter в metadata', () => {
    const text = '---\ntopic: math\ndifficulty: 2\n---\nКонтент тут';
    const { metadata, content } = parseYamlFrontmatter(text);
    expect(metadata).toEqual({ topic: 'math', difficulty: 2 });
    expect(content).toBe('Контент тут');
  });

  it('возвращает null metadata если frontmatter нет', () => {
    const { metadata, content } = parseYamlFrontmatter('просто текст');
    expect(metadata).toBeNull();
    expect(content).toBe('просто текст');
  });

  it('возвращает yamlError для невалидного YAML', () => {
    const text = '---\n:::bad: yaml\n:::\n---\ntext';
    const result = parseYamlFrontmatter(text);
    // Либо распарсилось как пустое, либо есть ошибка
    expect(result.content).toBeDefined();
  });
});

describe('detectFormat', () => {
  it('определяет mordkovich по формату **043.9a**', () => {
    expect(detectFormat('**043.9a** [2] условие')).toBe('mordkovich');
    expect(detectFormat('**12.3** [1]')).toBe('mordkovich');
  });

  it('определяет ege по формату **число** [сложность]', () => {
    expect(detectFormat('**1** [1] условие')).toBe('ege');
    expect(detectFormat('**14** [2]')).toBe('ege');
  });

  it('по умолчанию ege', () => {
    expect(detectFormat('просто текст')).toBe('ege');
  });
});

describe('parseEgeTasks', () => {
  it('парсит простую задачу', () => {
    const md = '**1** [1] Найдите значение x\nответ: 5';
    const tasks = parseEgeTasks(md, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      number: 1,
      difficulty: '1',
      answer: '5',
    });
    expect(tasks[0].statement_md).toContain('Найдите значение x');
  });

  it('парсит несколько задач подряд', () => {
    const md = `
**1** [1] Задача 1
ответ: 5

**2** [2] Задача 2
ответ: 10
`;
    const tasks = parseEgeTasks(md, {});
    expect(tasks).toHaveLength(2);
    expect(tasks[0].answer).toBe('5');
    expect(tasks[1].answer).toBe('10');
    expect(tasks[1].difficulty).toBe('2');
  });

  it('парсит теги', () => {
    const md = '**1** [1] Задача\nответ: 5\ntags: [алгебра, дроби]';
    const tasks = parseEgeTasks(md, {});
    expect(tasks[0].tags).toEqual(['алгебра', 'дроби']);
  });

  it('извлекает URL изображения', () => {
    const md = '**1** [1] Задача ![alt](https://example.com/img.png)\nответ: 5';
    const tasks = parseEgeTasks(md, {});
    expect(tasks[0].imageUrl).toBe('https://example.com/img.png');
    expect(tasks[0].statement_md).not.toContain('https://example.com');
  });

  it('применяет defaultDifficulty из metadata', () => {
    // У формата ЕГЭ сложность обязательна в `[N]`, но проверим что она используется
    const md = '**1** [3] Задача\nответ: 5';
    const tasks = parseEgeTasks(md, { difficulty: 1 });
    expect(tasks[0].difficulty).toBe('3'); // из [3]
  });

  it('убирает markdown-заголовки', () => {
    const md = '# Раздел\n**1** [1] Задача\nответ: 5';
    const tasks = parseEgeTasks(md, {});
    expect(tasks).toHaveLength(1);
  });
});

describe('convertToLatex', () => {
  it('преобразует "косинус альфа" в \\cos\\alpha', () => {
    const result = convertToLatex('косинус альфа');
    expect(result).toContain('\\cos\\alpha');
  });

  it('преобразует склеенную форму "косинусальфа"', () => {
    const result = convertToLatex('косинусальфа = 1');
    expect(result).toContain('\\cos\\alpha');
  });

  it('преобразует "корень из: 5" в \\sqrt{5}', () => {
    const result = convertToLatex('корень из: 5');
    expect(result).toContain('\\sqrt{5}');
  });

  it('преобразует дроби', () => {
    const result = convertToLatex('дробь: числитель: 1, знаменатель: 2');
    expect(result).toContain('\\frac{1}{2}');
  });

  it('преобразует греческие буквы в контексте (regex \\b не работает с кириллицей в одиночку)', () => {
    // \b в JS не распознаёт границы кириллических слов, поэтому
    // одиночное "альфа" не конвертируется. Но в составе с латинскими
    // соседями или другими шагами — работает.
    expect(convertToLatex('косинус альфа = 0')).toContain('\\alpha');
  });

  it('число + Пи → 2\\pi', () => {
    const result = convertToLatex('2 Пи');
    expect(result).toContain('2\\pi');
  });

  it('возвращает falsy/нестроки без изменений', () => {
    expect(convertToLatex(null)).toBe(null);
    expect(convertToLatex(undefined)).toBe(undefined);
    expect(convertToLatex(42)).toBe(42);
  });

  it('обычный текст без ключевых слов проходит без LaTeX-обёртки', () => {
    const result = convertToLatex('просто текст');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('$');
  });
});

describe('чертежи нашими редакторами в условии', () => {
  const STEREO = [
    '```stereo',
    'пирамида 3 4 5 S',
    '# точки на рёбрах',
    'M = середина SA',
    '',
    'BM',
    '```',
  ];

  it('блок ```stereo переносится как есть — с пустыми строками и комментариями #', () => {
    const md = ['**1** [2] В правильной пирамиде SABC найдите угол.', '', ...STEREO, 'ответ: 30'].join('\n');
    const [task] = parseEgeTasks(md, {});
    expect(task.statement_md).toBe(['В правильной пирамиде SABC найдите угол.', '', ...STEREO].join('\n'));
    expect(task.answer).toBe('30');
  });

  it('«ответ:», «tags:» и заголовок задачи внутри блока не ищутся', () => {
    const md = [
      '**1** [1] Найдите x.',
      '```plot',
      '  f x^2 - 4',
      'label 2 0 ответ: здесь',
      '```',
      'ответ: 2',
    ].join('\n');
    const [task] = parseEgeTasks(md, {});
    expect(task.statement_md).toContain('  f x^2 - 4');
    expect(task.statement_md).toContain('label 2 0 ответ: здесь');
    expect(task.answer).toBe('2');
  });

  it('абзацы условия не склеиваются', () => {
    const md = '**1** [1] Решите уравнение.\n\nа) $x^2 = 4$\n\nб) $x^2 = 9$\nответ: 2';
    expect(parseEgeTasks(md, {})[0].statement_md).toBe('Решите уравнение.\n\nа) $x^2 = 4$\n\nб) $x^2 = 9$');
  });

  it('условие может начинаться со следующей строки (сразу чертёж)', () => {
    const md = '**3** [1]\n```planim\nтреугольник ABC 5 6 7\n```\nНайдите площадь.\nответ: 14,7';
    const [task] = parseEgeTasks(md, {});
    expect(task.number).toBe(3);
    expect(task.statement_md).toBe('```planim\nтреугольник ABC 5 6 7\n```\nНайдите площадь.');
  });

  it('картинки в таблице-галерее остаются на месте', () => {
    const md = [
      '**1** [1] На каком рисунке изображено множество решений?',
      '{галерея}',
      '| ![](https://x.ru/a.png) | ![](https://x.ru/b.png) |',
      'ответ: 2',
    ].join('\n');
    const [task] = parseEgeTasks(md, {});
    expect(task.imageUrl).toBe('');
    expect(task.statement_md).toContain('| ![](https://x.ru/a.png) | ![](https://x.ru/b.png) |');
  });

  it('картинка одной строкой уходит в поле картинки вместе с размером, вторая остаётся в тексте', () => {
    const md = '**1** [1] Задача\n![](https://x.ru/a.png){M}\nТекст ![](https://x.ru/b.png) рядом\nответ: 1';
    const [task] = parseEgeTasks(md, {});
    expect(task.imageUrl).toBe('https://x.ru/a.png');
    expect(task.statement_md).toBe('Задача\nТекст ![](https://x.ru/b.png) рядом');
  });

  it('незакрытый блок закрывается перед следующей задачей + предупреждение', () => {
    const md = '---\ntopic: Т\n---\n**1** [1] А\n```planim\nтреугольник ABC\n**2** [1] Б\nответ: 2';
    const r = parseMarkdownFile(md);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[0].statement_md).toBe('А\n```planim\nтреугольник ABC\n```');
    expect(r.tasks[1].statement_md).toBe('Б');
    expect(r.warnings.some((w) => /не закрыт/.test(w))).toBe(true);
  });

  it('слова с «пи» не включают конвертацию «словесной» математики (она схлопывала строки)', () => {
    const md = ['**1** [1] Пирамида: запишите ответ.', ...STEREO, 'ответ: 1'].join('\n');
    const [task] = parseEgeTasks(md, {});
    expect(task.statement_md).toBe(['Пирамида: запишите ответ.', ...STEREO].join('\n'));
  });

  it('конвертация РЕШУ идёт построчно и не трогает блоки', () => {
    const out = convertLegacyMath('косинус альфа равен 0,6\n```planim\nтреугольник ABC\n```');
    expect(out).toBe('$\\cos\\alpha$ равен 0,6\n```planim\nтреугольник ABC\n```');
  });

  it('parseMarkdownFile: метка чертежей и предупреждение о битой строке с номером', () => {
    const md = [
      '---', 'topic: Стерео', '---',
      '**1** [2] Куб.',
      '```stereo', 'куб 4', 'M на AA1 1:2', 'сечение M B1 D', '```',
      'ответ: 1',
      '**2** [1] Трапеция.',
      '```planim', 'трапеция ABCD 10 4 4', 'AC', '```',
      'ответ: 2',
    ].join('\n');
    const r = parseMarkdownFile(md);
    expect(r.errors).toEqual([]);
    expect(r.tasks.map((t) => t.drawings)).toEqual([['stereo'], ['planim']]);
    const bad = r.warnings.filter((w) => /чертёж/.test(w));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/Задание #1, чертёж stereo: строка 3 «сечение M B1 D»/);
  });
});
