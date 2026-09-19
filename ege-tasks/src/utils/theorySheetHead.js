/* Шапка печатного листа темы «Лист» (см. utils/theoryThemes.js § Печатные темы).
 *
 * Повторяет шапку движка print-sheet (components/print-sheet/SheetHeader.jsx,
 * режим 'full'): надзаголовок → название → подзаголовок → метастрока, снизу
 * жирная линейка 0.5 мм. Отличие одно: здесь шапка не React-компонент, а
 * строка HTML — печатный корень теории рисуется через dangerouslySetInnerHTML
 * и детей не принимает, а шапке нужно быть ПРЯМЫМ потомком .theory-preview-content
 * (в две колонки сетка раздаёт колонки прямым потомкам, см. themes.css).
 *
 * На экране статьи заголовок живёт в .theory-article-header с классом no-print,
 * то есть в печать не идёт вовсе: без этой шапки распечатанная статья приходит
 * к ученику безымянной.
 */

const esc = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Отрывает от готового HTML ведущий <h1> — он становится названием в шапке,
 * иначе заголовок статьи напечатался бы дважды.
 *
 * В две колонки postprocess() уже завернул контент в .col-section, поэтому
 * обёртку пропускаем и возвращаем на место: резать её нельзя, на ней держится
 * сетка колонок.
 *
 * @returns {{ titleHtml: string|null, rest: string }}
 */
export function splitLeadingH1(html = '') {
    const m = String(html).match(/^(\s*(?:<div class="col-section">\s*)?)<h1\b[^>]*>([\s\S]*?)<\/h1>/)
    if (!m) return { titleHtml: null, rest: String(html) }
    return {
        titleHtml: m[2].trim(),
        rest: m[1] + String(html).slice(m[0].length),
    }
}

/**
 * @param {Object}   opts
 * @param {string}  [opts.eyebrow]       надзаголовок (категория, «Конспект»)
 * @param {string}  [opts.titleHtml]     готовая разметка названия (из <h1>) —
 *                                       уже прошла DOMPurify, формулы сохраняются
 * @param {string}  [opts.title]         название простым текстом (экранируется)
 * @param {string}  [opts.subtitle]      подзаголовок (аннотация статьи)
 * @param {Array}   [opts.meta]          метастрока: элементы через «·»
 * @returns {string} HTML шапки или '' — печатать нечего
 */
export function sheetHeadHtml({ eyebrow, titleHtml, title, subtitle, meta = [] } = {}) {
    const parts = (meta || []).filter(Boolean)
    const head = titleHtml || (title ? esc(title) : '')
    if (!head && !eyebrow && !subtitle && !parts.length) return ''

    return [
        '<div class="theory-sheet-head">',
        eyebrow ? `<div class="theory-sheet-head__eyebrow">${esc(eyebrow)}</div>` : '',
        head ? `<div class="theory-sheet-head__title">${head}</div>` : '',
        subtitle ? `<div class="theory-sheet-head__subtitle">${esc(subtitle)}</div>` : '',
        parts.length
            ? `<div class="theory-sheet-head__meta">${parts.map(p => esc(p))
                .join('<span class="theory-sheet-head__sep">·</span>')}</div>`
            : '',
        '</div>',
    ].join('')
}

/**
 * Приклеивает шапку к готовому HTML статьи. В теме «Классика» возвращает HTML
 * как есть — старый лист не меняется.
 *
 * @param {string}  html                  результат useMarkdownProcessor
 * @param {Object}  opts
 * @param {boolean} opts.enabled          тема «Лист» включена
 * @param {boolean} [opts.absorbH1=true]  забрать ведущий <h1> в название шапки
 */
export function withSheetHead(html = '', { enabled, absorbH1 = true, ...head } = {}) {
    if (!enabled) return html
    const { titleHtml, rest } = absorbH1
        ? splitLeadingH1(html)
        : { titleHtml: null, rest: html }
    return sheetHeadHtml({ ...head, titleHtml: titleHtml || undefined }) + rest
}
