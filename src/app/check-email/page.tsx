import Link from "next/link";
import { MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <MailCheck
            className="mx-auto mb-2 h-10 w-10 text-primary"
            aria-hidden
          />
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            We have emailed you a magic sign-in link. It expires in 24 hours.
            Check your spam folder if it does not arrive within a minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Use a different email
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
