import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../shared/services/pocketbase';
import { useMarkdownProcessor, useGeoGebraInjection, useStereoBlocks } from '../../hooks';
import { printThemeClass } from '../../utils/theoryThemes';
import 'katex/dist/katex.min.css';
import './themes.css';
import './themeSheet.css';
import './TheoryGeoGebraEmbed.css';
import './studentTheoryArticle.css';

const formatDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  : '');

/** Оглавление из готового HTML: заголовки второго и третьего уровня. */
export function tocFromHtml(html) {
  if (!html) return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('h2, h3')].map((h, i) => ({
    id: `t-sec-${i}`,
    text: h.textContent.trim(),
    level: Number(h.tagName[1]),
  })).filter((t) => t.text);
}

/**
 * Статья теории по ссылке: student.oipav.ru/t/<id>. Без входа, если учитель
 * открыл статью («Поделиться»). Вёрстка для чтения, а не лист A4: одна
 * колонка, ширина по экрану (телефон — во всю ширину, компьютер — колонка
 * ~760 px), картинки и таблицы не вылезают за край, формулы прокручиваются.
 */
export default function StudentTheoryArticle({ id }) {
  const [article, setArticle] = useState(undefined); // undefined — грузим, null — недоступна
  const contentRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.getPublicTheoryArticle(id)
      .then((a) => { if (alive) setArticle(a); })
      .catch(() => { if (alive) setArticle(null); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (article?.title) document.title = `${article.title} — Lemma`;
  }, [article?.title]);

  // Одна колонка всегда: «:::»-разрывы колонок на экране телефона не нужны.
  const html = useMarkdownProcessor(article?.content_md || '', 1);
  const toc = useMemo(() => tocFromHtml(html), [html]);

  // id заголовкам — для оглавления (порядок тот же, что в tocFromHtml).
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll('h2, h3').forEach((h, i) => { h.id = `t-sec-${i}`; });
  }, [html]);

  const applets = useMemo(() => {
    const list = article?.theme_settings?.geogebra_applets;
    return new Map(Array.isArray(list) ? list.filter((a) => a?.id).map((a) => [a.id, a]) : []);
  }, [article?.theme_settings]);

  useGeoGebraInjection(contentRef, html, applets);
  useStereoBlocks(contentRef, html);

  if (article === undefined) {
    return (
      <div className="sta sta--state">
        <div className="sta-spinner" aria-label="Загрузка" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="sta sta--state">
        <div className="sta-state">
          <h1>Статья недоступна</h1>
          <p>Её закрыли или в ссылке ошибка. Попросите у автора ссылку ещё раз.</p>
        </div>
      </div>
    );
  }

  const cat = article.expand?.category;
  const theme = printThemeClass(article.theme_settings?.pageSettings?.printTheme);

  return (
    <div className="sta">
      <article className="sta-article">
        <header className="sta-head">
          {cat?.title && (
            <div className="sta-eyebrow" style={cat.color ? { color: cat.color } : undefined}>{cat.title}</div>
          )}
          <h1 className="sta-title">{article.title}</h1>
          {article.summary && <p className="sta-summary">{article.summary}</p>}
          <div className="sta-meta">Обновлено {formatDate(article.updated)}</div>
        </header>

        {toc.length >= 3 && (
          <details className="sta-toc">
            <summary>Содержание</summary>
            <ol>
              {toc.map((t) => (
                <li key={t.id} className={`sta-toc__item sta-toc__item--h${t.level}`}>
                  <a href={`#${t.id}`}>{t.text}</a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div
          ref={contentRef}
          className={`theory-preview-content sta-content ${theme}`}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <footer className="sta-foot">
        Lemma — платформа для учителей математики ·{' '}
        <a href="https://github.com/evilfaust/lemma" target="_blank" rel="noopener noreferrer">исходный код открыт (AGPL-3.0)</a>
      </footer>
    </div>
  );
}
