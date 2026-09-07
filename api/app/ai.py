import os

from google import genai

PROMPT = (
    "Summarize this pull-request diff for a mobile reviewer. "
    "Output exactly 3 lines, nothing else. Line 1 starts with 'WHAT: ', "
    "line 2 with 'RISK: ', line 3 with 'CHECK: '. "
    "No bullet characters, no numbering, no code blocks, no approval language:\n\n"
)


def summarize(diff: str) -> str:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    # Model is env-pinned; confirm availability at build time, swap via env.
    model = os.environ.get("AI_MODEL", "gemini-3.6-flash")
    resp = client.models.generate_content(model=model, contents=PROMPT + diff)
    return (resp.text or "").strip()
