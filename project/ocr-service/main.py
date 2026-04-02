import io
import re
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pytesseract

app = FastAPI(title="OCR Document Digitization Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SECTION_PATTERNS = {
    "Purpose of Processing": [r"purpose[s]?\s+of\s+(?:data\s+)?process", r"why\s+we\s+(?:collect|use|process)", r"data\s+will\s+be\s+used\s+for", r"purpose\s+of\s+data\s+collection"],
    "Data Categories": [r"(?:categories|types)\s+of\s+(?:personal\s+)?data", r"information\s+(?:we\s+)?collect", r"personal\s+(?:data|information)", r"data\s+usage"],
    "Retention Period": [r"retention\s+(?:period|policy)", r"how\s+long\s+(?:we\s+)?(?:keep|store|retain)", r"\d+\s+(?:year|month|day)s?\s+(?:retention|storage)"],
    "Jurisdiction References": [r"gdpr|general\s+data\s+protection", r"dpdp|digital\s+personal\s+data", r"applicable\s+law|governing\s+law|jurisdiction"],
    "Data Subject Rights": [r"your\s+rights|data\s+subject\s+rights", r"right\s+to\s+(?:access|erasure|deletion|rectification)", r"withdraw\s+consent|revoke\s+consent"],
    "Third-Party Sharing": [r"third.part(?:y|ies)|sharing\s+(?:with|of)\s+data", r"disclose|transfer\s+(?:to|of)\s+data", r"partner[s]?|vendor[s]?"],
    "User Consent": [r"hereby\s+give\s+(?:my\s+)?consent", r"i\s+consent\s+to", r"user\s+consent"],
}

def detect_sections(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    sections = []
    for section_name, patterns in SECTION_PATTERNS.items():
        matching_lines = []
        for line in lines:
            for pattern in patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    matching_lines.append(line)
                    break
        if matching_lines:
            sections.append({"title": section_name, "content": matching_lines[:15], "count": len(matching_lines)})
    return sections

@app.get("/health")
def health():
    return {"status": "ok", "service": "OCR Digitization Service (Tesseract)", "version": "2.0.0"}

@app.post("/ocr/extract")
async def extract_document(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_bytes = await file.read()
    filename = file.filename or ""

    try:
        if "pdf" in (file.content_type or "") or filename.lower().endswith(".pdf"):
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(file_bytes, dpi=200, first_page=1, last_page=3)
                all_text = []
                for img in images:
                    text = pytesseract.image_to_string(img)
                    all_text.append(text)
                full_text = "\n".join(all_text)
                source = "tesseract-pdf"
            except Exception as e:
                raise Exception(f"PDF processing failed: {e}")
        else:
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            full_text = pytesseract.image_to_string(img)
            source = "tesseract-image"

        lines = [l.strip() for l in full_text.split("\n") if l.strip()]
        sections = detect_sections(full_text)

        print(f"✅ OCR extracted {len(full_text)} chars from {filename}")

        return {
            "filename": filename,
            "text": full_text,
            "lines": lines,
            "sections": sections,
            "confidence": 0.95,
            "source": source,
            "charCount": len(full_text),
        }
    except Exception as e:
        print(f"❌ OCR error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
