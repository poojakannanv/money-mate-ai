import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44 lg:col-span-2" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
