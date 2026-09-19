import { useState } from 'react';
import { Modal, Button, Tooltip, Tag } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import MathRenderer from '../../shared/components/MathRenderer';
import { MODIFIER_INFO, modifierAliases } from '../../utils/remarkTableModifiers';

// Справка по модификаторам markdown-таблиц (кнопка «?» рядом с меню
// «Таблица»). Модификаторов становится больше — учителю трудно держать в
// голове, какая директива что делает, поэтому карточка показывает не только
// текст, но и ЖИВОЙ пример через тот же MathRenderer, что рендерит статью/
// задачу — как выглядит, так и получится.
//
// Порядок и описания — MODIFIER_INFO в utils/remarkTableModifiers.js (там же
// синонимы-алиасы разбирает parseTableDirective — справка их не дублирует,
// собирает через modifierAliases). Примеры — EXAMPLES ниже, по одному на
// модификатор; каждый рендерится ДЕЙСТВИЕМ директивы, а не только текстом.
const EXAMPLES = {
  plain: [
    '{без линий}',
    '',
    '| ВЕЛИЧИНЫ | ЗНАЧЕНИЯ |',
    '| --- | --- |',
    '| А) длительность урока | 1) 17,6 секунды |',
    '| Б) норматив ГТО | 2) 45 минут |',
  ].join('\n'),
  noheader: [
    '{без шапки}',
    '',
    '| Заголовок 1 | Заголовок 2 |',
    '| --- | --- |',
    '| Обычная строка | Тоже обычная |',
  ].join('\n'),
  answers: [
    '{бланк}',
    '',
    '| А | Б | В | Г |',
    '| --- | --- | --- | --- |',
    '|  |  |  |  |',
  ].join('\n'),
  compact: [
    '{компактная}',
    '',
    '| A | B | C |',
    '| --- | --- | --- |',
    '| 1 | 2 | 3 |',
    '| 4 | 5 | 6 |',
  ].join('\n'),
  gallery: [
    '{галерея}',
    '',
    '| 1. `numline: domain -6 6; ray left -4 open` | 3. `numline: domain -6 6; ray right -4 open` |',
    '| --- | --- |',
    '| 2. `numline: domain -6 6; ray left 4 open` | 4. `numline: domain -6 6; ray right 4 open` |',
  ].join('\n'),
  grid: [
    '{линии}',
    '',
    '| Заголовок 1 | Заголовок 2 |',
    '| --- | --- |',
    '| 1 | 2 |',
  ].join('\n'),
  // Показывает главный эффект честно: несмотря на то, что заголовки очень
  // разной длины, столбцы всё равно выходят 50/50 — это table-layout: fixed,
  // а не подгон картинки под глаз.
  equalcols: [
    '{равные колонки}',
    '',
    '| Очень длинное название левой колонки с пояснением | Кратко |',
    '| --- | --- |',
    '| текст | текст |',
  ].join('\n'),
};

export default function TableModifiersHelp({ onInsert }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="Справка: какие бывают виды таблиц">
        <Button
          size="small"
          type="text"
          icon={<QuestionCircleOutlined />}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Modal
        title="Виды таблиц"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
      >
        <p style={{ color: '#666', marginBottom: 16 }}>
          Строка-директива в фигурных скобках ПЕРЕД таблицей задаёт её вид.
          Несколько модификаторов пишутся через запятую (
          <code>{'{без линий, без шапки}'}</code>
          ) или отдельными строками подряд — это одно и то же. Без директивы
          вид подбирается сам: пустая таблица под шапкой становится бланком
          ответа, а два столбца «А) …» / «1) …» — таблицей без линий.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.entries(MODIFIER_INFO).map(([key, info]) => (
            <div key={key} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              {/* Заголовок и кнопка — своя строка (всегда рядом, теги их не
                  раздвигают); синонимы-директивы — отдельной строкой ниже,
                  им можно спокойно переноситься на 2-3 строки. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong>{info.title}</strong>
                {onInsert && (
                  <Button
                    size="small"
                    onClick={() => { onInsert(`\n${EXAMPLES[key]}\n`); setOpen(false); }}
                  >
                    Вставить пример
                  </Button>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                {modifierAliases(key).map((alias) => (
                  <Tag key={alias} style={{ fontFamily: 'monospace', marginBottom: 4 }}>
                    {`{${alias}}`}
                  </Tag>
                ))}
              </div>
              <p style={{ color: '#666', margin: '8px 0 10px', fontSize: 13 }}>{info.description}</p>
              <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: '8px 12px' }}>
                <MathRenderer text={EXAMPLES[key]} />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
