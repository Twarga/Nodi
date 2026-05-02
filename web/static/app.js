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
      const currentPath = new URLSearchParams(window.location.search).get('path') || '/'
      const newPath = currentPath === '/' ? `/${name}` : `${currentPath.replace(/\/$/, '')}/${name}`
      
      const url = new URL(window.location)
      url.searchParams.set('path', newPath)
      window.history.pushState({}, '', url)
      
      refreshItems()
      updateBreadcrumbs(newPath)
    } else {
      window.location.href = `/api/download?path=${encodeURIComponent(name)}` // Adjust later
    }
  }

  function updateBreadcrumbs(path) {
    // This is tricky because breadcrumbs are SSR'd. 
    // For now, I'll just reload the page if path changes deeply, 
    // OR implement a simple breadcrumb generator in JS.
    // Let's implement a simple one.
    const container = document.getElementById('breadcrumbs-container')
    if (!container) return
    
    const segments = path.split('/').filter(Boolean)
    let html = `
      <nav class="flex items-center gap-1.5 text-sm font-medium overflow-x-auto no-scrollbar py-1">
        <a href="?path=/" onclick="event.preventDefault(); navigate('/')" class="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <svg class="h-4 w-4"><use href="/static/icons.svg#icon-home"></use></svg>
        </a>
    `
    
    let currentPath = ''
    segments.forEach((seg, i) => {
      currentPath += '/' + seg
      html += `
        <svg class="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"><use href="/static/icons.svg#icon-chevron-right"></use></svg>
        <a href="?path=${encodeURIComponent(currentPath)}" onclick="event.preventDefault(); navigate('${currentPath}')" 
           class="truncate max-w-[120px] transition-colors ${i === segments.length - 1 ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}">
          ${seg}
        </a>
      `
    })
    html += `</nav>`
    container.innerHTML = html
  }

  window.navigate = (path) => {
    const url = new URL(window.location)
    url.searchParams.set('path', path)
    window.history.pushState({}, '', url)
    refreshItems()
    updateBreadcrumbs(path)
  }

  window.addEventListener('popstate', () => {
    refreshItems()
    const path = new URLSearchParams(window.location.search).get('path') || '/'
    updateBreadcrumbs(path)
  })

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

  window.toast = (message, type = 'info') => {
    const container = document.getElementById('toast-container')
    if (!container) return

    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    
    // Simple icon selection
    let icon = 'info'
    if (type === 'success') icon = 'check-circle'
    if (type === 'error') icon = 'alert-circle'

    toast.innerHTML = `
      <svg class="toast-icon"><use href="/static/icons.svg#icon-${icon}"></use></svg>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg class="h-4 w-4"><use href="/static/icons.svg#icon-x"></use></svg>
      </button>
    `
    container.appendChild(toast)
    setTimeout(() => {
      toast.style.opacity = '0'
      toast.style.transform = 'translateX(10px)'
      setTimeout(() => toast.remove(), 200)
    }, 4000)
  }

  window.refreshItems = async () => {
    const path = new URLSearchParams(window.location.search).get('path') || '/'
    try {
      const resp = await fetch(`/browse?path=${encodeURIComponent(path)}`)
      if (!resp.ok) throw new Error('Failed to fetch')
      const files = await resp.json()
      renderItems(files)
    } catch (e) {
      console.error(e)
      toast('Failed to refresh file list', 'error')
    }
  }

  function renderItems(files) {
    const listContainer = document.getElementById('file-list-items')
    const gridContainer = document.getElementById('file-grid')
    
    if (!listContainer || !gridContainer) return

    if (files.length === 0) {
      const emptyState = `
        <li class="flex flex-col items-center justify-center py-20 opacity-40">
          <svg class="w-16 h-16 mb-4"><use href="/static/icons.svg#icon-folder"></use></svg>
          <p class="text-lg font-medium">This folder is empty</p>
        </li>
      `
      listContainer.innerHTML = emptyState
      gridContainer.innerHTML = ''
      return
    }

    listContainer.innerHTML = files.map(f => renderFileRow(f)).join('')
    gridContainer.innerHTML = files.map(f => renderFileCard(f)).join('')
  }

  function renderFileRow(f) {
    const icon = getIconForFile(f)
    const size = f.is_dir ? '--' : formatBytes(f.size)
    const date = new Date(f.mod_time).toLocaleDateString() // Simple for now
    
    return `
      <li class="group grid grid-cols-1 sm:grid-cols-[1fr_110px_160px_56px] items-center gap-4 px-4 py-2.5 hover:bg-surface-hover transition-all border-b border-border/50 last:border-0"
          onclick="onOpen('${f.name}', ${f.is_dir})">
        <div class="flex items-center gap-3 min-w-0">
          <svg class="h-5 w-5 shrink-0 ${icon.colorClass}"><use href="/static/icons.svg#${icon.id}"></use></svg>
          <span class="truncate text-sm font-medium">${f.name}</span>
        </div>
        <div class="hidden sm:block text-right text-xs text-muted-foreground tabular">${size}</div>
        <div class="hidden sm:block text-xs text-muted-foreground tabular">${date}</div>
        <div class="flex justify-end pr-1 relative" onclick="event.stopPropagation()">
            <button onclick="toggleMenu('${f.name}')" class="p-1.5 rounded-md hover:bg-surface-hover hover:text-foreground text-muted-foreground transition-colors">
                <svg class="h-4 w-4"><use href="/static/icons.svg#icon-more-vertical"></use></svg>
            </button>
            <div id="menu-${f.name}" class="hidden absolute right-0 top-9 w-44 rounded-md border border-border bg-popover py-1 shadow-lg z-40 animate-ql-pop-in">
                <button onclick="onDownload('${f.name}')" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                    <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-download"></use></svg> Download
                </button>
                <button onclick="onRename('${f.name}')" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                    <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-edit"></use></svg> Rename
                </button>
                <div class="my-1 border-t border-border"></div>
                <button onclick="onDelete('${f.name}')" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-surface-hover">
                    <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-trash"></use></svg> Delete
                </button>
            </div>
        </div>
      </li>
    `
  }

  function renderFileCard(f) {
    const icon = getIconForFile(f)
    return `
      <div class="group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4 text-center hover:bg-surface-hover transition-all hover:shadow-md cursor-pointer"
           onclick="onOpen('${f.name}', ${f.is_dir})">
        <div class="flex h-16 w-full items-center justify-center rounded-lg bg-background/40">
           <svg class="h-10 w-10 ${icon.colorClass}"><use href="/static/icons.svg#${icon.id}"></use></svg>
        </div>
        <div class="w-full flex-1 min-w-0">
          <p class="truncate text-[13px] font-medium px-1">${f.name}</p>
          <p class="text-[11px] text-muted-foreground mt-0.5 tabular">${f.is_dir ? 'Folder' : formatBytes(f.size)}</p>
        </div>
        
        <button onclick="event.stopPropagation(); toggleMenu('${f.name}')" 
                class="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface transition-all text-muted-foreground">
           <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-more-vertical"></use></svg>
        </button>
        
        <div id="menu-grid-${f.name}" class="hidden absolute right-2 top-8 w-40 rounded-md border border-border bg-popover py-1 shadow-lg z-40 animate-ql-pop-in text-left">
            <button onclick="onDownload('${f.name}')" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-download"></use></svg> Download
            </button>
            <button onclick="onRename('${f.name}')" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-edit"></use></svg> Rename
            </button>
            <div class="my-1 border-t border-border"></div>
            <button onclick="onDelete('${f.name}')" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-surface-hover">
                <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-trash"></use></svg> Delete
            </button>
        </div>
      </div>
    `
  }

  function getIconForFile(f) {
    if (f.is_dir) return { id: 'icon-folder', colorClass: 'text-icon-folder' }
    const mime = f.mime || ''
    if (mime.startsWith('image/')) return { id: 'icon-image', colorClass: 'text-icon-image' }
    if (mime === 'application/pdf') return { id: 'icon-file-text', colorClass: 'text-icon-pdf' }
    if (mime.startsWith('video/')) return { id: 'icon-video', colorClass: 'text-icon-video' }
    return { id: 'icon-file', colorClass: 'text-icon-generic' }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Update existing submit handlers to use refreshItems and toast
  const originalOnCreateFolderSubmit = window.onCreateFolderSubmit
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
        toast(`Folder "${name}" created`, 'success')
        refreshItems()
      } else {
        const err = await resp.text()
        toast(err, 'error')
      }
    } catch (e) {
      console.error(e)
      toast('Failed to create folder', 'error')
    }
  }

  const originalOnRenameSubmit = window.onRenameSubmit
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
        toast(`Renamed to "${newName}"`, 'success')
        refreshItems()
      } else {
        const err = await resp.text()
        toast(err, 'error')
      }
    } catch (e) {
      console.error(e)
      toast('Failed to rename', 'error')
    }
  }

  const originalOnDeleteConfirm = window.onDeleteConfirm
  window.onDeleteConfirm = async () => {
    const path = document.getElementById('delete-path').value
    const name = document.getElementById('delete-item-name').textContent

    try {
      const resp = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      })

      if (resp.ok) {
        closeModal('delete')
        toast(`"${name}" deleted`, 'success')
        refreshItems()
      } else {
        const err = await resp.text()
        toast(err, 'error')
      }
    } catch (e) {
      console.error(e)
      toast('Failed to delete', 'error')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
