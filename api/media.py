"""Authenticated Python file utilities for coex. No uploaded files are persisted."""
import base64
import hashlib
import hmac
import io
import json
import os
import time
from http.server import BaseHTTPRequestHandler
from xml.sax.saxutils import escape

MAX_FILE = 2 * 1024 * 1024
MAX_BODY = 3 * 1024 * 1024


def authenticate(token, action):
    secret = os.environ.get("BETTER_AUTH_SECRET", "")
    if not secret or not isinstance(token, str):
        raise PermissionError("Sign in to use file tools.")
    try:
        payload, signature = token.split(".")
        expected = base64.urlsafe_b64encode(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if claims.get("aud") != "coex-media" or claims.get("action") != action or not claims.get("sub") or not time.time() < claims["exp"] <= time.time() + 310:
            raise ValueError()
    except Exception as exc:
        raise PermissionError("Your file session expired. Please try again.") from exc


def process(body):
    action = body.get("action")
    if action == "create_pdf":
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        text = body.get("text", "")
        title = body.get("title", "coex document")
        if not isinstance(text, str) or not text.strip() or len(text) > 60000 or not isinstance(title, str) or len(title) > 160:
            raise ValueError("Enter a title up to 160 characters and text up to 60,000 characters.")
        # Explicit limitation instead of silently emitting missing Unicode glyphs.
        try:
            (text + title).encode("cp1252")
        except UnicodeEncodeError:
            raise ValueError("PDF export currently supports Latin-script text. Hindi and other scripts need a Unicode font integration.")
        styles = getSampleStyleSheet()
        stream = io.BytesIO()
        story = [Paragraph(escape(title), styles["Title"]), Spacer(1, 18)]
        story.extend(Paragraph(escape(line) or "&#160;", styles["BodyText"]) for line in text.splitlines())
        SimpleDocTemplate(stream, title=title, author="coex", leftMargin=48, rightMargin=48, topMargin=48, bottomMargin=48).build(story)
        return {"data": base64.b64encode(stream.getvalue()).decode(), "mediaType": "application/pdf"}
    if action != "inspect":
        raise ValueError("Unsupported media action.")
    encoded = body.get("data", "")
    if not isinstance(encoded, str) or len(encoded) > 2800000:
        raise ValueError("Choose a file smaller than 2 MB.")
    try:
        data = base64.b64decode(encoded, validate=True)
    except Exception:
        raise ValueError("The uploaded file could not be decoded.")
    if not data or len(data) > MAX_FILE:
        raise ValueError("Choose a nonempty file smaller than 2 MB.")
    if body.get("mediaType") == "application/pdf":
        from pypdf import PdfReader
        if not data.startswith(b"%PDF-"):
            raise ValueError("This is not a valid PDF.")
        try:
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise ValueError("Please upload an unlocked PDF.")
            if len(reader.pages) > 40:
                raise ValueError("Upload a PDF with 40 pages or fewer.")
            excerpts = []
            for page in reader.pages:
                contents = page.get_contents()
                if contents and len(contents.get_data()) > 4000000:
                    raise ValueError("This PDF page is too complex. Export a smaller PDF.")
                excerpts.append((page.extract_text() or "")[:12000])
            text = "\n\n".join(excerpts)[:60000]
            return {"mediaType": "application/pdf", "pages": len(reader.pages), "text": text, "scanned": not bool(text.strip())}
        except ValueError:
            raise
        except Exception:
            raise ValueError("This PDF could not be read. Try exporting it again.")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 12000000
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ("PNG", "JPEG", "WEBP") or image.width * image.height > 12000000:
                raise ValueError()
            media_type = Image.MIME[image.format]
            width, height = image.size
            image.verify()
        return {"mediaType": media_type, "width": width, "height": height}
    except Exception:
        raise ValueError("Upload a valid PNG, JPEG or WebP image up to 12 megapixels.")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        status = 200
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > MAX_BODY:
                raise ValueError("Request must be smaller than 3 MB.")
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError("Invalid request.")
            authenticate(self.headers.get("Authorization", "").removeprefix("Bearer "), body.get("action"))
            result = process(body)
        except PermissionError as exc:
            status, result = 401, {"error": str(exc)}
        except (ValueError, TypeError) as exc:
            status, result = 400, {"error": str(exc)}
        except Exception:
            status, result = 500, {"error": "File processing failed. Please try again."}
        output = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(output)))
        self.end_headers()
        self.wfile.write(output)
