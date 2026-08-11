export interface TextIssue {
  id: string;
  type: 'spelling' | 'grammar' | 'widow' | 'brand' | 'formatting';
  severity: 'error' | 'warning' | 'info';
  message: string;
  context: string;
  word: string;
  suggestions?: string[];
  lineNumber?: number;
}

export interface TextAnalysisResult {
  totalWords: number;
  issues: TextIssue[];
  widowWordsCount: number;
  spellingErrorsCount: number;
  brandInconsistenciesCount: number;
}

// Common marketing typos & brand vocabulary rules
const DICTIONARY_REPLACEMENTS: Record<string, string[]> = {
  recieve: ['receive'],
  teh: ['the'],
  seperate: ['separate'],
  untill: ['until'],
  occurred: ['occurred'],
  "offer's": ['offers', "offer's"],
  clik: ['click'],
  discounts: ['discounts'],
  promtion: ['promotion'],
  guaranteee: ['guarantee'],
  subscribtion: ['subscription'],
  unsubcribe: ['unsubscribe'],
};

// Brand dictionary rules
const BRAND_RULES: { pattern: RegExp; correction: string; reason: string }[] = [
  { pattern: /\bhp\b(?![-_])/gi, correction: 'HP', reason: 'Brand name "HP" must always be uppercase.' },
  { pattern: /\bedm\b/gi, correction: 'eDM', reason: 'Email Direct Mail should be capitalized as "eDM".' },
  { pattern: /\bsfmc\b/gi, correction: 'SFMC', reason: 'Salesforce Marketing Cloud should be "SFMC".' },
  { pattern: /\bintel\b/gi, correction: 'Intel', reason: 'Brand name "Intel" should be capitalized.' },
  { pattern: /\bryzen\b/gi, correction: 'Ryzen', reason: 'Brand name "Ryzen" should be capitalized.' },
  { pattern: /\bwindows\b/gi, correction: 'Windows', reason: 'Product name "Windows" should be capitalized.' },
];

/**
 * Strips HTML tags and extracts plain text blocks with line context
 */
export function extractTextBlocks(html: string): { text: string; rawBlocks: string[] } {
  if (!html) return { text: '', rawBlocks: [] };

  // Remove style and script tags
  const cleanHtml = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanHtml, 'text/html');
  const bodyText = doc.body.textContent || '';

  // Extract paragraphs, headers, spans for block analysis
  const blockElements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, td, div, span, a, li');
  const rawBlocks: string[] = [];

  blockElements.forEach((el) => {
    // Only process leaf text nodes or elements without nested text containers
    if (el.children.length === 0 || Array.from(el.children).every(c => ['span', 'a', 'b', 'strong', 'i', 'sup', 'sub'].includes(c.tagName.toLowerCase()))) {
      const txt = (el.textContent || '').trim();
      if (txt.length > 2 && !rawBlocks.includes(txt)) {
        rawBlocks.push(txt);
      }
    }
  });

  return { text: bodyText, rawBlocks };
}

/**
 * Analyzes English text for spelling typos, widow words, brand consistency, and grammar
 */
export async function analyzeEnglishText(html: string): Promise<TextAnalysisResult> {
  const { text, rawBlocks } = extractTextBlocks(html);
  const issues: TextIssue[] = [];

  if (!text) {
    return {
      totalWords: 0,
      issues: [],
      widowWordsCount: 0,
      spellingErrorsCount: 0,
      brandInconsistenciesCount: 0,
    };
  }

  const words = text.match(/\b[A-Za-z']+\b/g) || [];
  const totalWords = words.length;

  let widowWordsCount = 0;
  let spellingErrorsCount = 0;
  let brandInconsistenciesCount = 0;

  // 1. Detect Widow Words in Paragraph / Block Headings
  rawBlocks.forEach((block, blockIdx) => {
    const blockWords = block.trim().split(/\s+/);
    if (blockWords.length >= 3) {
      const lastWord = blockWords[blockWords.length - 1].replace(/[^a-zA-Z]/g, '');
      const secondLastWord = blockWords[blockWords.length - 2].replace(/[^a-zA-Z]/g, '');

      // Check if last word is a short orphan (1-3 letters) sitting alone at the end
      if (lastWord.length >= 1 && lastWord.length <= 3 && !block.includes('&nbsp;')) {
        widowWordsCount++;
        issues.push({
          id: `widow-${blockIdx}`,
          type: 'widow',
          severity: 'warning',
          message: `Widow word detected: "${lastWord}" sits alone at the end of text block.`,
          context: `"...${secondLastWord} ${lastWord}"`,
          word: lastWord,
          suggestions: [`Replace space with &nbsp; before "${lastWord}"`],
        });
      }
    }
  });

  // 2. Check Marketing Dictionary Typos & Repeated Words
  words.forEach((word, idx) => {
    const lowerWord = word.toLowerCase();

    // Dictionary typo check
    if (DICTIONARY_REPLACEMENTS[lowerWord]) {
      spellingErrorsCount++;
      const suggestions = DICTIONARY_REPLACEMENTS[lowerWord];
      const prevWord = words[idx - 1] || '';
      const nextWord = words[idx + 1] || '';
      issues.push({
        id: `spell-${idx}-${word}`,
        type: 'spelling',
        severity: 'error',
        message: `Possible spelling mistake: "${word}".`,
        context: `"...${prevWord} ${word} ${nextWord}..."`,
        word,
        suggestions,
      });
    }

    // Repeated word check (e.g., "the the")
    if (idx > 0 && lowerWord.length > 2) {
      const prevWord = words[idx - 1].toLowerCase();
      if (lowerWord === prevWord && !['that', 'had'].includes(lowerWord)) {
        issues.push({
          id: `repeat-${idx}-${word}`,
          type: 'grammar',
          severity: 'warning',
          message: `Repeated word detected: "${word} ${word}".`,
          context: `"...${words[idx - 2] || ''} ${word} ${word} ${words[idx + 1] || ''}..."`,
          word: `${word} ${word}`,
          suggestions: [`Remove duplicate "${word}"`],
        });
      }
    }
  });

  // 3. Brand Consistency Check
  BRAND_RULES.forEach((rule, ruleIdx) => {
    let match: RegExpExecArray | null;
    const regex = new RegExp(rule.pattern);
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      if (matchedText !== rule.correction) {
        brandInconsistenciesCount++;
        const startIndex = Math.max(0, match.index - 15);
        const endIndex = Math.min(text.length, match.index + matchedText.length + 15);
        const snippet = text.substring(startIndex, endIndex);

        issues.push({
          id: `brand-${ruleIdx}-${match.index}`,
          type: 'brand',
          severity: 'info',
          message: rule.reason,
          context: `"...${snippet}..."`,
          word: matchedText,
          suggestions: [rule.correction],
        });
      }
    }
  });

  // 4. Try LanguageTool API for deep online English spell check (if available)
  try {
    const truncatedText = text.substring(0, 2000); // Send up to 2000 chars
    const params = new URLSearchParams({
      text: truncatedText,
      language: 'en-US',
    });

    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.matches && Array.isArray(data.matches)) {
        data.matches.forEach((m: any, idx: number) => {
          if (m.rule && m.rule.category && m.rule.category.id !== 'TYPOGRAPHY') {
            const badWord = truncatedText.substring(m.offset, m.offset + m.length);
            const suggestions = (m.replacements || []).slice(0, 3).map((r: any) => r.value);

            // Avoid duplicate entries from our local dictionary
            if (!issues.some(i => i.word.toLowerCase() === badWord.toLowerCase())) {
              spellingErrorsCount++;
              issues.push({
                id: `lt-${idx}-${m.offset}`,
                type: 'spelling',
                severity: m.rule.issueType === 'misspelling' ? 'error' : 'warning',
                message: m.message || `LanguageTool issue on "${badWord}"`,
                context: m.context ? `"...${m.context.text}..."` : badWord,
                word: badWord,
                suggestions,
              });
            }
          }
        });
      }
    }
  } catch (err) {
    console.log('LanguageTool API offline or unreachable, using local spellcheck rules.');
  }

  return {
    totalWords,
    issues,
    widowWordsCount,
    spellingErrorsCount,
    brandInconsistenciesCount,
  };
}
