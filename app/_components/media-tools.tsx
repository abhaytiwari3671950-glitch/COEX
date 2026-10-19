"use client";
import { useRef, useState } from "react";
import type { UserContent } from "ai";
import "../media.css";
import { mediaRequest } from "@/lib/media-request";

function downloadPDF(data: string) {
  const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type: "application/pdf"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "coex-document.pdf"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function ExportPDF({text}: {text: string}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <span className="coex-export"><button type="button" disabled={busy || !text.trim()} onClick={async () => {
    setBusy(true); setError("");
    try {
      const result = await mediaRequest({action: "create_pdf", title: "coex response", text});
      if (typeof result.data !== "string" || result.mediaType !== "application/pdf") throw new Error("PDF export returned an invalid file. Please try again.");
      downloadPDF(result.data);
    }
    catch (error) { setError(error instanceof Error ? error.message : "PDF export failed."); }
    finally { setBusy(false); }
  }}>{busy ? "Creating PDF…" : "Download PDF"}</button>{error && <span role="alert">{error}</span>}</span>;
}
export function MediaTools({disabled, onSend}: {disabled: boolean; onSend: (parts: UserContent) => Promise<unknown>}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{name: string; url: string; mediaType: string; detail: string} | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return <div className="coex-media">
    <button type="button" className="coex-media-toggle" aria-expanded={open} aria-controls="coex-media-panel" onClick={() => setOpen(!open)}>＋ Files & media</button>
    {open && <section id="coex-media-panel" aria-label="Files and media" className="coex-media-panel">
      <div className="coex-media-heading"><strong>Bring your files into the conversation</strong><button type="button" aria-label="Close file tools" onClick={() => setOpen(false)}>×</button></div>
      <p>PDF, PNG, JPEG or WebP · up to 2 MB · PDFs up to 40 pages</p>
      <input ref={input} aria-label="Upload PDF or image" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={busy || disabled} onChange={async event => {
        const selected = event.target.files?.[0]; if (!selected) return;
        setError(""); setFile(null);
        if (!selected.size) { setError("Choose a nonempty file."); event.target.value = ""; return; }
        if (selected.size > 2 * 1024 * 1024) { setError("Choose a file smaller than 2 MB."); event.target.value = ""; return; }
        setBusy(true);
        try {
          const url = await new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Unable to read the file.")); reader.readAsDataURL(selected);});
          const result = await mediaRequest({action: "inspect", mediaType: selected.type || (selected.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : ""), data: url.split(",")[1]});
          if (typeof result.mediaType !== "string" || !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(result.mediaType)) throw new Error("File tools returned an unsupported file type.");
          const detail = result.pages !== undefined ? `${result.pages} pages · ${result.scanned ? "Scanned PDF: AI will read the page images" : "Text read successfully"}` : `${result.width} × ${result.height} image`;
          setFile({name: selected.name, url: `data:${result.mediaType};base64,${url.split(",")[1]}`, mediaType: result.mediaType, detail});
        } catch (error) { setError(error instanceof Error ? error.message : "Upload failed."); }
        finally { setBusy(false); if (input.current) input.current.value = ""; }
      }}/>
      {busy && <p role="status">Processing…</p>}
      {file && <div className="coex-file-preview">{file.mediaType.startsWith("image/") && <img src={file.url} alt="Selected upload preview"/>}<strong>{file.name}</strong><span>{file.detail}</span><button type="button" disabled={busy} onClick={() => setFile(null)}>Remove file</button></div>}
      <label htmlFor="coex-file-question">What would you like to know?</label>
      <textarea id="coex-file-question" placeholder="Summarize this PDF, or describe this photo…" value={question} onChange={event => setQuestion(event.target.value)} disabled={busy}/>
      <button className="coex-media-send" type="button" disabled={!file || busy || disabled} onClick={async () => {
        if (!file) return; setBusy(true); setError("");
        try { await onSend([{type: "text", text: question.trim() || (file.mediaType === "application/pdf" ? "Read and summarize this PDF." : "Describe this image.")}, {type: "file", data: file.url, mediaType: file.mediaType, filename: file.name}]); setFile(null); setQuestion(""); setOpen(false); }
        catch (error) { setError(error instanceof Error ? error.message : "Unable to send file."); }
        finally { setBusy(false); }
      }}>Ask coex about this file</button>
      {error && <p className="coex-media-error" role="alert">{error}</p>}
      <p className="coex-media-note">Files you send are shared with the AI provider and saved with your chat. Download a text response as a PDF using the button below it.</p>
      <div className="coex-media-coming"><strong>Image & video generation</strong><span>Not enabled. A configured generation provider and paid API access are required.</span></div>
    </section>}
  </div>;
}
