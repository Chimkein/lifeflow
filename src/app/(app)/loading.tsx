import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly during navigation to any (app) page while its server render /
// data fetch completes, so switching pages feels immediate instead of frozen.
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
