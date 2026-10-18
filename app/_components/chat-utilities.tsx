"use client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, MessageSquareIcon, SearchIcon, XIcon } from "lucide-react";

export function CopyMessage({ text, label }: { readonly text: string; readonly label: string }) {
  const [status, setStatus] = useState<"ready" | "copying" | "copied" | "manual">("ready");
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false);
  const manual = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  useEffect(() => { if (status === "manual") { manual.current?.focus(); manual.current?.select(); } }, [status]);
  if (!text.trim()) return null;
  const copy = async () => {
    if (busy.current) return;
    busy.current = true;
    if (timeout.current) clearTimeout(timeout.current);
    setStatus("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      timeout.current = setTimeout(() => setStatus("ready"), 2400);
    } catch { setStatus("manual"); }
    finally { busy.current = false; }
  };
  return <div className="coex-copy-control">
    <button className="coex-copy-button" type="button" aria-label={status === "copied" ? "Copied" : label} disabled={status === "copying"} onClick={() => void copy()}>{status === "copied" ? <CheckIcon size={14} /> : <CopyIcon size={14} />}<span aria-live="polite">{status === "copied" ? "Copied" : status === "copying" ? "Copying…" : "Copy"}</span></button>
    {status === "manual" && <div className="coex-manual-copy"><p role="status">Clipboard access is unavailable. Copy the selected text using Ctrl+C or Command+C.</p><textarea ref={manual} aria-label="Text to copy" readOnly value={text} rows={3} /><button type="button" onClick={() => setStatus("ready")}>Close</button></div>}
  </div>;
}

export function RecentChats({ chats, activeId }: { readonly chats: readonly { id: string; title: string }[]; readonly activeId?: string }) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized ? chats.filter((chat) => chat.title.toLocaleLowerCase().includes(normalized)) : chats;
  const clear = () => { setQuery(""); search.current?.focus(); };
  return <>
    <div className="coex-search"><SearchIcon size={16} aria-hidden="true" /><input ref={search} type="search" aria-label="Search chat titles" placeholder="Search chats" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && query) { event.stopPropagation(); clear(); } }} />{query && <button type="button" aria-label="Clear chat search" onClick={clear}><XIcon size={14} /></button>}</div>
    <div className="coex-history-label">{normalized ? "SEARCH RESULTS" : "YOUR CHATS"}{normalized && <span className="coex-search-count" role="status">{filtered.length}</span>}</div>
    <nav className="coex-history" aria-label="Recent chats">
      {filtered.length ? filtered.map((chat) => <a key={chat.id} href={`/s/${encodeURIComponent(chat.id)}`} title={chat.title} aria-current={chat.id === activeId ? "page" : undefined}><MessageSquareIcon size={15} /><span>{chat.title}</span></a>) : normalized ? <div className="coex-search-empty"><p>No matching chats</p><span>Try a word from the chat title.</span><button type="button" onClick={clear}>Show all chats</button></div> : <p>Your conversations will appear here.<br /><span>Start with a little curiosity.</span></p>}
    </nav>
  </>;
}
