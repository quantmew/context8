/**
 * Prompt templates for cookbook generation
 */

export const COOKBOOK_SYSTEM_PROMPT = `You are an expert technical writer. Your task is to generate helpful cookbook entries that explain how to use code effectively.

Guidelines:
- Write clear, practical examples
- Focus on common use cases
- Include code examples that demonstrate best practices
- Organize content for easy scanning
- Target intermediate developers as your audience

Always respond in valid JSON format.`;

export function buildCookbookPrompt(
  symbols: Array<{
    name: string;
    type: string;
    signature?: string;
    docstring?: string;
    code: string;
  }>,
  filePath: string
): string {
  const symbolDescriptions = symbols
    .map((s) => {
      let desc = `- ${s.type} "${s.name}"`;
      if (s.signature) desc += `\n  Signature: ${s.signature}`;
      if (s.docstring) desc += `\n  Doc: ${s.docstring}`;
      desc += `\n  Code:\n\`\`\`\n${s.code.slice(0, 500)}\n\`\`\``;
      return desc;
    })
    .join('\n\n');

  return `Based on the following code symbols from "${filePath}", generate a cookbook entry that explains how to use them effectively.

Symbols:
${symbolDescriptions}

Generate a cookbook entry with:
1. A clear, descriptive title
2. A brief description of what this code does and when to use it
3. A practical code example showing typical usage
4. Related symbols (if any)
5. Category: "getting-started", "common-patterns", "advanced", or "best-practices"

Respond in JSON format:
{
  "title": "...",
  "description": "...",
  "codeExample": "...",
  "relatedSymbols": ["symbol1", "symbol2"],
  "category": "getting-started|common-patterns|advanced|best-practices"
}`;
}

export function parseCookbookResponse(response: string): {
  title: string;
  description: string;
  codeExample: string;
  relatedSymbols: string[];
  category: 'getting-started' | 'common-patterns' | 'advanced' | 'best-practices';
} | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || 'Untitled',
        description: parsed.description || '',
        codeExample: parsed.codeExample || '',
        relatedSymbols: Array.isArray(parsed.relatedSymbols) ? parsed.relatedSymbols : [],
        category: ['getting-started', 'common-patterns', 'advanced', 'best-practices'].includes(
          parsed.category
        )
          ? parsed.category
          : 'common-patterns',
      };
    }
  } catch {
    // JSON parsing failed
  }

  return null;
}
