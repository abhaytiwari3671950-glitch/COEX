"use client";
import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, BrainIcon, PlusIcon, SquareIcon, PanelLeftIcon, SparklesIcon, CodeIcon, PenLineIcon, LightbulbIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputButton, type PromptInputMessage, PromptInputSubmit, PromptInputTextarea, usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { AgentMessage } from "./agent-message";
import { EditableUserMessage } from "./editable-user-message";
import { CopyMessage, RecentChats } from "./chat-utilities";
import "../utilities.css";
import { MediaTools, ExportPDF } from "./media-tools";
type RecentChat = { id: string; title: string };
const suggestions = [
  { icon: CodeIcon, title: "Build something", detail: "Turn an idea into code", prompt: "Help me build a project. Ask me what I want to create and suggest a simple plan." },
  { icon: PenLineIcon, title: "Find the right words", detail: "Write, refine, and express", prompt: "Help me write something clearly. Ask me what I am writing and who it is for." },
  { icon: LightbulbIcon, title: "Explore an idea", detail: "Make the complex simple", prompt: "Help me understand a new topic. Ask me what I want to learn and explain it step by step." },
];
export function AgentChat({ sessionId, sessionless = false }: { readonly sessionId?: string; readonly sessionless?: boolean }) {
  const [cancellationError, setCancellationError] = useState<string>();
  const [hasInputText, setHasInputText] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const agent = useEveAgent({
    initialSession: sessionId === undefined ? undefined : { sessionId, streamIndex: 0 },
    resume: sessionId !== undefined,
    onSessionChange(session) {
      if (sessionId === undefined && session !== undefined) {
        History.prototype.replaceState.call(window.history, window.history.state, "", `/s/${encodeURIComponent(session.sessionId)}`);
      }
    },
  });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isResuming = agent.status === "resuming";
  const isEmpty = agent.data.messages.length === 0;
  const lastMessage = agent.data.messages.at(-1);
  const isPendingAssistantShell = lastMessage?.role === "assistant" && lastMessage.parts.every((part) => part.type === "step-start");
  const showPendingThinking = isBusy && (agent.status === "submitted" || lastMessage?.role !== "assistant" || isPendingAssistantShell);
  const turnFailure = isBusy || isResuming ? undefined : getLatestTurnFailure(agent.events);
  const errorMessage = cancellationError ?? agent.error?.message ?? turnFailure;
  const showConversationLayout = isResuming || !isEmpty || errorMessage !== undefined;
  const activeSessionId = sessionId ?? agent.session?.sessionId;
  const firstUserMessage = agent.data.messages.find((message) => message.role === "user");
  const firstUserText = firstUserMessage?.parts.filter((part) => part.type === "text").map((part) => part.text).join(" ").slice(0, 70);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("coex:recent-chats") || "[]");
      if (Array.isArray(saved)) setRecentChats(saved.filter((chat) => typeof chat?.id === "string" && typeof chat?.title === "string").slice(0, 20));
    } catch {}
  }, []);
  useEffect(() => {
    if (!activeSessionId || !firstUserText) return;
    setRecentChats((previous) => {
      if (previous.some((chat) => chat.id === activeSessionId && chat.title === firstUserText)) return previous;
      const next = [{ id: activeSessionId, title: firstUserText }, ...previous.filter((chat) => chat.id !== activeSessionId)].slice(0, 20);
      try { localStorage.setItem("coex:recent-chats", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activeSessionId, firstUserText]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sidebarOpen]);
  const requestCancellation = () => {
    setCancellationError(undefined);
    void agent.cancel().catch((error: unknown) => setCancellationError(error instanceof Error ? error.message : "Unable to cancel the response."));
  };
  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isResuming) return;
    setHasInputText(false);
    setCancellationError(undefined);
    const options = isBusy ? { turnPolicy: "steer" as const } : undefined;
    if (message.files.length === 0) { await agent.send(text, options); return; }
    const parts: UserContent = [];
    if (text.length > 0) parts.push({ text, type: "text" });
    for (const file of message.files) parts.push({ data: file.url, filename: file.filename, mediaType: file.mediaType, type: "file" });
    await agent.send(parts, options);
  };
  return (
    <div className="coex-app">
      {sidebarOpen && <button className="coex-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
      <aside id="coex-sidebar" className={`coex-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Chat navigation">
        <div className="coex-brand"><span className="coex-brand-icon"><SparklesIcon size={20} /></span><span>coex</span><button className="coex-icon-button coex-mobile-close" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}><XIcon size={18} /></button></div>
        <a className="coex-new-chat" href="/s"><PlusIcon size={18} /> New chat <span>↗</span></a>
        <RecentChats chats={recentChats} activeId={activeSessionId} />
        <div className="coex-sidebar-note"><span className="coex-status-dot" /> A little help. A lot of possibility.<small>Recent chats are saved on this browser.</small></div>
      </aside>
      <main className="coex-main">
        <header className="coex-header"><div><button className="coex-icon-button coex-mobile-toggle" aria-label="Open sidebar" aria-controls="coex-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><PanelLeftIcon size={20} /></button><span className="coex-header-title">coex</span><span className="coex-model-pill">Gemini</span></div><a className="coex-icon-button coex-header-new" href="/s" aria-label="Start a new chat"><PlusIcon size={18} /><span>New chat</span></a></header>
        {showConversationLayout ? <Conversation className="min-h-0 flex-1" initial={sessionId === undefined ? undefined : false} resize={activeSessionId === undefined ? "smooth" : "instant"} scrollRestorationKey={isEmpty || activeSessionId === undefined ? undefined : `eve:web-chat-scroll:${activeSessionId}`}>
          <ConversationContent className="coex-messages mx-auto w-full max-w-3xl gap-8 px-5 py-8 sm:px-8">
            {isResuming && isEmpty ? <p className="text-sm text-muted-foreground" role="status">Loading your conversation…</p> : null}
            {agent.data.messages.map((message, index) => {
              if (showPendingThinking && isPendingAssistantShell && message.id === lastMessage.id) return null;
              const streaming = agent.status === "streaming" && index === agent.data.messages.length - 1;
              const content = <AgentMessage message={message} canRespond={!isBusy && !isResuming} isStreaming={streaming} onInputResponses={(inputResponses) => { setCancellationError(undefined); return agent.respond(inputResponses); }} />;
              const text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n\n");
              return message.role === "user" ? <div key={message.id} className="coex-user-message-group"><EditableUserMessage message={message} disabled={isBusy || isResuming} onResend={async (text) => {
                const parts: UserContent = [{ type: "text", text }];
                for (const part of message.parts) {
                  if (part.type === "file") {
                    if (!part.url) throw new Error("This attachment is no longer available. Send a new message with the file.");
                    parts.push({ type: "file", data: part.url, mediaType: part.mediaType, filename: part.filename });
                  }
                }
                setCancellationError(undefined);
                await agent.send(parts);
              }}>{content}</EditableUserMessage><div className="coex-user-copy"><CopyMessage text={text} label="Copy message" /></div></div> : <div key={message.id}>{content}{!streaming && <div className="coex-assistant-actions"><CopyMessage text={text} label="Copy response" /><ExportPDF text={text} /></div>}</div>;
            })}
            {showPendingThinking && <Message aria-live="polite" from="assistant"><MessageContent><div className="flex items-center gap-2 text-sm text-muted-foreground"><BrainIcon size={16} /><Shimmer duration={1}>Thinking</Shimmer></div></MessageContent></Message>}
            {errorMessage && <div role="alert" className="coex-error"><AlertCircleIcon size={18} /><div><strong>Couldn't complete that request</strong><p>{errorMessage}</p></div></div>}
          </ConversationContent><ConversationScrollButton />
        </Conversation> : <section className="coex-welcome">
          <div className="coex-welcome-icon"><SparklesIcon size={28} strokeWidth={1.5} /></div>
          <p className="coex-eyebrow">A SPACE FOR YOUR NEXT IDEA</p><h1>What can I help you with?</h1><p className="coex-welcome-description">Think it through. Create something. Make it happen.</p>
          <div className="coex-suggestions">{suggestions.map(({icon: Icon, title, detail, prompt}) => <button key={title} onClick={() => void handleSubmit({text: prompt, files: []}).catch((error: unknown) => setCancellationError(error instanceof Error ? error.message : "Please try again."))}><Icon size={20} strokeWidth={1.5} /><strong>{title}</strong><span>{detail}</span></button>)}</div>
        </section>}
        <div className="coex-composer-wrap"><MediaTools disabled={isBusy || isResuming} onSend={async (parts) => { setCancellationError(undefined); await agent.send(parts); }} /><div className="coex-composer"><PromptInput onSubmit={handleSubmit}><PromptInputTextarea aria-label="Message coex" disabled={isResuming} onChange={(event) => setHasInputText(event.currentTarget.value.trim().length > 0)} placeholder="Ask coex anything…" /><ComposerAction hasInputText={hasInputText} isBusy={isBusy} isResuming={isResuming} onCancel={requestCancellation} /></PromptInput></div><p className="coex-disclaimer">coex can make mistakes. Check important information.</p></div>
      </main>
    </div>
  );
}
function ComposerAction({ hasInputText, isBusy, isResuming, onCancel }: { readonly hasInputText: boolean; readonly isBusy: boolean; readonly isResuming: boolean; readonly onCancel: () => void; }) {
  const attachments = usePromptInputAttachments();
  if (!isBusy || hasInputText || attachments.files.length > 0) return <PromptInputSubmit disabled={isResuming} />;
  return <PromptInputButton aria-label="Stop" className="absolute right-2.5 bottom-2.5" onClick={onCancel} variant="outline"><SquareIcon className="size-3 fill-current" /></PromptInputButton>;
}
function getLatestTurnFailure(events: ReturnType<typeof useEveAgent>["events"]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "turn.failed") return event.data.code === "MODEL_CALL_FAILED" ? "The model is temporarily unavailable. Please try again." : event.data.message;
    if (event.type === "turn.completed" || event.type === "turn.cancelled" || event.type === "message.received") return undefined;
  }
}

