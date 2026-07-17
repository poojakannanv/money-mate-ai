import { anthropic } from "@ai-sdk/anthropic";
import { convertToCoreMessages, streamText } from "ai";
import { auth } from "@/auth";
import { CHAT_MODEL } from "@/ai/models";
import { buildFinanceTools, chatSystemPrompt } from "@/ai/tools";
import { todayIso } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorised", { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  const result = await streamText({
    model: anthropic(CHAT_MODEL),
    system: chatSystemPrompt(todayIso()),
    messages: convertToCoreMessages(messages),
    tools: buildFinanceTools(userId),
    maxSteps: 5,
    temperature: 0.2,
  });

  return result.toDataStreamResponse();
}
