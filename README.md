# arghi - Argument Highlighter

A webapp that highlights text relevance as a heatmap. Paste text, ask a question, see which sentences are most relevant.

## Setup

### Backend

```bash
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Run

### Option 1: Development (two terminals)

**Terminal 1 - Backend:**
```bash
python server.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173

### Option 2: Production build

```bash
cd frontend
npm run build
```

Then serve the `frontend/dist` directory with your preferred static server, and run the backend separately.

## Configuration

### API Key

You can provide a Gemini API key in one of two ways:

1. **Via the UI**: Enter your API key in the input field (stored in localStorage)
2. **Via environment variable**: Set `GEMINI_API_KEY` before starting the server

### Google Cloud Project

Alternatively, use Vertex AI by setting:
```bash
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_LOCATION=us-central1  # optional, defaults to us-central1
```

## Usage

1. Enter your Gemini API key (or configure via environment)
2. Type a question you want answered from the text
3. Paste your text (article, paper, document)
4. Click "Highlight Relevance"
5. View the heatmap:
   - **Yellow** = low relevance
   - **Orange** = medium relevance
   - **Green** = high relevance
6. Hover over sentences to see scores and rationales

## Features

- **Permalinks**: Each query gets a unique URL (`?q=hash`) - share or bookmark results
- **Saved queries**: Click "Show saved queries" to browse and reload past queries
- **Hover details**: See the exact relevance score and LLM rationale for each sentence

## API

### POST /api/highlight

Request:
```json
{
  "text": "Your text here...",
  "question": "What is the main finding?"
}
```

Response:
```json
{
  "sentences": [
    {"index": 0, "text": "First sentence.", "score": 0.2, "rationale": "Background info"},
    {"index": 1, "text": "Key finding here.", "score": 0.9, "rationale": "Directly answers question"}
  ],
  "question": "What is the main finding?",
  "hash": "a1b2c3d4e5f6"
}
```

### GET /api/health

Returns `{"status": "ok"}`

### GET /api/saved

List saved queries.

### GET /api/saved/{hash}

Retrieve a specific saved query and its results.
