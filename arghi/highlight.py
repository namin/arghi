"""Core highlighting logic - score sentences by relevance to a question."""

import json
import re
from typing import Optional

from .llm import call_llm
from .schema import SentenceScore, HighlightResponse


def split_sentences(text: str) -> list[str]:
    """Split text into sentences."""
    # Simple sentence splitting - handles common cases
    # Split on . ! ? followed by space and capital letter, or end of string
    pattern = r'(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$'

    # First, normalize whitespace
    text = re.sub(r'\s+', ' ', text.strip())

    # Split into sentences
    sentences = re.split(pattern, text)

    # Clean up and filter empty
    sentences = [s.strip() for s in sentences if s.strip()]

    return sentences


def score_sentences(
    sentences: list[str],
    question: str,
    model: str = "gemini-2.5-flash",
) -> list[SentenceScore]:
    """Score each sentence's relevance to the question using LLM."""

    # Build numbered list of sentences
    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(sentences))

    prompt = f"""You are analyzing a text to find parts relevant to a specific question.

QUESTION: {question}

TEXT (numbered sentences):
{numbered}

For each sentence, score its relevance to answering the question on a scale of 0.0 to 1.0:
- 0.0 = completely irrelevant
- 0.3 = tangentially related
- 0.5 = somewhat relevant
- 0.7 = relevant
- 1.0 = directly answers or is crucial to the question

Return a JSON object with this exact format:
{{
  "scores": [
    {{"index": 1, "score": 0.8, "rationale": "brief reason"}},
    {{"index": 2, "score": 0.2, "rationale": "brief reason"}},
    ...
  ]
}}

Include ALL sentences. Be precise with scores - most sentences should be low (0.0-0.3) unless truly relevant.
Return ONLY the JSON, no other text."""

    response = call_llm(prompt, model=model)

    # Parse JSON from response
    # Handle potential markdown code blocks
    response = response.strip()
    if response.startswith("```"):
        response = re.sub(r'^```(?:json)?\n?', '', response)
        response = re.sub(r'\n?```$', '', response)

    try:
        data = json.loads(response)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}\nResponse: {response}")

    # Build scored sentences
    scores_by_index = {item["index"]: item for item in data["scores"]}

    result = []
    for i, sentence in enumerate(sentences):
        idx = i + 1  # 1-indexed
        item = scores_by_index.get(idx, {"score": 0.0, "rationale": None})
        result.append(SentenceScore(
            index=i,
            text=sentence,
            score=item.get("score", 0.0),
            rationale=item.get("rationale"),
        ))

    return result


def highlight_text(
    text: str,
    question: str,
    model: str = "gemini-2.5-flash",
) -> HighlightResponse:
    """Main entry point - split text and score sentences."""
    sentences = split_sentences(text)

    if not sentences:
        return HighlightResponse(sentences=[], question=question)

    scored = score_sentences(sentences, question, model=model)

    return HighlightResponse(sentences=scored, question=question)
