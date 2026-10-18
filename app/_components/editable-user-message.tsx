"use client";
import type { EveMessage } from "eve/react";
import { PenLineIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

export function EditableUserMessage({ message, children, disabled, onResend }: {
  readonly message: EveMessage;
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly onResend: (text: string) => Promise<void>;
}) {
  const original = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(original);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const sending = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const canSend = draft.trim().length > 0 && draft.trim() !== original.trim() && !pending && !disabled;
  const close = () => {
    if (sending.current) return;
    setEditing(false);
    setError(undefined);
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const submit = async () => {
    if (!canSend || sending.current) return;
    sending.current = true;
    setPending(true);
    setError(undefined);
    try {
      await onResend(draft.trim());
      setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't resend. Your edited text is still here.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  };
  return <div className="coex-user-turn">
    {editing ? <form className="coex-edit-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label htmlFor={`edit-${message.id}`}>Edit your message</label>
      <textarea id={`edit-${message.id}`} autoFocus value={draft} disabled={pending} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") { event.preventDefault(); close(); }
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); }
      }} rows={4} />
      <p className="coex-edit-note">Your edited text will be sent as a new message. The original stays in this chat.</p>
      {error && <p className="coex-edit-error" role="alert">{error}</p>}
      <div className="coex-edit-actions"><button type="button" disabled={pending} onClick={close}>Cancel</button><button type="submit" disabled={!canSend}>{pending ? "Sending…" : "Send edited message"}</button></div>
    </form> : <>{children}{original.trim() && <div className="coex-user-actions"><button ref={editButton} type="button" disabled={disabled} title={disabled ? "Wait for the response to finish before editing" : "Edit and resend this message"} onClick={() => { setDraft(original); setError(undefined); setEditing(true); }}><PenLineIcon size={13} /><span>Edit &amp; resend</span></button></div>}</>}
  </div>;
}
