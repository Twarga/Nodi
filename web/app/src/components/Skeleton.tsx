export function SkeletonRow() {
  return (
    <li class="grid animate-pulse items-center gap-2 rounded-lg px-3 py-2.5 grid-cols-[34px_1fr_100px_140px_44px] sm:grid-cols-[34px_1fr_110px_160px_56px]">
      <div class="h-4 w-4 rounded bg-muted" />
      <div class="flex items-center gap-2.5">
        <div class="h-5 w-5 rounded bg-muted" />
        <div class="h-4 w-32 rounded bg-muted" />
      </div>
      <div class="h-3 w-12 justify-self-end rounded bg-muted" />
      <div class="h-3 w-16 justify-self-end rounded bg-muted" />
      <div class="h-4 w-4 justify-self-end rounded bg-muted" />
    </li>
  );
}

export function SkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div class="file-panel overflow-hidden">
      <div class="grid items-center gap-2 border-b border-border/60 px-3 py-2 bg-surface-hover/50 grid-cols-[34px_1fr_100px_140px_44px] sm:grid-cols-[34px_1fr_110px_160px_56px]">
        <div class="h-4 w-4 rounded bg-muted" />
        <div class="h-3 w-12 rounded bg-muted" />
        <div class="h-3 w-8 justify-self-end rounded bg-muted" />
        <div class="h-3 w-10 justify-self-end rounded bg-muted" />
        <div />
      </div>
      <ul class="divide-y divide-border/30">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
    </div>
  );
}

export function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} class="flex animate-pulse flex-col gap-2 rounded-xl border border-border/60 bg-surface/60 p-3">
          <div class="aspect-square rounded-lg bg-muted" />
          <div class="h-4 w-3/4 rounded bg-muted" />
          <div class="h-3 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
