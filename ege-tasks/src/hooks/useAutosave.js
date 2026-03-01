import { useEffect, useRef } from 'react'

const AUTOSAVE_PREFIX = 'theory-editor-autosave'
const AUTOSAVE_SETTINGS_PREFIX = 'theory-editor-settings'
const AUTOSAVE_INTERVAL = 30000

export function useAutosave(markdown, pageSettings, currentTheme, articleId = null, extraSettings = {}) {
    const intervalRef = useRef(null)
    const key = articleId ? `${AUTOSAVE_PREFIX}-${articleId}` : AUTOSAVE_PREFIX
    const settingsKey = articleId ? `${AUTOSAVE_SETTINGS_PREFIX}-${articleId}` : AUTOSAVE_SETTINGS_PREFIX

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            localStorage.setItem(key, markdown)
            localStorage.setItem(settingsKey, JSON.stringify({
                pageSettings,
                currentTheme,
                ...extraSettings
            }))
        }, AUTOSAVE_INTERVAL)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [markdown, pageSettings, currentTheme, key, settingsKey, extraSettings])

    useEffect(() => {
        localStorage.setItem(key, markdown)
    }, [markdown, key])
}

export function loadAutosave(articleId = null) {
    const key = articleId ? `${AUTOSAVE_PREFIX}-${articleId}` : AUTOSAVE_PREFIX
    const settingsKey = articleId ? `${AUTOSAVE_SETTINGS_PREFIX}-${articleId}` : AUTOSAVE_SETTINGS_PREFIX

    const content = localStorage.getItem(key)
    const settingsStr = localStorage.getItem(settingsKey)

    let settings = null
    if (settingsStr) {
        try {
            settings = JSON.parse(settingsStr)
        } catch (e) {
            console.error('Failed to parse autosave settings:', e)
        }
    }

    return { content, settings }
}

export function clearAutosave(articleId = null) {
    const key = articleId ? `${AUTOSAVE_PREFIX}-${articleId}` : AUTOSAVE_PREFIX
    const settingsKey = articleId ? `${AUTOSAVE_SETTINGS_PREFIX}-${articleId}` : AUTOSAVE_SETTINGS_PREFIX
    localStorage.removeItem(key)
    localStorage.removeItem(settingsKey)
}
