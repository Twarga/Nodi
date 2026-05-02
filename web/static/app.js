(() => {
  const STORAGE_KEY = 'ql-theme'
  const SYSTEM_THEME = 'system'
  const themes = [SYSTEM_THEME, 'light', 'dark']

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch { /* ignore */ }
  }

  function applyTheme(theme) {
    const active = theme === SYSTEM_THEME ? getSystemTheme() : theme
    document.documentElement.classList.toggle('dark', active === 'dark')
  }

  function getCurrentTheme() {
    return getStoredTheme() || SYSTEM_THEME
  }

  function cycleTheme() {
    const current = getCurrentTheme()
    const idx = themes.indexOf(current)
    const next = themes[(idx + 1) % themes.length]
    setStoredTheme(next)
    applyTheme(next)
    updateToggleButton(next)
  }

  function updateToggleButton(theme) {
    const btn = document.getElementById('theme-toggle')
    if (!btn) return
    const icon = btn.querySelector('.theme-icon')
    if (!icon) return

    if (theme === SYSTEM_THEME) {
      const active = getSystemTheme()
      icon.innerHTML = active === 'dark'
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
      btn.setAttribute('aria-label', 'System theme')
    } else if (theme === 'dark') {
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      btn.setAttribute('aria-label', 'Dark theme')
    } else {
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
      btn.setAttribute('aria-label', 'Light theme')
    }
  }

  function init() {
    const theme = getCurrentTheme()
    applyTheme(theme)
    updateToggleButton(theme)

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getCurrentTheme() === SYSTEM_THEME) {
        applyTheme(SYSTEM_THEME)
        updateToggleButton(SYSTEM_THEME)
      }
    })

    const toggleBtn = document.getElementById('theme-toggle')
    if (toggleBtn) {
      toggleBtn.addEventListener('click', cycleTheme)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
