/**
 * Prompt templates for code summarization
 */

export const SUMMARY_SYSTEM_PROMPT = `You are an expert code analyst. Your task is to analyze code snippets and provide concise, accurate summaries.

Guidelines:
- Be concise but comprehensive
- Focus on what the code does, not how it does it
- Identify the main purpose and functionality
- Extract relevant keywords for searchability
- Assess complexity based on logic, dependencies, and patterns used

Always respond in valid JSON format.`;

export function buildSummaryPrompt(
  code: string,
  language: string,
  symbolName?: string
): string {
  const symbolContext = symbolName ? ` (symbol: ${symbolName})` : '';

  return `Analyze the following ${language} code${symbolContext} and provide:

1. A concise one-sentence summary of what this code does (max 100 words)
2. 3-5 keywords that describe its functionality (for search/indexing)
3. Complexity assessment: "low" (simple logic), "medium" (moderate complexity), or "high" (complex patterns/logic)

Code:
\`\`\`${language}
${code}
\`\`\`

Respond in JSON format:
{
  "summary": "...",
  "keywords": ["keyword1", "keyword2", ...],
  "complexity": "low|medium|high"
}`;
}

export function parseSummaryResponse(response: string): {
  summary: string;
  keywords: string[];
  complexity?: 'low' | 'medium' | 'high';
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        complexity: ['low', 'medium', 'high'].includes(parsed.complexity)
          ? parsed.complexity
          : undefined,
      };
    }
  } catch {
    // If JSON parsing fails, try to extract summary from plain text
  }

  // Fallback: use the response as summary
  return {
    summary: response.slice(0, 500),
    keywords: [],
  };
}
