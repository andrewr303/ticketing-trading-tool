const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-flash-2.5";

export async function callClaude(prompt: string, useWebSearch: boolean = false): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing VITE_OPENROUTER_API_KEY. Add it to your .env file."
    );
  }

  const model = useWebSearch ? `${DEFAULT_MODEL}:online` : DEFAULT_MODEL;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Ticket Trading AI Suite",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json();

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenRouter returned an empty response");
  }

  return text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
}
