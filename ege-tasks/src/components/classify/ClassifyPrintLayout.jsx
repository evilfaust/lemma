import MathInline from '../shared/MathInline';
import ClassifyItemView from './ClassifyItemView';
import {
  sheetStats, paginateBuckets, OTHER_BUCKET_ID,
} from '../../utils/classifySheet';
import './ClassifyPrintLayout.css';

/**
 * Печать листа-классификатора.
 *
 * Лист двухэтапный и это его смысл, а не оформление: на первой странице
 * ученик только опознаёт типы и заполняет таблицу «тип → номера», и здесь же
 * напечатана контрольная сумма номеров — разбиение проверяется до того, как
 * начнётся счёт. Решения идут на следующих страницах, куда уравнение надо
 * переписать своей рукой (переписывание и есть момент, когда тип становится
 * осознанным выбором).
 *
 * Тот же компонент рисует экранный предпросмотр (`screenMode`) — иначе учитель
 * увидит лист только в диалоге печати.
 */

const DEFAULT_INSTRUCTION = 'Определите тип каждого уравнения. Впишите его номер '
  + 'в таблицу, а затем перепишите уравнение в нужный раздел и решите самым коротким способом.';

function Header({ settings }) {
  if (settings.showHeader === false) return null;
  return (
    <div className="cls-header">
      <span className="cls-field cls-field--fio">ФИО: <span className="cls-line cls-line--name" /></span>
      <span className="cls-field">Класс: <span className="cls-line cls-line--short" /></span>
      <span className="cls-field">Дата: <span className="cls-line cls-line--short" /></span>
    </div>
  );
}

// ─── Страница 1: банк уравнений и таблица классификации ──────────────────────
function BankPage({ title, items, stats, settings }) {
  const columns = settings.bankColumns === 1 ? 1 : 2;

  return (
    <div className="cls-page">
      <Header settings={settings} />
      {title && <div className="cls-title">{title}</div>}
      <div className="cls-instruction">{settings.instruction || DEFAULT_INSTRUCTION}</div>

      <div className={`cls-bank cls-bank--${columns}col`}>
        {items.map((item, index) => (
          <div className="cls-bank-item" key={item.id || index}>
            <span className="cls-bank-num">{index + 1})</span>
            <span className="cls-bank-expr"><ClassifyItemView item={item} /></span>
          </div>
        ))}
      </div>

      {settings.showTable !== false && (
        <table className="cls-table">
          <thead>
            <tr>
              <th className="cls-th-type">Тип уравнения</th>
              <th className="cls-th-nums">Номера уравнений</th>
              {settings.showChecksum && <th className="cls-th-sum">Сумма<br />номеров</th>}
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

// ─── Страницы решений: карманы ───────────────────────────────────────────────
function SolveSlot({ settings }) {
  const lines = Math.max(1, settings.solveLines ?? 3);
  return (
    <div className="cls-slot">
      <div className="cls-slot-prompt">
        <span className="cls-slot-num">№</span>
        <span className="cls-line cls-line--num" />
        <span className="cls-line cls-line--expr" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <div className="cls-solve-line" key={i} />
      ))}
    </div>
  );
}

function BucketBlock({ stat, settings, showChecksum }) {
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
      {Array.from({ length: stat.slots }, (_, i) => (
        <SolveSlot key={i} settings={settings} />
      ))}
    </div>
  );
}

// ─── Ключ учителя ────────────────────────────────────────────────────────────
function KeyPage({ title, stats, settings }) {
  const bucketName = new Map(stats.buckets.map(s => [s.bucket.id, s.bucket.label]));

  return (
    <div className="cls-page cls-page--key">
      <div className="cls-title">Ключ: {title || 'лист-классификатор'}</div>

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
              <span className="cls-key-num">{number})</span>
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
              <span className="cls-key-num">{number})</span>
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
  settings = {},
  screenMode = false,
}) {
  const stats = sheetStats(buckets, items, settings);
  const pages = paginateBuckets(stats, settings);
  const fontSize = settings.fontSize || 's';

  // Контрольная сумма нужна ровно один раз: в таблице первой страницы, а если
  // таблицы нет — в заголовке кармана. Напечатанная дважды, она превращает
  // страницу решений в шпаргалку по классификации.
  const sumInBucket = Boolean(settings.showChecksum) && settings.showTable === false;

  const inner = (
    <>
      <BankPage title={title} items={items} stats={stats} settings={settings} />

      {pages.map((page, pageIndex) => (
        <div className="cls-page" key={`p${pageIndex}`}>
          {settings.showRunningTitle !== false && (
            <div className="cls-running">
              {title || 'Разложи по типам'}
              <span className="cls-running-page">стр. {pageIndex + 2}</span>
            </div>
          )}
          {page.map(stat => (
            <BucketBlock
              key={stat.bucket.id}
              stat={stat}
              settings={settings}
              showChecksum={sumInBucket && stat.bucket.id !== OTHER_BUCKET_ID}
            />
          ))}
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
