import { useEffect, useRef } from 'react';
import Quill from 'quill';
import DOMPurify from 'dompurify';
import 'quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

const TOOLBAR = [
  [{ header: [false, 2, 3] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['clean'],
];

/**
 * Only what a lesson note needs — headings, emphasis, lists. Nothing that
 * lets a teacher paste in formatting (fonts, colours, embeds) that would look
 * fine on screen and print as noise.
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'h2', 'h3'],
  ALLOWED_ATTR: [],
};

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

function normalize(html: string): string {
  return html === '<p><br></p>' ? '' : html;
}

export interface RichTextEditorProps {
  id?: string;
  /**
   * The starting content — read once, on mount. This component is
   * uncontrolled after that point, the same as a native
   * `<textarea defaultValue>`: typing calls `onChange`, but nothing feeds a
   * later `defaultValue` change back into the editor.
   *
   * That is deliberate, not an oversight. A first attempt tried to keep this
   * genuinely controlled — re-applying `value` to Quill whenever it changed
   * for a reason other than the user's own typing — but there is no reliable
   * way to tell those two cases apart from the outside. Comparing HTML
   * strings doesn't work: `quill.root.innerHTML` and a freshly re-sanitised
   * copy of the same content routinely disagree on whitespace or attribute
   * order even when nothing meaningful changed, and every "mismatch" meant
   * overwriting the DOM — which resets the caret to the start. Typing
   * "Hello" produced "olleH": each new keystroke landed at position 0,
   * before the last one. Tracking "the exact string this component last
   * emitted" instead of comparing HTML closed that hole, but opened a
   * narrower one under fast typing: Quill's `text-change` fires outside
   * React's own event system, so on rapid input a newer keystroke can update
   * that tracked value before React has committed the render for an older
   * one, and the effect for the older render then reapplies stale content
   * over what the user already typed.
   *
   * Loading different content later — an existing note arriving from an
   * async fetch, or switching between two notes — has to force a fresh
   * mount instead: give this component a `key` that changes with the
   * underlying record (e.g. the note's id) so React tears down the old
   * Quill instance and creates a new one seeded with the new
   * `defaultValue`, rather than trying to hot-swap content into a live one.
   */
  defaultValue: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * A Quill editor storing sanitised HTML.
 *
 * The read path is the one that matters for security here: `content` is
 * saved once and re-opened by someone else entirely (a head of department
 * reviewing it), so the initial HTML is sanitised on the way in regardless
 * of who or what produced it — never trusted just because this component
 * happened to write it out originally.
 */
export function RichTextEditor({
  id,
  defaultValue,
  onChange,
  readOnly = false,
  placeholder,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const editorEl = document.createElement('div');
    container.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      readOnly,
      placeholder,
      modules: { toolbar: readOnly ? false : TOOLBAR },
    });

    if (id) quill.root.id = id;
    if (ariaDescribedBy) quill.root.setAttribute('aria-describedby', ariaDescribedBy);
    if (ariaInvalid) quill.root.setAttribute('aria-invalid', 'true');

    // Quill's own clipboard API, not a raw `innerHTML` write — that keeps
    // Quill's internal document model and the DOM in sync from the start.
    // 'silent' so this seed is not itself reported back through
    // `text-change` as if the user had typed it.
    quill.clipboard.dangerouslyPasteHTML(sanitize(defaultValue), 'silent');

    quill.on('text-change', () => {
      onChangeRef.current(normalize(quill.root.innerHTML));
    });

    return () => {
      container.replaceChildren();
    };
    // `defaultValue` is intentionally excluded — see the prop's own doc
    // comment for why this component does not react to it after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, placeholder, id, ariaDescribedBy, ariaInvalid]);

  return <div ref={containerRef} className={cn('rich-text-editor', className)} />;
}
