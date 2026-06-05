export function SkeletonRow() {
  return (
    <li class="grid animate-pulse items-center gap-2 py-2.5 grid-cols-[30px_1fr_96px_132px_40px]">
      <div class="h-3.5 w-3.5 rounded bg-muted" />
      <div class="flex items-center gap-2.5">
        <div class="h-4 w-4 rounded bg-muted" />
        <div class="h-3.5 w-32 rounded bg-muted" />
      </div>
      <div class="h-3 w-12 justify-self-end rounded bg-muted" />
      <div class="h-3 w-16 justify-self-end rounded bg-muted" />
      <div class="h-3.5 w-3.5 justify-self-end rounded bg-muted" />
    </li>
  );
}

export function SkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div>
      <div class="file-header">
        <div class="h-3.5 w-3.5 rounded bg-muted" />
        <div class="h-3 w-12 rounded bg-muted" />
        <div class="h-3 w-8 justify-self-end rounded bg-muted" />
        <div class="h-3 w-10 justify-self-end rounded bg-muted" />
        <div />
      </div>
      <ul class="divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
    </div>
  );
}

export function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} class="flex animate-pulse flex-col gap-2.5 p-2">
          <div class="aspect-square bg-muted" />
          <div class="h-3.5 w-3/4 rounded bg-muted" />
          <div class="h-3 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
