import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        That page does not exist. Perhaps it was moved, or the link is out of
        date.
      </p>
      <Link href="/">
        <Button variant="outline">Back to home</Button>
      </Link>
    </div>
  );
}
