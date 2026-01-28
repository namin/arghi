import { useState, useEffect } from 'react'
import { API_BASE_URL } from './config'

interface SentenceScore {
  index: number
  text: string
  score: number
  rationale: string | null
}

interface HighlightResponse {
  sentences: SentenceScore[]
  question: string
  hash?: string
}

interface SavedQuery {
  hash: string
  question: string
  text_preview: string
}

function getHashFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('q')
}

function scoreToColor(score: number): string {
  // Map 0-1 score to a color gradient
  // Low scores: nearly transparent / pale yellow
  // Medium scores: orange/amber
  // High scores: green
  if (score < 0.1) return 'transparent'

  // Use distinct color stops:
  // 0.1-0.4: pale yellow
  // 0.4-0.7: orange/amber
  // 0.7-1.0: green
  if (score < 0.4) {
    // Pale yellow
    const intensity = (score - 0.1) / 0.3
    return `hsl(50, 80%, ${92 - intensity * 12}%)`
  } else if (score < 0.7) {
    // Orange/amber
    const intensity = (score - 0.4) / 0.3
    return `hsl(30, 95%, ${75 - intensity * 15}%)`
  } else {
    // Fluorescent/bright green
    const intensity = (score - 0.7) / 0.3
    return `hsl(120, 85%, ${75 - intensity * 15}%)`
  }
}

function App() {
  const [apiKey, setApiKey] = useState('')
  const [text, setText] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<HighlightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredSentence, setHoveredSentence] = useState<number | null>(null)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [showSaved, setShowSaved] = useState(false)

  // Load API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('arghi:apikey')
    if (saved) setApiKey(saved)
  }, [])

  // Save API key to localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('arghi:apikey', apiKey)
    }
  }, [apiKey])

  // Fetch saved queries
  const fetchSavedQueries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/saved`)
      if (response.ok) {
        const data = await response.json()
        setSavedQueries(data.queries || [])
      }
    } catch {
      // Ignore errors
    }
  }

  // Load saved queries on mount
  useEffect(() => {
    fetchSavedQueries()
  }, [])

  // Load a saved query
  const loadSavedQuery = async (hash: string, updateUrl = true) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/saved/${hash}`)
      if (response.ok) {
        const data = await response.json()
        if (data.query) {
          setText(data.query.text || '')
          setQuestion(data.query.question || '')
        }
        if (data.result) {
          setResult(data.result)
        }
        if (updateUrl) {
          window.history.pushState({}, '', `?q=${hash}`)
        }
        setShowSaved(false)
      }
    } catch {
      setError('Failed to load saved query')
    }
  }

  // Load from URL on mount
  useEffect(() => {
    const hash = getHashFromUrl()
    if (hash) {
      loadSavedQuery(hash, false)
    }
  }, [])

  const handleHighlight = async () => {
    if (!text.trim() || !question.trim()) {
      setError('Please enter both text and a question')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/highlight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          text,
          question,
          api_key: apiKey || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Request failed')
      }

      const data = await response.json()
      setResult(data)
      // Update URL with hash
      if (data.hash) {
        window.history.pushState({}, '', `?q=${data.hash}`)
      }
      // Refresh saved queries list
      fetchSavedQueries()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-800">arghi</h1>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showSaved ? 'Hide' : 'Show'} saved queries ({savedQueries.length})
          </button>
        </div>
        <p className="text-gray-600 mb-6">
          Highlight text relevance as a heatmap. Paste text, ask a question, see what's relevant.
        </p>

        {/* Saved queries panel */}
        {showSaved && savedQueries.length > 0 && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-md shadow-sm">
            <h3 className="font-medium text-gray-800 mb-3">Saved Queries</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedQueries.map((q) => (
                <button
                  key={q.hash}
                  onClick={() => loadSavedQuery(q.hash)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <div className="font-medium text-gray-800 truncate">
                    {q.question || '(no question)'}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {q.text_preview}...
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSaved && savedQueries.length === 0 && (
          <div className="mb-6 p-4 bg-gray-100 border border-gray-200 rounded-md text-gray-600 text-sm">
            No saved queries yet. Run a highlight to save it.
          </div>
        )}

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gemini API Key (optional)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Question */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want to find in the text?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Text input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here (article, paper, document...)"
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleHighlight}
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {loading ? 'Analyzing...' : 'Highlight Relevance'}
        </button>

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Results
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Question: <span className="font-medium">{result.question}</span>
            </p>

            {/* Legend and hover info row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Relevance:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: scoreToColor(0.25) }}></div>
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: scoreToColor(0.55) }}></div>
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: scoreToColor(0.9) }}></div>
                  <span>High</span>
                </div>
              </div>
              {/* Inline hover info */}
              <div className="text-sm text-gray-600 min-w-[200px] text-right">
                {hoveredSentence !== null && result.sentences[hoveredSentence] ? (
                  <span>
                    <span className="font-medium">Score: {result.sentences[hoveredSentence].score.toFixed(2)}</span>
                    {result.sentences[hoveredSentence].rationale && (
                      <span className="text-gray-500"> — {result.sentences[hoveredSentence].rationale}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">Hover over text to see details</span>
                )}
              </div>
            </div>

            {/* Highlighted text */}
            <div className="p-4 bg-white border border-gray-200 rounded-md shadow-sm">
              <div className="leading-relaxed">
                {result.sentences.map((s, i) => (
                  <span
                    key={i}
                    className="cursor-pointer rounded px-0.5 transition-all"
                    style={{ backgroundColor: scoreToColor(s.score) }}
                    onMouseEnter={() => setHoveredSentence(i)}
                    onMouseLeave={() => setHoveredSentence(null)}
                  >
                    {s.text}{' '}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
