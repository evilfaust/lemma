import { useMemo } from 'react'

export function useDocumentStats(markdown) {
    return useMemo(() => {
        const textOnly = markdown
            .replace(/\$\$[\s\S]*?\$\$/g, '')
            .replace(/\$[^$]*\$/g, '')
            .replace(/[#*`\[\]()>-]/g, '')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[.*?\]\(.*?\)/g, '')
            .trim()

        const words = textOnly.split(/\s+/).filter(word => word.length > 0).length

        const blockFormulas = (markdown.match(/\$\$[\s\S]*?\$\$/g) || []).length
        const inlineFormulas = (markdown.match(/\$[^$]+\$/g) || []).length
        const totalFormulas = blockFormulas + inlineFormulas

        const chars = markdown.replace(/\s/g, '').length

        return {
            words,
            formulas: totalFormulas,
            chars
        }
    }, [markdown])
}
