/**
 * @file generateContent.ts
 * @description Client wrapper for the backend proxy's /api/generate endpoint.
 * Replaces direct client-side GoogleGenAI usage so GEMINI_API_KEY never ships
 * to the browser. Throws on failure — callers decide their own fallback behavior.
 */

export async function generateContent(prompt: string, model?: string): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Generation request failed (${response.status})`);
  }

  const data = await response.json();
  return data.text || '';
}
