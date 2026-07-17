import { MessageSquareText } from "lucide-react";
import { requireUser } from "@/lib/session";
import { countTransactions } from "@/db/queries";
import { ChatPanel } from "@/components/chat/chat-panel";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser();
  const total = await countTransactions(user.id);

  return (
    <div className="container max-w-3xl py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Chat with MoneyMate
        </h1>
        <p className="mt-2 text-muted-foreground">
          Plain-English questions, answers grounded in your real transactions
          through function calling.
        </p>
      </div>
      {total === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nothing to talk about yet"
          description="MoneyMate answers from your own data. Upload a statement first and then ask away."
          actionHref="/upload"
          actionLabel="Upload a statement"
        />
      ) : (
        <ChatPanel />
      )}
    </div>
  );
}
