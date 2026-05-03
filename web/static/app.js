(() => {
  const STORAGE_KEY = 'ql-theme'
  const SYSTEM_THEME = 'system'
  const themes = [SYSTEM_THEME, 'light', 'dark']
  const selectedNames = new Set()

  function getCSRFToken() {
    const match = document.cookie.match(/ql_csrf=([^;]+)/)
    return match ? match[1] : ''
  }

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

  function getCurrentPath() {
    return new URLSearchParams(window.location.search).get('path') || '/'
  }

  function joinPath(base, name) {
    return base === '/' ? `/${name}` : `${base.replace(/\/$/, '')}/${name}`
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char])
  }

  function escapeJSString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  }

  function fileKey(name) {
    return encodeURIComponent(name).replace(/[^a-zA-Z0-9_-]/g, '_')
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
    const buttons = document.querySelectorAll('#theme-toggle, [data-theme-toggle]')
    if (buttons.length === 0) return
    const active = theme === SYSTEM_THEME ? getSystemTheme() : theme
    const label = theme === SYSTEM_THEME ? `System theme (${active})` : `${theme[0].toUpperCase()}${theme.slice(1)} theme`
    const iconMarkup = active === 'dark'
      ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'

    buttons.forEach((btn) => {
      const icon = btn.querySelector('.theme-icon')
      if (icon) icon.innerHTML = iconMarkup
      btn.setAttribute('aria-label', label)
      btn.setAttribute('title', `Theme: ${theme}`)
    })
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

    document.querySelectorAll('#theme-toggle, [data-theme-toggle]').forEach((toggleBtn) => {
      toggleBtn.addEventListener('click', cycleTheme)
    })

    initViewToggle()
    initUploadButton()
    initLoginForm()
    updateSelectionUI()

    // Event delegation for file actions (replaces inline onclick handlers)
    document.addEventListener('click', (e) => {
      const target = e.target

      // If clicked inside a stop-propagation container without a specific action,
      // don't let it bubble to parent actions (e.g. clicking checkbox container)
      const stopContainer = target.closest('[data-stop-propagation]')
      const actionEl = target.closest('[data-action]')

      if (!actionEl) {
        // Clicked outside menus — close them
        if (!target.closest('[id^="menu-"]')) {
          closeAllMenus()
        }
        return
      }

      // If inside stop-propagation and the action is on an ancestor, ignore
      if (stopContainer && !stopContainer.contains(actionEl) && actionEl.contains(stopContainer)) {
        return
      }

      const action = actionEl.dataset.action
      const name = actionEl.dataset.name

      if (action === 'open') {
        const isDir = actionEl.dataset.isDir === 'true'
        onOpen(name, isDir)
        return
      }

      if (action === 'toggle-menu') {
        e.stopPropagation()
        toggleMenu(name)
        return
      }

      if (action === 'download') {
        e.stopPropagation()
        onDownload(name)
        return
      }

      if (action === 'rename') {
        e.stopPropagation()
        onRename(name)
        return
      }

      if (action === 'delete') {
        e.stopPropagation()
        onDelete(name)
        return
      }

      if (action === 'dismiss-toast') {
        actionEl.closest('.toast')?.remove()
        return
      }
    })

    document.addEventListener('change', (e) => {
      const target = e.target
      if (target.dataset.action === 'toggle-select') {
        toggleSelection(target.dataset.name, target.checked)
      }
    })

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return
      }

      if (e.key === 'Escape') {
        closeAllMenus()
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
          if (!m.classList.contains('hidden')) closeModal(m.id.replace('modal-', ''))
        })
        clearSelection()
        return
      }

      if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        onBulkDelete()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAllVisible()
        return
      }

      if (e.key === 'Enter') {
        const names = getSelectableNames()
        if (names.length > 0) {
          const selected = Array.from(selectedNames)
          const target = selected.length > 0 ? selected[0] : names[0]
          const item = document.querySelector(`.selectable-item[data-name="${escapeHTML(target)}"]`)
          if (item) {
            const isDir = item.dataset.isDir === 'true'
            onOpen(target, isDir)
          }
        }
        return
      }

      if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const path = getCurrentPath()
        const parent = path.lastIndexOf('/') > 0 ? path.substring(0, path.lastIndexOf('/')) : '/'
        navigate(parent)
        return
      }
    })

    // Drag and Drop Logic
    const overlay = document.getElementById('drop-overlay')
    let dragCounter = 0

    window.addEventListener('dragenter', (e) => {
      e.preventDefault()
      dragCounter++
      if (overlay) overlay.classList.remove('hidden')
    })

    window.addEventListener('dragleave', (e) => {
      e.preventDefault()
      dragCounter--
      if (dragCounter === 0 && overlay) overlay.classList.add('hidden')
    })

    window.addEventListener('dragover', (e) => {
      e.preventDefault()
    })

    window.addEventListener('drop', (e) => {
      e.preventDefault()
      dragCounter = 0
      if (overlay) overlay.classList.add('hidden')
      
      const files = e.dataTransfer.files
      if (files.length > 0) {
        onUpload(files)
      }
    })
  }

  function initViewToggle() {
    const listBtn = document.getElementById('view-list-btn')
    const gridBtn = document.getElementById('view-grid-btn')
    const list = document.getElementById('file-list')
    const grid = document.getElementById('file-grid')
    if (!listBtn || !gridBtn || !list || !grid) return

    const setView = (view) => {
      const isGrid = view === 'grid'
      list.classList.toggle('hidden', isGrid)
      grid.classList.toggle('hidden', !isGrid)
      listBtn.classList.toggle('is-active', !isGrid)
      gridBtn.classList.toggle('is-active', isGrid)
      listBtn.setAttribute('aria-pressed', String(!isGrid))
      gridBtn.setAttribute('aria-pressed', String(isGrid))
      try {
        localStorage.setItem('ql-view', view)
      } catch { /* ignore */ }
    }

    listBtn.addEventListener('click', () => setView('list'))
    gridBtn.addEventListener('click', () => setView('grid'))

    try {
      setView(localStorage.getItem('ql-view') === 'grid' ? 'grid' : 'list')
    } catch {
      setView('list')
    }
  }

  function initUploadButton() {
    const uploadBtn = document.getElementById('upload-btn')
    if (!uploadBtn) return

    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.hidden = true
    input.addEventListener('change', () => {
      if (input.files && input.files.length > 0) {
        onUpload(input.files)
      }
      input.value = ''
    })
    document.body.appendChild(input)
    uploadBtn.addEventListener('click', () => input.click())
  }

  function initLoginForm() {
    const form = document.getElementById('login-form')
    if (!form) return

    const username = document.getElementById('username')
    const password = document.getElementById('password')
    const error = document.getElementById('login-error')
    const submit = document.getElementById('login-submit')
    const spinner = document.getElementById('login-spinner')
    const label = document.getElementById('login-btn-text')

    const setError = (message) => {
      if (!error) return
      error.textContent = message
      error.classList.remove('hidden')
    }

    const clearError = () => {
      if (!error) return
      error.textContent = ''
      error.classList.add('hidden')
    }

    const setLoading = (loading) => {
      if (submit) submit.disabled = loading
      if (spinner) spinner.classList.toggle('hidden', !loading)
      if (label) label.textContent = loading ? 'Signing in...' : 'Login'
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      clearError()

      const usernameValue = username ? username.value.trim() : ''
      const passwordValue = password ? password.value : ''

      if (!usernameValue || !passwordValue) {
        setError('Enter both username and password.')
        return
      }

      setLoading(true)
      try {
        const resp = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          body: JSON.stringify({ username: usernameValue, password: passwordValue })
        })

        if (resp.ok) {
          window.location.assign('/')
          return
        }

        if (resp.status === 429) {
          setError('Too many login attempts. Wait a few minutes before trying again.')
          return
        }

        let message = 'Invalid username or password.'
        try {
          const data = await resp.json()
          if (data && data.message) message = data.message
        } catch { /* keep default */ }
        setError(message)
      } catch {
        setError('Could not reach the server. Check that Nodi is running.')
      } finally {
        setLoading(false)
      }
    })
  }

  window.onUpload = (files) => {
    const panel = document.getElementById('upload-panel')
    const list = document.getElementById('upload-list')
    if (!panel || !list) return

    panel.classList.add('active')
    
    Array.from(files).forEach((file, index) => {
      const id = `upload-${Date.now()}-${index}`
      const item = document.createElement('div')
      item.className = 'upload-item'
      item.id = id
      item.innerHTML = `
        <div class="flex items-center justify-between gap-3 overflow-hidden">
          <span class="truncate text-sm font-medium">${escapeHTML(file.name)}</span>
          <span class="upload-status text-[10px] tabular uppercase text-muted-foreground">Pending</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar w-0"></div>
        </div>
      `
      list.prepend(item)

      const formData = new FormData()
      formData.append('path', getCurrentPath())
      formData.append('files', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload', true)
      xhr.setRequestHeader('X-CSRF-Token', getCSRFToken())

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          const bar = item.querySelector('.progress-bar')
          const status = item.querySelector('.upload-status')
          if (bar) bar.style.width = `${percent}%`
          if (status) status.textContent = `${percent}%`
        }
      }

      xhr.onload = () => {
        const status = item.querySelector('.upload-status')
        if (xhr.status === 200) {
          let result = null
          try {
            const results = JSON.parse(xhr.responseText)
            result = Array.isArray(results) ? results[0] : null
          } catch { /* handled below */ }

          if (result && result.error) {
            if (status) {
              status.textContent = 'Failed'
              status.classList.replace('text-muted-foreground', 'text-destructive')
            }
            const bar = item.querySelector('.progress-bar')
            if (bar) {
              bar.style.width = '100%'
              bar.classList.add('bg-destructive')
            }
            toast(`${file.name}: ${result.error}`, 'error')
            return
          }

          if (status) {
            status.textContent = 'Complete'
            status.classList.replace('text-muted-foreground', 'text-success')
          }
          refreshItems()
        } else {
          if (status) {
            status.textContent = 'Error'
            status.classList.replace('text-muted-foreground', 'text-destructive')
          }
          toast(`Upload failed for ${file.name}`, 'error')
        }
        
        // Hide panel if all items are done (optional polish)
      }

      xhr.onerror = () => {
        const status = item.querySelector('.upload-status')
        if (status) {
          status.textContent = 'Failed'
          status.classList.replace('text-muted-foreground', 'text-destructive')
        }
        toast(`Network error during upload of ${file.name}`, 'error')
      }

      xhr.send(formData)
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
    const key = fileKey(name)
    const menu = document.getElementById(`menu-${key}`) ||
      document.getElementById(`menu-grid-${key}`) ||
      document.getElementById(`menu-${name}`) ||
      document.getElementById(`menu-grid-${name}`)
    const isOpen = menu && !menu.classList.contains('hidden')
    closeAllMenus()
    if (menu && !isOpen) {
      menu.classList.remove('hidden')
    }
  }

  window.closeAllMenus = () => {
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.classList.add('hidden'))
  }

  function getSelectableNames() {
    return Array.from(document.querySelectorAll('.selectable-item[data-name]'))
      .map((item) => item.dataset.name)
      .filter(Boolean)
      .filter((name, index, names) => names.indexOf(name) === index)
  }

  function updateSelectionUI() {
    const visibleNames = new Set(getSelectableNames())
    Array.from(selectedNames).forEach((name) => {
      if (!visibleNames.has(name)) selectedNames.delete(name)
    })

    document.querySelectorAll('.selectable-item[data-name]').forEach((item) => {
      const selected = selectedNames.has(item.dataset.name)
      item.classList.toggle('is-selected', selected)
    })

    document.querySelectorAll('.item-selector[data-name]').forEach((input) => {
      input.checked = selectedNames.has(input.dataset.name)
    })

    const count = selectedNames.size
    const bar = document.getElementById('selection-bar')
    const countEl = document.getElementById('selection-count')
    if (bar) bar.classList.toggle('hidden', count === 0)
    if (countEl) countEl.textContent = count === 1 ? '1 selected' : `${count} selected`

    const allBox = document.getElementById('select-all-checkbox')
    if (allBox) {
      const names = getSelectableNames()
      allBox.checked = names.length > 0 && names.every((name) => selectedNames.has(name))
      allBox.indeterminate = names.some((name) => selectedNames.has(name)) && !allBox.checked
    }
  }

  window.toggleSelection = (name, selected) => {
    if (selected) {
      selectedNames.add(name)
    } else {
      selectedNames.delete(name)
    }
    updateSelectionUI()
  }

  window.toggleSelectAll = (selected) => {
    getSelectableNames().forEach((name) => {
      if (selected) selectedNames.add(name)
      else selectedNames.delete(name)
    })
    updateSelectionUI()
  }

  window.selectAllVisible = () => {
    getSelectableNames().forEach((name) => selectedNames.add(name))
    updateSelectionUI()
  }

  window.clearSelection = () => {
    selectedNames.clear()
    updateSelectionUI()
  }

  window.onBulkDelete = () => {
    if (selectedNames.size === 0) return
    const names = Array.from(selectedNames)
    const countEl = document.getElementById('bulk-delete-count')
    const listEl = document.getElementById('bulk-delete-list')
    if (countEl) countEl.textContent = names.length === 1 ? '1 selected item' : `${names.length} selected items`
    if (listEl) {
      listEl.innerHTML = names.map((name) => `<div class="truncate py-1">${escapeHTML(name)}</div>`).join('')
    }
    showModal('bulk-delete')
  }

  window.onBulkDeleteConfirm = async () => {
    const names = Array.from(selectedNames)
    if (names.length === 0) {
      closeModal('bulk-delete')
      return
    }

    const failures = []
    for (const name of names) {
      const path = joinPath(getCurrentPath(), name)
      try {
        const resp = await fetch('/api/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          body: JSON.stringify({ path })
        })
        if (!resp.ok) {
          const err = await resp.text()
          failures.push(`${name}: ${err || resp.statusText}`)
        }
      } catch {
        failures.push(`${name}: network error`)
      }
    }

    closeModal('bulk-delete')
    clearSelection()
    await refreshItems()

    if (failures.length > 0) {
      toast(`Deleted with ${failures.length} failure${failures.length === 1 ? '' : 's'}`, 'error')
      console.error('Bulk delete failures:', failures)
    } else {
      toast(`Deleted ${names.length} item${names.length === 1 ? '' : 's'}`, 'success')
    }
  }

  // --- File Actions ---
  window.onCreateFolderSubmit = async () => {
    const form = document.getElementById('create-folder-form')
    const name = form.name.value
    const path = new URLSearchParams(window.location.search).get('path') || '/'

    try {
      const resp = await fetch('/api/folder/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
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
      clearSelection()
      const newPath = joinPath(getCurrentPath(), name)
      const url = new URL(window.location)
      url.searchParams.set('path', newPath)
      window.history.pushState({}, '', url)
      refreshItems()
      updateBreadcrumbs(newPath)
    } else {
      const ext = (name || '').split('.').pop().toLowerCase()
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
      const videoExts = ['mp4', 'webm', 'mkv', 'mov']
      const audioExts = ['mp3', 'ogg', 'flac', 'wav', 'aac']
      if (imageExts.includes(ext)) {
        showLightbox(name)
      } else if (videoExts.includes(ext) || audioExts.includes(ext)) {
        showMediaPlayer(name, videoExts.includes(ext))
      } else if (ext === 'pdf') {
        showPDFViewer(name)
      } else {
        const textExts = ['txt', 'md', 'json', 'yaml', 'yml', 'log', 'csv', 'xml', 'html', 'css', 'js', 'go', 'py', 'sh', 'conf', 'cfg', 'ini', 'toml']
        if (textExts.includes(ext)) {
          showTextPreview(name)
        } else {
          onDownload(name)
        }
      }
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
        <svg width="14" height="14" viewBox="0 0 24 24" class="text-muted-foreground/40 shrink-0" aria-hidden="true"><use href="/static/icons.svg#icon-chevron-right"></use></svg>
        <a href="?path=${encodeURIComponent(currentPath)}" onclick="event.preventDefault(); navigate('${escapeHTML(escapeJSString(currentPath))}')" 
           class="truncate max-w-[120px] transition-colors ${i === segments.length - 1 ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}">
          ${escapeHTML(seg)}
        </a>
      `
    })
    html += `</nav>`
    container.innerHTML = html
  }

  window.navigate = (path) => {
    clearSelection()
    const url = new URL(window.location)
    url.searchParams.set('path', path)
    window.history.pushState({}, '', url)
    refreshItems()
    updateBreadcrumbs(path)
  }

  window.addEventListener('popstate', () => {
    clearSelection()
    refreshItems()
    const path = new URLSearchParams(window.location.search).get('path') || '/'
    updateBreadcrumbs(path)
  })

  window.onDownload = (name) => {
    const path = joinPath(getCurrentPath(), name)
    window.location.href = `/api/download?path=${encodeURIComponent(path)}`
  }

  window.onRename = (name) => {
    const oldPath = joinPath(getCurrentPath(), name)
    
    const form = document.getElementById('rename-form')
    form.oldPath.value = oldPath
    form.newName.value = name
    
    showModal('rename')
    closeAllMenus()
  }

  window.onDelete = (name) => {
    const path = joinPath(getCurrentPath(), name)
    const pathInput = document.getElementById('delete-path')
    const nameEl = document.getElementById('delete-item-name')
    if (pathInput) pathInput.value = path
    if (nameEl) nameEl.textContent = name
    showModal('delete')
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
      <div class="toast-message">${escapeHTML(message)}</div>
      <button class="toast-close" data-action="dismiss-toast">
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
        <li class="empty-state">
          <svg class="w-16 h-16 mb-4"><use href="/static/icons.svg#icon-folder"></use></svg>
          <p class="text-lg font-medium">This folder is empty</p>
        </li>
      `
      listContainer.innerHTML = emptyState
      gridContainer.innerHTML = ''
      updateSelectionUI()
      return
    }

    listContainer.innerHTML = files.map(f => renderFileRow(f)).join('')
    gridContainer.innerHTML = files.map(f => renderFileCard(f)).join('')
    updateSelectionUI()
  }

  function renderFileRow(f) {
    const icon = getIconForFile(f)
    const size = f.is_dir ? '--' : formatBytes(f.size)
    const date = new Date(f.mod_time).toLocaleDateString() // Simple for now
    const name = escapeHTML(f.name)
    const key = fileKey(f.name)
    
    return `
      <li class="selectable-item group grid grid-cols-[34px_1fr_56px] sm:grid-cols-[34px_1fr_110px_160px_56px] items-center gap-4 px-4 py-2.5 hover:bg-surface-hover transition-all border-b border-border/50 last:border-0"
          data-name="${name}"
          data-is-dir="${f.is_dir}"
          data-action="open">
        <div data-stop-propagation>
          <input type="checkbox" class="selection-checkbox item-selector" aria-label="Select ${name}" data-name="${name}" data-action="toggle-select">
        </div>
        <div class="flex items-center gap-3 min-w-0">
          <svg class="h-5 w-5 shrink-0 ${icon.colorClass}"><use href="/static/icons.svg#${icon.id}"></use></svg>
          <span class="truncate text-sm font-medium">${name}</span>
        </div>
        <div class="hidden sm:block text-right text-xs text-muted-foreground tabular">${size}</div>
        <div class="hidden sm:block text-xs text-muted-foreground tabular">${date}</div>
        <div class="flex justify-end pr-1 relative" data-stop-propagation>
            <button data-action="toggle-menu" data-name="${name}" class="p-1.5 rounded-md hover:bg-surface-hover hover:text-foreground text-muted-foreground transition-colors">
                <svg class="h-4 w-4"><use href="/static/icons.svg#icon-more-vertical"></use></svg>
            </button>
            <div id="menu-${key}" class="hidden absolute right-0 top-9 w-44 rounded-md border border-border bg-popover py-1 shadow-lg z-40 animate-ql-pop-in">
                <button data-action="download" data-name="${name}" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                    <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-download"></use></svg> Download
                </button>
                <button data-action="rename" data-name="${name}" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                    <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-edit"></use></svg> Rename
                </button>
                <div class="my-1 border-t border-border"></div>
                <button data-action="delete" data-name="${name}" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-surface-hover">
                    <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-trash"></use></svg> Delete
                </button>
            </div>
        </div>
      </li>
    `
  }

  function renderFileCard(f) {
    const icon = getIconForFile(f)
    const name = escapeHTML(f.name)
    const key = fileKey(f.name)
    return `
      <div class="selectable-item group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4 text-center hover:bg-surface-hover transition-all hover:shadow-md cursor-pointer"
           data-name="${name}"
           data-is-dir="${f.is_dir}"
           data-action="open">
        <div class="absolute left-2 top-2 z-10" data-stop-propagation>
          <input type="checkbox" class="selection-checkbox item-selector" aria-label="Select ${name}" data-name="${name}" data-action="toggle-select">
        </div>
        <div class="flex h-16 w-full items-center justify-center rounded-lg bg-background/40">
           <svg class="h-10 w-10 ${icon.colorClass}"><use href="/static/icons.svg#${icon.id}"></use></svg>
        </div>
        <div class="w-full flex-1 min-w-0">
          <p class="truncate text-[13px] font-medium px-1">${name}</p>
          <p class="text-[11px] text-muted-foreground mt-0.5 tabular">${f.is_dir ? 'Folder' : formatBytes(f.size)}</p>
        </div>
        
        <button data-stop-propagation data-action="toggle-menu" data-name="${name}" 
                class="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface transition-all text-muted-foreground">
           <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-more-vertical"></use></svg>
        </button>
        
        <div id="menu-grid-${key}" class="hidden absolute right-2 top-8 w-40 rounded-md border border-border bg-popover py-1 shadow-lg z-40 animate-ql-pop-in text-left">
            <button data-action="download" data-name="${name}" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-download"></use></svg> Download
            </button>
            <button data-action="rename" data-name="${name}" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover">
                <svg class="h-3.5 w-3.5"><use href="/static/icons.svg#icon-edit"></use></svg> Rename
            </button>
            <div class="my-1 border-t border-border"></div>
            <button data-action="delete" data-name="${name}" class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-surface-hover">
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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
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

  // --- Lightbox Image Preview ---
  function showLightbox(name) {
    const path = joinPath(getCurrentPath(), name)
    const downloadURL = `/api/download?path=${encodeURIComponent(path)}`

    // Create lightbox elements if not present
    let lb = document.getElementById('lightbox')
    if (!lb) {
      lb = document.createElement('div')
      lb.id = 'lightbox'
      lb.className = 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center'
      lb.innerHTML = `
        <button id="lightbox-close" class="absolute top-4 right-4 z-50 text-white/80 hover:text-white text-3xl leading-none p-2">&times;</button>
        <button id="lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white/80 hover:text-white text-3xl p-2">&lsaquo;</button>
        <img id="lightbox-img" class="max-w-[90vw] max-h-[90vh] object-contain select-none" src="" alt="">
        <button id="lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white/80 hover:text-white text-3xl p-2">&rsaquo;</button>
      `
      document.body.appendChild(lb)
      lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox() })
      document.getElementById('lightbox-close').addEventListener('click', closeLightbox)
      document.getElementById('lightbox-prev').addEventListener('click', () => navigateImage(-1))
      document.getElementById('lightbox-next').addEventListener('click', () => navigateImage(1))
    }

    document.getElementById('lightbox-img').src = downloadURL
    lb.style.display = 'flex'

    document.addEventListener('keydown', onLightboxKey)
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox')
    if (lb) lb.style.display = 'none'
    document.removeEventListener('keydown', onLightboxKey)
  }

  function navigateImage(direction) {
    const items = Array.from(document.querySelectorAll('.selectable-item[data-name][data-is-dir="false"]'))
    const current = items.find(it => it.dataset.name === document.getElementById('lightbox-img').src.split('/').pop().split('?')[0] || false)
    if (!current) return
    const idx = items.indexOf(current)
    const next = items[idx + direction]
    if (next) {
      const name = next.dataset.name
      const path = joinPath(getCurrentPath(), name)
      document.getElementById('lightbox-img').src = `/api/download?path=${encodeURIComponent(path)}`
    }
  }

  function onLightboxKey(e) {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft') navigateImage(-1)
    if (e.key === 'ArrowRight') navigateImage(1)
  }

  // --- Media Player Preview ---
  function showMediaPlayer(name, isVideo) {
    const path = joinPath(getCurrentPath(), name)
    const url = `/api/stream?path=${encodeURIComponent(path)}`

    let mp = document.getElementById('media-player')
    if (!mp) {
      mp = document.createElement('div')
      mp.id = 'media-player'
      mp.className = 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center'
      mp.innerHTML = `
        <button id="media-close" class="absolute top-4 right-4 z-50 text-white/80 hover:text-white text-3xl p-2">&times;</button>
        <div id="media-content" class="max-w-[90vw] max-h-[90vh]"></div>
      `
      document.body.appendChild(mp)
      mp.addEventListener('click', (e) => { if (e.target === mp) closeMediaPlayer() })
      document.getElementById('media-close').addEventListener('click', closeMediaPlayer)
    }

    const content = document.getElementById('media-content')
    if (isVideo) {
      content.innerHTML = `<video controls autoplay class="max-w-[90vw] max-h-[85vh]"><source src="${escapeHTML(url)}">Your browser does not support video.</video>`
    } else {
      content.innerHTML = `<audio controls autoplay class="w-full mt-8"><source src="${escapeHTML(url)}">Your browser does not support audio.</audio>`
    }
    mp.style.display = 'flex'

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMediaPlayer() })
  }

  function closeMediaPlayer() {
    const mp = document.getElementById('media-player')
    if (mp) { mp.style.display = 'none'; mp.querySelector('#media-content').innerHTML = '' }
  }

  // --- PDF Viewer ---
  function showPDFViewer(name) {
    const path = joinPath(getCurrentPath(), name)
    const url = `/api/download?path=${encodeURIComponent(path)}`

    let pv = document.getElementById('pdf-viewer')
    if (!pv) {
      pv = document.createElement('div')
      pv.id = 'pdf-viewer'
      pv.className = 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center'
      pv.innerHTML = `<button id="pdf-close" class="absolute top-4 right-4 z-50 text-white/80 hover:text-white text-3xl p-2">&times;</button><iframe id="pdf-frame" class="w-[95vw] h-[95vh] rounded" src=""></iframe>`
      document.body.appendChild(pv)
      pv.addEventListener('click', (e) => { if (e.target === pv) closePDFViewer() })
      document.getElementById('pdf-close').addEventListener('click', closePDFViewer)
    }
    document.getElementById('pdf-frame').src = url
    pv.style.display = 'flex'
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePDFViewer() })
  }

  function closePDFViewer() {
    const pv = document.getElementById('pdf-viewer')
    if (pv) { pv.style.display = 'none'; document.getElementById('pdf-frame').src = '' }
  }

  // --- Text Preview ---
  async function showTextPreview(name) {
    const path = joinPath(getCurrentPath(), name)
    const url = `/api/edit?path=${encodeURIComponent(path)}`

    let tv = document.getElementById('text-viewer')
    if (!tv) {
      tv = document.createElement('div')
      tv.id = 'text-viewer'
      tv.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center'
      tv.innerHTML = `
        <div class="bg-background rounded-lg shadow-2xl w-[90vw] max-h-[90vh] flex flex-col">
          <div class="flex items-center justify-between p-4 border-b border-border">
            <h3 class="font-semibold text-sm" id="text-viewer-title"></h3>
            <button id="text-close" class="text-muted-foreground hover:text-foreground text-2xl p-1">&times;</button>
          </div>
          <pre class="overflow-auto p-4 font-mono text-xs whitespace-pre-wrap break-all max-h-[80vh]" id="text-viewer-content"></pre>
        </div>
      `
      document.body.appendChild(tv)
      tv.addEventListener('click', (e) => { if (e.target === tv) closeTextViewer() })
      document.getElementById('text-close').addEventListener('click', closeTextViewer)
    }

    document.getElementById('text-viewer-title').textContent = name
    document.getElementById('text-viewer-content').textContent = 'Loading...'
    tv.style.display = 'flex'

    try {
      const resp = await fetch(url)
      if (resp.ok) {
        document.getElementById('text-viewer-content').textContent = await resp.text()
      } else {
        document.getElementById('text-viewer-content').textContent = 'Cannot preview this file'
      }
    } catch {
      document.getElementById('text-viewer-content').textContent = 'Failed to load'
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTextViewer() })
  }

  function closeTextViewer() {
    const tv = document.getElementById('text-viewer')
    if (tv) tv.style.display = 'none'
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
