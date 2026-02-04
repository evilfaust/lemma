import { useEffect, useCallback } from 'react'

export function useKeyboardShortcuts({
    onSave,
    onLoad,
    onInsertInlineFormula,
    onInsertBlockFormula
}) {
    const handleKeyDown = useCallback((e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

        if (cmdOrCtrl && e.key === 's') {
            e.preventDefault()
            onSave?.()
        }

        if (cmdOrCtrl && e.key === 'o') {
            e.preventDefault()
            onLoad?.()
        }

        if (cmdOrCtrl && e.key === 'i') {
            e.preventDefault()
            onInsertInlineFormula?.()
        }

        if (cmdOrCtrl && e.key === 'b') {
            e.preventDefault()
            onInsertBlockFormula?.()
        }
    }, [onSave, onLoad, onInsertInlineFormula, onInsertBlockFormula])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
