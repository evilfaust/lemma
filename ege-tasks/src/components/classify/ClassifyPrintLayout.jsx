import MathInline from '../shared/MathInline';
import PrintFill from '../shared/PrintFill';
import ClassifyItemView from './ClassifyItemView';
import {
  sheetStats, paginateBuckets, normalizeClassifySettings,
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

const DEFAULT_INSTRUCTION = 'Определите тип каждого уравнения, перепишите его в нужный '
  + 'раздел и решите самым коротким способом. Номер уравнения подпишите сами.';

function Header({ title, settings }) {
  if (settings.showHeader === false) return null;
  return (
    <div className="cls-head">
      <div className="cls-eyebrow">Классификация уравнений</div>
      <div className="cls-title">{title || 'Разложи по типам'}</div>
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

// ─── Страница 1: банк уравнений (и таблица, если она включена) ───────────────
function BankPage({ title, items, stats, settings }) {
  const columns = settings.bankColumns === 1 ? 1 : 2;

  return (
    <div className="cls-page" style={{ padding: pagePaddingCss() }}>
      <Header title={title} settings={settings} />

      <div className="cls-note">
        <span className="cls-note-label">Задание. </span>
        <span className="cls-note-text">{settings.instruction || DEFAULT_INSTRUCTION}</span>
      </div>

      <div className={`cls-bank cls-bank--${columns}col`}>
        {items.map((item, index) => (
          <div className="cls-bank-item" key={item.id || index}>
            <span className="cls-bank-num">{index + 1}</span>
            <span className="cls-bank-expr"><ClassifyItemView item={item} /></span>
          </div>
        ))}
      </div>

      {settings.showTable && (
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
                  <span className="cls-type-label">{stat.bucket.label || '—'}</span>
                  {settings.showHints && stat.bucket.hint && (
                    <span className="cls-type-hint">{stat.bucket.hint}</span>
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
    </div>
  );
}

// ─── Карман: заголовок и сплошная клетка ─────────────────────────────────────
function BucketBlock({ stat, settings, showChecksum, columns }) {
  const heightMm = solveHeightMm(stat.slots, settings);

  return (
    <div className="cls-bucket">
      <div className="cls-bucket-head">
        <span className="cls-bucket-label">{stat.bucket.label || '—'}</span>
        {settings.showHints && stat.bucket.hint && (
          <span className="cls-bucket-hint">{stat.bucket.hint}</span>
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
        <div className="cls-title">{title || 'Разложи по типам'}</div>
      </div>

      {stats.buckets.map(stat => (
        <div className="cls-key-bucket" key={stat.bucket.id}>
          <div className="cls-key-head">
            <span className="cls-key-label">{stat.bucket.label || '—'}</span>
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
                <span className="cls-key-also">
                  также: {item.alsoFits.map(id => bucketName.get(id)).filter(Boolean).join(', ')}
                </span>
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
  const pages = paginateBuckets(stats, settings);
  const fontSize = settings.fontSize || 's';
  const columns = settings.bucketColumns === 2 ? 2 : 1;

  // Контрольная сумма нужна ровно один раз: в таблице первой страницы, а если
  // таблицы нет — в заголовке кармана. Напечатанная дважды, она превращает
  // страницу решений в шпаргалку по классификации.
  const sumInBucket = Boolean(settings.showChecksum) && !settings.showTable;

  const inner = (
    <>
      <BankPage title={title} items={items} stats={stats} settings={settings} />

      {pages.map((page, pageIndex) => (
        <div className="cls-page" key={`p${pageIndex}`} style={{ padding: pagePaddingCss() }}>
          {settings.showRunningTitle !== false && (
            <div className="cls-runhead">
              <span>{title || 'Разложи по типам'}</span>
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
