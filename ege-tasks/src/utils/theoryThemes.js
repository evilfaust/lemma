// Размеры страницы по формату и ориентации
export const getPageDimensions = (pageSize, orientation) => {
    const sizes = {
        A4: { width: 210, height: 297 },
        A5: { width: 148, height: 210 }
    }
    const size = sizes[pageSize] || sizes.A4

    if (orientation === 'landscape') {
        return { width: size.height, height: size.width }
    }
    return size
}

export const DEFAULT_SETTINGS = {
    pageSize: 'A4',
    orientation: 'portrait',
    columns: 1,
    marginTop: 12,
    marginBottom: 12,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16,
    // Стиль печати листа — см. § Печатные темы ниже.
    printTheme: 'classic'
}

// Печать статьи: поля задаём через @page margin (а не padding'ом листа), чтобы
// браузер резервировал их на КАЖДОЙ странице — иначе со 2-й страницы верхний
// отступ пропадает. Печатный CSS (@media print) при этом снимает собственный
// padding листа, чтобы поля не задвоились. Стиль временный.
export const printWithPageSize = (pageSettings = DEFAULT_SETTINGS) => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation)
    const mT = pageSettings.marginTop ?? DEFAULT_SETTINGS.marginTop
    const mR = pageSettings.marginRight ?? DEFAULT_SETTINGS.marginRight
    const mB = pageSettings.marginBottom ?? DEFAULT_SETTINGS.marginBottom
    const mL = pageSettings.marginLeft ?? DEFAULT_SETTINGS.marginLeft
    const style = document.createElement('style')
    style.setAttribute('data-theory-print', '')
    style.textContent = `@page { size: ${dims.width}mm ${dims.height}mm; margin: ${mT}mm ${mR}mm ${mB}mm ${mL}mm; }`
    document.head.appendChild(style)
    window.print()
    setTimeout(() => style.remove(), 1000)
}

/* ── Печатные темы ──────────────────────────────────────────────────────────
   Тем две. «Классика» — исторический стиль теории (тёмная плашка H1, цветные
   каллауты, зебра в таблицах); он остаётся дефолтом, старые статьи печатаются
   как печатались. «Лист» — язык движка print-sheet (components/print-sheet):
   только чёрная краска, иерархия кеглем и толщиной линеек (0.5 / 0.35 / 0.25 мм
   и 0.2 pt), никаких заливок — лист не зависит от галки «печатать фоны» в
   диалоге браузера и не выцветает на ч/б принтере.
   Стили темы — components/theory/themeSheet.css.
   ────────────────────────────────────────────────────────────────────────── */

export const PRINT_THEMES = [
    { value: 'classic', label: 'Классика' },
    { value: 'sheet', label: 'Лист' },
]

export const DEFAULT_PRINT_THEME = 'classic'

export const isPrintTheme = (theme) => PRINT_THEMES.some(t => t.value === theme)

export const normalizePrintTheme = (theme) =>
    isPrintTheme(theme) ? theme : DEFAULT_PRINT_THEME

// Класс-модификатор на .theory-preview-content (он же печатный корень).
export const printThemeClass = (theme) =>
    normalizePrintTheme(theme) === 'sheet' ? 'theory-sheet' : 'theory-classic'

// Выбор темы вне статьи (конспект из нескольких статей) помнится в браузере:
// своей записи в БД у сборника нет.
const PRINT_THEME_LS_KEY = 'theory.printTheme'

export const loadPrintTheme = () => {
    try {
        return normalizePrintTheme(localStorage.getItem(PRINT_THEME_LS_KEY))
    } catch {
        return DEFAULT_PRINT_THEME
    }
}

export const savePrintTheme = (theme) => {
    try {
        localStorage.setItem(PRINT_THEME_LS_KEY, normalizePrintTheme(theme))
    } catch {
        /* приватное окно — переживём */
    }
}
