import MathInline from '../shared/MathInline';
import MathText from '../shared/MathText';
import PrintFill from '../shared/PrintFill';
import ClassifyItemView from './ClassifyItemView';
import {
  sheetStats, planSheet, normalizeClassifySettings, isClassifyOnly,
  pagePaddingCss, solveWidthMm, solveHeightMm, CELL_MM, OTHER_BUCKET_ID,
} from '../../utils/classifySheet';
import './ClassifyPrintLayout.css';

/**
 * Печать листа-классификатора.
 *
 * Смысл листа в том, что ученик сначала опознаёт тип уравнения и лишь потом
 * решает: на первой странице банк уравнений вперемешку, дальше — карманы по
 * типам, куда уравнение надо переписать своей рукой. Переписывание и есть тот
 * момент, когда тип становится осознанным выбором.
 *
 * В кармане нет расчерченных мест под отдельные уравнения — только заголовок и
 * сплошная клетка: ученик сам решает, сколько места занять, и сам подписывает
 * номера. Высота клетки при этом считается по числу уравнений, которые в этот
 * карман идут (см. `slotsForBucket`).
 *
 * Стилистика — общая с печатным движком `components/print-sheet/`.
 * Тот же компонент рисует экранный предпросмотр (`screenMode`).
 */

// Два режима — два разных задания, и путать их нельзя: в одном лист про выбор
// способа решения, в другом только про опознание типа.
const INSTRUCTION_FULL = 'Определите тип каждого уравнения, перепишите его в нужный '
  + 'раздел и решите самым коротким способом. Номер уравнения подпишите сами.';

const INSTRUCTION_CLASSIFY = 'Определите тип каждого уравнения и впишите его номер '
  + 'в соответствующую строку таблицы. Решать уравнения не нужно.';

function Header({ title, settings }) {
  if (settings.showHeader === false) return null;
  return (
    <div className="cls-head">
      <div className="cls-eyebrow">Классификация уравнений</div>
      <div className="cls-title"><MathText text={title || 'Разложи по типам'} /></div>
      <div className="cls-fields">
        <div className="cls-field cls-field--wide">
          <span className="cls-field-label">Фамилия, имя</span>
          <span className="cls-field-rule" />
        </div>
        {settings.showClassField !== false && (
          <div className="cls-field">
            <span className="cls-field-label">Класс</span>
            <span className="cls-field-rule" />
          </div>
        )}
        <div className="cls-field">
          <span className="cls-field-label">Дата</span>
          <span className="cls-field-rule" />
        </div>
      </div>
    </div>
  );
}

// ─── Страница 1: банк уравнений, под ним — первые карманы ───────────────────
// Низ первой страницы под коротким банком иначе просто пустует, а лишняя
// страница на класс из 30 человек — это лишняя пачка бумаги.
function BankPage({ title, items, stats, settings, buckets, showChecksum }) {
  const columns = settings.bankColumns === 1 ? 1 : 2;
  const classifyOnly = isClassifyOnly(settings);
  const bucketColumns = settings.bucketColumns === 2 ? 2 : 1;

  return (
    <div className="cls-page" style={{ padding: pagePaddingCss() }}>
      <Header title={title} settings={settings} />

      <div className="cls-note">
        <span className="cls-note-label">Задание. </span>
        <MathText
          className="cls-note-text"
          text={settings.instruction || (classifyOnly ? INSTRUCTION_CLASSIFY : INSTRUCTION_FULL)}
        />
      </div>

      <div className={`cls-bank cls-bank--${columns}col`}>
        {items.map((item, index) => (
          <div className="cls-bank-item" key={item.id || index}>
            <span className="cls-bank-num">{index + 1}</span>
            <span className="cls-bank-expr"><ClassifyItemView item={item} /></span>
          </div>
        ))}
      </div>

      {classifyOnly && (
        <table className="cls-table">
          <thead>
            <tr>
              <th className="cls-th-type">Тип уравнения</th>
              <th className="cls-th-nums">Номера уравнений</th>
              {settings.showChecksum && <th className="cls-th-sum">Сумма номеров</th>}
            </tr>
          </thead>
          <tbody>
            {stats.buckets.map(stat => (
              <tr key={stat.bucket.id}>
                <td className="cls-td-type">
                  <MathText className="cls-type-label" text={stat.bucket.label || '—'} />
                  {settings.showHints && stat.bucket.hint && (
                    <MathText className="cls-type-hint" text={stat.bucket.hint} />
                  )}
                </td>
                <td className="cls-td-nums" />
                {settings.showChecksum && (
                  <td className="cls-td-sum">{stat.checksum || '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {buckets.length > 0 && (
        <div className={`cls-buckets cls-buckets--${bucketColumns}col`}>
          {buckets.map(stat => (
            <BucketBlock
              key={stat.bucket.id}
              stat={stat}
              settings={settings}
              columns={bucketColumns}
              showChecksum={showChecksum && stat.bucket.id !== OTHER_BUCKET_ID}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Карман: заголовок и сплошная клетка ─────────────────────────────────────
function BucketBlock({ stat, settings, showChecksum, columns }) {
  // Высоту поля назначает раскладка (planSheet): она растягивает карманы до
  // низа страницы, поэтому считать её здесь заново нельзя.
  const heightMm = stat.fieldMm ?? solveHeightMm(stat.slots, settings);

  return (
    <div className="cls-bucket">
      <div className="cls-bucket-head">
        <MathText className="cls-bucket-label" text={stat.bucket.label || '—'} />
        {settings.showHints && stat.bucket.hint && (
          <MathText className="cls-bucket-hint" text={stat.bucket.hint} />
        )}
        {settings.showPoints && stat.bucket.points > 0 && (
          <span className="cls-bucket-points">{stat.bucket.points} б. за уравнение</span>
        )}
        {showChecksum && (
          <span className="cls-bucket-sum">Σ номеров = {stat.checksum || '—'}</span>
        )}
      </div>

      <div className="cls-solve" style={{ height: `${heightMm}mm` }}>
        <PrintFill
          fill={settings.fill}
          heightMm={heightMm}
          widthMm={solveWidthMm(columns)}
          cellMm={CELL_MM}
        />
      </div>
    </div>
  );
}

// ─── Ключ учителя ────────────────────────────────────────────────────────────
function KeyPage({ title, stats, settings }) {
  const bucketName = new Map(stats.buckets.map(s => [s.bucket.id, s.bucket.label]));

  return (
    <div className="cls-page cls-page--key" style={{ padding: pagePaddingCss() }}>
      <div className="cls-head">
        <div className="cls-eyebrow">Ключ учителя</div>
        <div className="cls-title"><MathText text={title || 'Разложи по типам'} /></div>
      </div>

      {stats.buckets.map(stat => (
        <div className="cls-key-bucket" key={stat.bucket.id}>
          <div className="cls-key-head">
            <MathText className="cls-key-label" text={stat.bucket.label || '—'} />
            <span className="cls-key-meta">
              {stat.count} шт. · номера: {stat.numbers.join(', ') || '—'}
              {settings.showChecksum ? ` · Σ = ${stat.checksum}` : ''}
            </span>
          </div>
          {stat.entries.map(({ number, item }) => (
            <div className="cls-key-row" key={item.id || number}>
              <span className="cls-key-num">{number}</span>
              <span className="cls-key-expr"><ClassifyItemView item={item} /></span>
              {item.answerLatex && (
                <span className="cls-key-answer">
                  → <MathInline latex={item.answerLatex} />
                </span>
              )}
              {item.alsoFits?.length > 0 && (
                <MathText
                  className="cls-key-also"
                  text={`также: ${item.alsoFits.map(id => bucketName.get(id)).filter(Boolean).join(', ')}`}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {stats.unassigned.length > 0 && (
        <div className="cls-key-bucket cls-key-bucket--warn">
          <div className="cls-key-head">
            <span className="cls-key-label">Без типа</span>
            <span className="cls-key-meta">{stats.unassigned.length} шт.</span>
          </div>
          {stats.unassigned.map(({ number, item }) => (
            <div className="cls-key-row" key={item.id || number}>
              <span className="cls-key-num">{number}</span>
              <span className="cls-key-expr"><ClassifyItemView item={item} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClassifyPrintLayout({
  title,
  buckets = [],
  items = [],
  settings: rawSettings = {},
  screenMode = false,
}) {
  // Лист мог быть сохранён версией с линейками вместо клетки — приводим
  // настройки к текущей форме здесь, а не в каждом блоке вёрстки.
  const settings = normalizeClassifySettings(rawSettings);
  const stats = sheetStats(buckets, items, settings);
  const { firstBuckets, pages } = planSheet(stats, settings, items);
  const fontSize = settings.fontSize || 's';
  const columns = settings.bucketColumns === 2 ? 2 : 1;

  // Контрольная сумма нужна ровно один раз: в режиме «только классификация» —
  // в таблице, иначе — в заголовке кармана.
  const sumInBucket = Boolean(settings.showChecksum) && !isClassifyOnly(settings);

  const inner = (
    <>
      <BankPage
        title={title}
        items={items}
        stats={stats}
        settings={settings}
        buckets={firstBuckets}
        showChecksum={sumInBucket}
      />

      {pages.map((page, pageIndex) => (
        <div className="cls-page" key={`p${pageIndex}`} style={{ padding: pagePaddingCss() }}>
          {settings.showRunningTitle !== false && (
            <div className="cls-runhead">
              <MathText text={title || 'Разложи по типам'} />
              <span>стр. {pageIndex + 2}</span>
            </div>
          )}
          <div className={`cls-buckets cls-buckets--${columns}col`}>
            {page.map(stat => (
              <BucketBlock
                key={stat.bucket.id}
                stat={stat}
                settings={settings}
                columns={columns}
                showChecksum={sumInBucket && stat.bucket.id !== OTHER_BUCKET_ID}
              />
            ))}
          </div>
        </div>
      ))}

      {settings.showKey && <KeyPage title={title} stats={stats} settings={settings} />}
    </>
  );

  if (screenMode) {
    return <div className={`cls-screen-root cls-fs-${fontSize}`}>{inner}</div>;
  }
  return <div className={`cls-print-root cls-fs-${fontSize}`}>{inner}</div>;
}
