import { useRef, useState } from 'preact/hooks';
import { TopBar } from '../components/TopBar';
import { DropOverlay } from '../components/DropOverlay';
import { ToastContainer, toast } from '../hooks/useToast';
import { uploadFiles, uploads } from '../hooks/useUpload';
import type { UploadFile } from '../lib/api';

function CameraIcon() {
  return <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
function GalleryIcon() {
  return <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function FileIcon() {
  return <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
function FolderIcon() {
  return <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}

export function SendPage() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [destination, setDestination] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const destinationPath = destination.trim().replace(/^\/+|\/+$/g, '');

  const handleSend = (files: FileList | Array<File | UploadFile>) => {
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;
    uploadFiles(list, destinationPath, () => {
      toast(`${list.length} item${list.length === 1 ? '' : 's'} sent`, 'success');
    }, { conflict: 'keep-both' });
  };

  const inputChanged = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files) handleSend(input.files);
    input.value = '';
  };

  const active = uploads.value.filter((u) => u.status === 'pending' || u.status === 'uploading').length;

  return (
    <div class="min-h-screen bg-background">
      <TopBar />

      <main class="mx-auto max-w-xl px-5 pt-10 pb-20 sm:pb-16">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">Send files</h1>
        <p class="mt-1 text-sm text-foreground-muted">Quick upload to your home file hub.</p>

        {/* Drag zone */}
        <div
          class={[
            'mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors text-center',
            dragActive ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:border-border-strong',
          ].join(' ')}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer?.files.length) handleSend(e.dataTransfer.files); }}
        >
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary">
            <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <p class="mt-4 text-sm font-medium text-foreground">Drag files here</p>
          <p class="mt-1 text-xs text-foreground-muted">or choose a source below</p>
        </div>

        {/* Source buttons */}
        <div class="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => cameraInput.current?.click()} class="btn btn-outline h-12 justify-start px-4 text-sm gap-3">
            <CameraIcon />
            <span>Camera</span>
          </button>
          <button onClick={() => galleryInput.current?.click()} class="btn btn-outline h-12 justify-start px-4 text-sm gap-3">
            <GalleryIcon />
            <span>Gallery</span>
          </button>
          <button onClick={() => fileInput.current?.click()} class="btn btn-outline h-12 justify-start px-4 text-sm gap-3">
            <FileIcon />
            <span>Files</span>
          </button>
          <button onClick={() => folderInput.current?.click()} class="btn btn-outline h-12 justify-start px-4 text-sm gap-3">
            <FolderIcon />
            <span>Folder</span>
          </button>
        </div>

        {/* Destination */}
        <div class="mt-8">
          <label class="text-xs font-medium uppercase tracking-wider text-foreground-subtle block mb-2">Destination</label>
          <input
            value={destination}
            onInput={(e) => setDestination((e.target as HTMLInputElement).value)}
            placeholder="folder/path (leave empty for root)"
            class="input"
          />
          <p class="mt-2 text-xs text-foreground-muted">
            Sending to <span class="text-foreground font-medium">{destinationPath || 'storage root'}</span>
          </p>
        </div>

        {active > 0 && (
          <>
            <div class="hr mt-8" />
            <p class="mt-6 text-sm text-foreground-muted">{active} uploading…</p>
          </>
        )}
      </main>

      <input ref={cameraInput} type="file" accept="image/*,video/*" capture="environment" class="hidden" onChange={inputChanged} />
      <input ref={galleryInput} type="file" accept="image/*,video/*" multiple class="hidden" onChange={inputChanged} />
      <input ref={fileInput} type="file" multiple class="hidden" onChange={inputChanged} />
      <input ref={folderInput} type="file" multiple class="hidden" {...({ webkitdirectory: '' } as any)} onChange={inputChanged} />

      <ToastContainer />
    </div>
  );
}
