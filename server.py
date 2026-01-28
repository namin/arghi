"""FastAPI server for arghi - Argument Highlighter."""

import hashlib
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from arghi.schema import HighlightRequest, HighlightResponse
from arghi.highlight import highlight_text
from arghi.llm import set_request_api_key, LLMNotConfigured, LLMCallError

app = FastAPI(title="arghi", description="Argument Highlighter - relevance heatmap for text")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/highlight", response_model=HighlightResponse)
def highlight(
    req: HighlightRequest,
    x_api_key: Optional[str] = Header(None),
):
    """Highlight text segments relevant to a question."""
    # Set API key from header or body
    api_key = x_api_key or req.api_key
    if api_key:
        set_request_api_key(api_key)

    try:
        response = highlight_text(req.text, req.question)
    except LLMNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LLMCallError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Save query and get hash
    query_hash = save_query(req, response)
    response.hash = query_hash

    return response


def save_query(req: HighlightRequest, response: HighlightResponse) -> str:
    """Save query and response for later retrieval."""
    saved_dir = Path("saved")
    saved_dir.mkdir(exist_ok=True)

    results_dir = Path("saved-results")
    results_dir.mkdir(exist_ok=True)

    # Create hash from text + question (deterministic)
    query_str = f"{req.text}|{req.question}"
    query_hash = hashlib.sha256(query_str.encode()).hexdigest()[:12]

    # Save query
    query_data = {
        "text": req.text,
        "question": req.question,
    }
    with open(saved_dir / f"{query_hash}.json", "w") as f:
        json.dump(query_data, f, indent=2)

    # Save response
    with open(results_dir / f"{query_hash}.json", "w") as f:
        json.dump(response.model_dump(), f, indent=2)

    return query_hash


@app.get("/api/saved")
def list_saved():
    """List saved queries."""
    saved_dir = Path("saved")
    if not saved_dir.exists():
        return {"queries": []}

    queries = []
    for f in sorted(saved_dir.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        with open(f) as fp:
            data = json.load(fp)
        queries.append({
            "hash": f.stem,
            "question": data.get("question", "")[:100],
            "text_preview": data.get("text", "")[:100],
        })

    return {"queries": queries}


@app.get("/api/saved/{query_hash}")
def get_saved(query_hash: str):
    """Get a saved query and its results."""
    query_file = Path("saved") / f"{query_hash}.json"
    results_file = Path("saved-results") / f"{query_hash}.json"

    if not query_file.exists():
        raise HTTPException(status_code=404, detail="Query not found")

    with open(query_file) as f:
        query = json.load(f)

    result = None
    if results_file.exists():
        with open(results_file) as f:
            result = json.load(f)

    return {"query": query, "result": result}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
