import { Skeleton } from "@/components/ui/skeleton";

export default function UploadLoading() {
  return (
    <div className="container max-w-4xl py-10">
      <Skeleton className="mb-3 h-8 w-72" />
      <Skeleton className="mb-8 h-4 w-full max-w-xl" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
