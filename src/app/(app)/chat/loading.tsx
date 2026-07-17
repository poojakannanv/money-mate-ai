import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="container max-w-3xl py-10">
      <Skeleton className="mb-3 h-8 w-64" />
      <Skeleton className="mb-6 h-4 w-96 max-w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
