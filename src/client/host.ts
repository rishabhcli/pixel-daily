// Thin wrappers around @devvit/web/client so the game also runs in a plain browser (tools/preview.mjs).
import { showToast, showLoginPrompt, requestExpandedMode, navigateTo } from '@devvit/web/client';

export function toast(text: string): void {
  try {
    showToast(text);
  } catch {
    fallbackToast(text);
  }
}

function fallbackToast(text: string): void {
  let el = document.getElementById('fallback-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fallback-toast';
    el.setAttribute('role', 'status');
    el.className = 'fallback-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => (el!.style.display = 'none'), 2200);
}

export function promptLogin(): void {
  try {
    showLoginPrompt();
  } catch {
    toast('Log in to Reddit to save your streak');
  }
}

export function expand(e: MouseEvent): void {
  try {
    requestExpandedMode(e, 'game');
  } catch {
    // Outside Reddit (preview server): just open the game page.
    window.location.href = 'game.html';
  }
}

export function openComments(postId: string | null): void {
  if (!postId || postId === 't3_preview') return toast('Scroll down to the comments under the post');
  try {
    navigateTo(`https://www.reddit.com/comments/${postId.replace(/^t3_/, '')}`);
  } catch {
    toast('Scroll down to the comments under the post');
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
