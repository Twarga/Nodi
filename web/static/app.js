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

    // Global menu management
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[id^="menu-"]') && !e.target.closest('button[onclick*="toggleMenu"]')) {
        closeAllMenus()
      }
    })

    // ESC key listener for modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllMenus()
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
           if(!m.classList.contains('hidden')) closeModal(m.id.replace('modal-', ''))
        })
      }
    })
  }

  // --- Modal Logic ---
  window.showModal = (id) => {
    const modal = document.getElementById(`modal-${id}`)
    if (modal) {
      modal.classList.remove('hidden')
      const input = modal.querySelector('input[autofocus]')
      if (input) setTimeout(() => input.focus(), 50)
    }
  }

  window.closeModal = (id) => {
    const modal = document.getElementById(`modal-${id}`)
    if (modal) modal.classList.add('hidden')
  }

  // --- Context Menu Logic ---
  window.toggleMenu = (name) => {
    const menu = document.getElementById(`menu-${name}`) || document.getElementById(`menu-grid-${name}`)
    const isOpen = menu && !menu.classList.contains('hidden')
    closeAllMenus()
    if (menu && !isOpen) {
      menu.classList.remove('hidden')
    }
  }

  window.closeAllMenus = () => {
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.classList.add('hidden'))
  }

  // --- File Actions ---
  window.onCreateFolderSubmit = async () => {
    const form = document.getElementById('create-folder-form')
    const name = form.name.value
    const path = new URLSearchParams(window.location.search).get('path') || '/'

    try {
      const resp = await fetch('/api/folder/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name })
      })

      if (resp.ok) {
        closeModal('create-folder')
        form.reset()
        window.location.reload() // Simple for now
      } else {
        const err = await resp.text()
        alert(err)
      }
    } catch (e) {
      console.error(e)
      alert('Internal error')
    }
  }

  window.onOpen = (name, isDir) => {
    if (isDir) {
      console.log('Opening directory:', name)
      // TODO: Implement navigation
    } else {
      console.log('Opening file:', name)
      // TODO: Implement preview/download
    }
  }

  window.onDownload = (name) => {
    console.log('Downloading:', name)
  }

  window.onRename = (name) => {
    const path = new URLSearchParams(window.location.search).get('path') || '/'
    const oldPath = path === '/' ? `/${name}` : `${path.replace(/\/$/, '')}/${name}`
    
    const form = document.getElementById('rename-form')
    form.oldPath.value = oldPath
    form.newName.value = name
    
    showModal('rename')
    closeAllMenus()
  }

  window.onRenameSubmit = async () => {
    const form = document.getElementById('rename-form')
    const oldPath = form.oldPath.value
    const newName = form.newName.value

    try {
      const resp = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newName })
      })

      if (resp.ok) {
        closeModal('rename')
        form.reset()
        window.location.reload()
      } else {
        const err = await resp.text()
        alert(err)
      }
    } catch (e) {
      console.error(e)
      alert('Internal error')
    }
  }

  window.onDelete = (name) => {
    const path = new URLSearchParams(window.location.search).get('path') || '/'
    const fullPath = path === '/' ? `/${name}` : `${path.replace(/\/$/, '')}/${name}`
    
    document.getElementById('delete-path').value = fullPath
    document.getElementById('delete-item-name').textContent = name
    
    showModal('delete')
    closeAllMenus()
  }

  window.onDeleteConfirm = async () => {
    const path = document.getElementById('delete-path').value

    try {
      const resp = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      })

      if (resp.ok) {
        closeModal('delete')
        window.location.reload()
      } else {
        const err = await resp.text()
        alert(err)
      }
    } catch (e) {
      console.error(e)
      alert('Internal error')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
