// Calculate page dimensions based on size and orientation
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
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 15,
    marginRight: 15,
    fontSize: 16
}

export const THEME_NAMES = {
    classic: 'Классическая',
    notebook: 'Тетрадь'
}

// Theme styles generator for PDF export and preview
export const getThemeStyles = (theme, settings) => {
    const { pageSize, orientation, columns, marginTop, marginBottom, marginLeft, marginRight, fontSize } = settings
    const dims = getPageDimensions(pageSize, orientation)
    const width = `${dims.width}mm`
    const height = `${dims.height}mm`
    const isMultiColumn = columns > 1

    let styles = `
      .page {
        width: ${width};
        height: ${height};
        padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
        margin: 0 auto;
        background: white;
        font-size: ${fontSize}px;
        line-height: 1.3;
        box-sizing: border-box;
        overflow: hidden;
      }
      ${isMultiColumn ? `
      .page {
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        column-gap: 15px;
        align-content: start;
      }
      .col-section {
        min-width: 0;
      }
      .page > :not(.col-section) {
        grid-column: 1 / -1;
      }
      .col-section + .col-section {
        border-left: 1px solid #ccc;
        padding-left: 15px;
      }
      ` : ''}
      h1 {
        font-size: ${fontSize * 1.4}px;
        margin: 0 0 6px 0;
      }
      h2 {
        font-size: ${fontSize * 1.2}px;
        margin: 8px 0 4px 0;
      }
      h3 {
        font-size: ${fontSize * 1.1}px;
        margin: 6px 0 3px 0;
      }
      h4 {
        font-size: ${fontSize}px;
        margin: 5px 0 2px 0;
      }
      p { margin: 0 0 6px 0; }
      strong { font-weight: bold; }
      em { font-style: italic; }
      ul, ol { margin: 0 0 6px 16px; padding: 0; }
      li { margin: 0 0 2px 0; }
      img { max-width: 100%; height: auto; display: block; margin: 6px auto; }
      .katex { font-size: 1em; }
      .katex-display { margin: 8px 0; text-align: center; }
      blockquote { margin: 4px 0 4px 10px; padding-left: 8px; border-left: 2px solid #ccc; }
      code { font-size: 0.9em; background: #f5f5f5; padding: 1px 3px; border-radius: 2px; }
      pre { margin: 6px 0; padding: 6px; background: #f5f5f5; overflow-x: auto; font-size: 0.85em; }
      hr { margin: 6px 0; border: none; border-top: 1px solid #ddd; }
      .vspace { display: block; height: 1em; margin: 0; padding: 0; }
      .vspace-sm { display: block; height: 0.5em; margin: 0; padding: 0; }
      .vspace-lg { display: block; height: 2em; margin: 0; padding: 0; }
    `

    const themeStyles = {
        classic: `
            .page { font-family: 'Georgia', 'Times New Roman', serif; }
            h1 { color: #2c3e50; border-bottom: 1px solid #3498db; padding-bottom: 4px; }
            h2, h3 { color: #34495e; }
        `,
        notebook: `
            .page {
              font-family: 'Georgia', 'Times New Roman', serif;
              background-image: radial-gradient(circle, #c0c8d0 1px, transparent 1px);
              background-size: 5mm 5mm;
              background-position: 0 0;
            }
            h1 { color: #2c3e50; border-bottom: 1px solid #3498db; padding-bottom: 4px; }
            h2, h3 { color: #34495e; }
        `
    }

    return styles + (themeStyles[theme] || themeStyles.classic)
}
