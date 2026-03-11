export interface ExtractedContent {
  title: string;
  summary: string;
  source_type: "webpage" | "github" | "youtube" | "unknown";
}

function isGitHubUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\//.test(url);
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "Untitled";
}

export async function extractUrlContent(url: string): Promise<ExtractedContent> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Asagiri-Sasagani/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { title: url, summary: `Failed to fetch (HTTP ${response.status})`, source_type: "unknown" };
    }
    const html = await response.text();
    const title = extractTitle(html);
    const text = stripHtml(html);
    const summary = text.slice(0, 2000);

    let source_type: ExtractedContent["source_type"] = "webpage";
    if (isGitHubUrl(url)) source_type = "github";
    else if (isYouTubeUrl(url)) source_type = "youtube";

    return { title, summary, source_type };
  } catch {
    return { title: url, summary: "Extraction failed", source_type: "unknown" };
  }
}
