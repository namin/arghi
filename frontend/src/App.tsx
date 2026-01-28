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
}

function scoreToColor(score: number): string {
  // Map 0-1 score to a color gradient
  // Low scores: nearly transparent
  // High scores: warm orange/red
  if (score < 0.1) return 'transparent'

  // Interpolate from light yellow to deep orange/red
  const hue = 60 - (score * 50) // 60 (yellow) to 10 (red-orange)
  const saturation = 80 + (score * 20) // 80% to 100%
  const lightness = 95 - (score * 35) // 95% to 60%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function App() {
  const [apiKey, setApiKey] = useState('')
  const [text, setText] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<HighlightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredSentence, setHoveredSentence] = useState<number | null>(null)

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">arghi</h1>
        <p className="text-gray-600 mb-6">
          Highlight text relevance as a heatmap. Paste text, ask a question, see what's relevant.
        </p>

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gemini API Key (or set GOOGLE_CLOUD_PROJECT on server)
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

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
              <span>Relevance:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: scoreToColor(0.1) }}></div>
                <span>Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: scoreToColor(0.5) }}></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: scoreToColor(1.0) }}></div>
                <span>High</span>
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

            {/* Tooltip for hovered sentence */}
            {hoveredSentence !== null && result.sentences[hoveredSentence] && (
              <div className="mt-4 p-3 bg-gray-800 text-white rounded-md text-sm">
                <div className="font-medium mb-1">
                  Score: {result.sentences[hoveredSentence].score.toFixed(2)}
                </div>
                {result.sentences[hoveredSentence].rationale && (
                  <div className="text-gray-300">
                    {result.sentences[hoveredSentence].rationale}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
