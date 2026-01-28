from pydantic import BaseModel
from typing import Optional


class HighlightRequest(BaseModel):
    text: str
    question: str
    api_key: Optional[str] = None


class SentenceScore(BaseModel):
    index: int
    text: str
    score: float
    rationale: Optional[str] = None


class HighlightResponse(BaseModel):
    sentences: list[SentenceScore]
    question: str
