export async function safeJson(response) {
  if (!response) return null;
  try {
    const text = await response.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn('safeJson parse warning:', err.message);
    return null;
  }
}
