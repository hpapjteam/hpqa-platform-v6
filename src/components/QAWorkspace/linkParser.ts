import { ExtractedLink } from './types';

function extractTrackingParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const parsedUrl = new URL(url, 'https://dummy.com');
    parsedUrl.searchParams.forEach((value, key) => {
      if (key.startsWith('utm_') || key.includes('track') || key === 'jumpid') {
        params[key] = value;
      }
    });
  } catch (e) {
    // Ignore invalid URLs
  }
  return params;
}

function guessModuleName(a: HTMLAnchorElement, index: number, href: string, text: string, alt: string): string {
  const lowerHref = href.toLowerCase();
  const lowerText = text.toLowerCase();
  const lowerAlt = alt.toLowerCase();

  if (lowerHref.includes('facebook') || lowerHref.includes('linkedin') || lowerHref.includes('twitter') || lowerHref.includes('instagram')) {
    return 'Social Icon';
  }
  if (lowerHref.includes('privacy')) return 'Footer Privacy';
  if (lowerHref.includes('terms')) return 'Footer Terms';
  if (lowerHref.includes('contact')) return 'Footer Contact';
  if (lowerHref.includes('unsubscribe')) return 'Unsubscribe';
  
  if (lowerAlt.includes('hero') || lowerText.includes('hero')) return 'Hero Image';
  if (lowerText.includes('shop') || lowerText.includes('buy') || lowerText.includes('learn more')) return 'CTA Button';
  if (lowerHref.includes('product') || lowerAlt.includes('product')) return 'Product Link';

  return `Module ${index + 1}`;
}

export function extractLinksFromHtml(html: string): ExtractedLink[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const anchors = doc.querySelectorAll('a');
  
  const extracted: ExtractedLink[] = [];
  
  anchors.forEach((a, index) => {
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;

    const imgs = Array.from(a.querySelectorAll('img'));
    const imageUrl = imgs.length > 0 ? (imgs[0].getAttribute('src') || '') : null;
    const alts = imgs.map(img => img.getAttribute('alt')).filter(a => a !== null && a !== '');
    const alt = alts.length > 0 ? alts.join(' | ') : '';
    const linkText = a.textContent?.trim() || '';
    const visibleText = linkText || alt;
    const alias = a.getAttribute('alias') || a.getAttribute('data-alias') || '';
    const title = a.getAttribute('title') || '';
    
    const tracking = extractTrackingParams(href);
    const moduleName = guessModuleName(a, index, href, linkText, alt);

    extracted.push({
      id: `link-${index}`,
      moduleName,
      linkText,
      href,
      alt,
      alias,
      title,
      tracking,
      modulePosition: index,
      imageUrl,
      buttonText: linkText, // Approximation
      visibleText,
      status: "unchecked",
    });
  });

  return extracted;
}


export function extractLinksMerged(codeHtml: string, viewOnlineHtml: string): ExtractedLink[] {
  const parser = new DOMParser();
  const codeDoc = parser.parseFromString(codeHtml, 'text/html');
  const viewDoc = parser.parseFromString(viewOnlineHtml, 'text/html');

  const codeAnchors = Array.from(codeDoc.querySelectorAll('a'));
  const viewAnchors = Array.from(viewDoc.querySelectorAll('a'));

  const extracted: ExtractedLink[] = [];

  // Use viewAnchors for the primary loop since URLs are taking from viewonline
  viewAnchors.forEach((viewA, index) => {
    const codeA = codeAnchors[index];

    const href = viewA.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;

    // Alt and alias should come from code (codeA) if available
    const viewImg = viewA.querySelector('img');
    const codeImg = codeA ? codeA.querySelector('img') : null;

    const imageUrl = viewImg ? (viewImg.getAttribute('src') || '') : null;
    const alt = codeImg ? (codeImg.getAttribute('alt') || '') : (viewImg ? (viewImg.getAttribute('alt') || '') : '');
    
    const linkText = viewA.textContent?.trim() || '';
    const visibleText = linkText || alt;
    const alias = codeA ? (codeA.getAttribute('alias') || codeA.getAttribute('data-alias') || '') : '';
    const title = viewA.getAttribute('title') || (codeA ? codeA.getAttribute('title') || '' : '');
    
    const tracking = extractTrackingParams(href);
    const moduleName = guessModuleName(viewA, index, href, linkText, alt);

    extracted.push({
      id: `link-${index}`,
      moduleName,
      linkText,
      href,
      alt,
      alias,
      title,
      tracking,
      modulePosition: index,
      imageUrl,
      buttonText: linkText,
      visibleText,
      status: "unchecked",
    });
  });

  return extracted;
}

export interface ExtractedTag {
  id: string;
  type: 'alias' | 'alt';
  value: string;
  elementHtml: string;
  isDuplicate: boolean;
}

export function extractTagsFromHtml(html: string): ExtractedTag[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tags: ExtractedTag[] = [];
  
  const anchors = doc.querySelectorAll('a');
  const aliasValues = new Set<string>();
  const duplicateAliases = new Set<string>();
  
  anchors.forEach((a) => {
    const alias = a.getAttribute('alias') || a.getAttribute('data-alias');
    if (alias) {
      if (aliasValues.has(alias)) {
        duplicateAliases.add(alias);
      }
      aliasValues.add(alias);
      tags.push({
        id: `alias-${Math.random().toString(36).substr(2, 9)}`,
        type: 'alias',
        value: alias,
        elementHtml: a.outerHTML.substring(0, 150) + (a.outerHTML.length > 150 ? '...' : ''),
        isDuplicate: false,
      });
    }
  });
  
  const images = doc.querySelectorAll('img');
  images.forEach((img) => {
    const alt = img.getAttribute('alt');
    if (alt !== null) {
      tags.push({
        id: `alt-${Math.random().toString(36).substr(2, 9)}`,
        type: 'alt',
        value: alt,
        elementHtml: img.outerHTML.substring(0, 150) + (img.outerHTML.length > 150 ? '...' : ''),
        isDuplicate: false,
      });
    }
  });
  
  tags.forEach(tag => {
    if (tag.type === 'alias' && duplicateAliases.has(tag.value)) {
      tag.isDuplicate = true;
    }
  });
  
  return tags;
}
