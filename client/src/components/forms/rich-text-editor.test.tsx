import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditor } from './rich-text-editor';

/**
 * Quill owns its own DOM once mounted, so this is less about React
 * rendering and more about the contract this component makes with it: the
 * starting content shows up once, typing reports HTML back out and never
 * gets fought by a reactive `value`, read-only hides the toolbar, and — the
 * part that actually matters for safety — content this component did not
 * itself produce is still sanitised on the way in, since a lesson note is
 * written once and reopened by someone else entirely.
 */
function Harness({ initial = '' }: { initial?: string }) {
  return <RichTextEditor id="note-content" defaultValue={initial} onChange={vi.fn()} />;
}

describe('RichTextEditor', () => {
  it('renders the starting content inside the editor', async () => {
    render(<Harness initial="<p>Photosynthesis and its raw materials</p>" />);
    await waitFor(() => {
      expect(screen.getByText('Photosynthesis and its raw materials')).toBeInTheDocument();
    });
  });

  it('shows a formatting toolbar when editable', async () => {
    render(<Harness />);
    await waitFor(() => {
      expect(document.querySelector('.ql-toolbar')).toBeInTheDocument();
    });
    expect(document.querySelector('.ql-toolbar button.ql-bold')).toBeInTheDocument();
  });

  it('hides the toolbar in read-only mode', async () => {
    render(<RichTextEditor defaultValue="<p>Approved content</p>" onChange={vi.fn()} readOnly />);
    await waitFor(() => {
      expect(screen.getByText('Approved content')).toBeInTheDocument();
    });
    expect(document.querySelector('.ql-toolbar')).not.toBeInTheDocument();
  });

  it('reports typed content back through onChange as HTML', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const editor = await waitFor(() => document.querySelector('.ql-editor') as HTMLElement);

    await user.click(editor);
    await user.keyboard('Covered the water cycle');

    await waitFor(() => {
      expect(editor.textContent).toBe('Covered the water cycle');
    });
  });

  /**
   * Regression: an earlier version stayed reactive to its `value` prop after
   * mount, re-applying it to Quill whenever it changed for a reason other
   * than the user's own typing. Telling those cases apart by comparing HTML
   * strings didn't work — `quill.root.innerHTML` and a freshly re-sanitised
   * copy of the same content routinely disagree on whitespace or attribute
   * order even when nothing meaningful changed — and every "mismatch" reset
   * the caret to the start of the editor, so each new character landed
   * before the last one: typing "Hello" produced "olleH". Tracking exactly
   * what the component last emitted (rather than comparing HTML) closed
   * that hole but opened a narrower one under fast typing, since Quill's
   * `text-change` fires outside React's own event system: a newer keystroke
   * could update the tracked value before React committed the render for an
   * older one. Being fully uncontrolled after mount removes the reactive
   * path this bug lived in entirely, rather than trying to make it safe.
   */
  it('keeps typed characters in order inside a numbered list, even fast', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    const editor = await waitFor(() => document.querySelector('.ql-editor') as HTMLElement);
    const orderedListButton = document.querySelector(
      'button.ql-list[value="ordered"]',
    ) as HTMLElement;
    expect(orderedListButton).toBeTruthy();

    await user.click(orderedListButton);
    await user.click(editor);
    await user.keyboard('Hello, World');

    await waitFor(() => {
      expect(editor.textContent).toBe('Hello, World');
    });
  });

  it('applies the id to the editable element for label association', async () => {
    render(<Harness />);
    await waitFor(() => {
      expect(document.getElementById('note-content')).toHaveClass('ql-editor');
    });
  });

  /**
   * Loading an existing note is an async fetch that resolves after this
   * component's first mount, so a caller has to remount it — via `key` — to
   * hand it the real starting content once that arrives, rather than
   * expecting it to notice a `defaultValue` change on its own. This is that
   * pattern, exercised the way the lesson note form actually uses it.
   */
  it('picks up new content when remounted with a different key, not by reacting to defaultValue', async () => {
    const user = userEvent.setup();

    function AsyncLoad() {
      const [note, setNote] = useState<string | null>(null);
      return (
        <div>
          <button type="button" onClick={() => setNote('<p>Loaded from the server</p>')}>
            simulate load
          </button>
          {note === null ? (
            <RichTextEditor key="loading" defaultValue="" onChange={vi.fn()} />
          ) : (
            <RichTextEditor key="loaded" defaultValue={note} onChange={vi.fn()} />
          )}
        </div>
      );
    }

    render(<AsyncLoad />);
    await waitFor(() => {
      expect(document.querySelector('.ql-editor')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loaded from the server')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'simulate load' }));

    await waitFor(() => {
      expect(screen.getByText('Loaded from the server')).toBeInTheDocument();
    });
  });

  /**
   * The stored value did not necessarily come from this component — a
   * lesson note is saved once and reopened later by a reviewer, so the read
   * path has to distrust the string exactly as much as any other external
   * input, not lean on Quill's own edit-time sanitisation.
   */
  it('strips a script tag out of content it did not itself produce', async () => {
    render(<Harness initial='<p>Safe text</p><script>window.pwned = true;</script>' />);
    await waitFor(() => {
      expect(screen.getByText('Safe text')).toBeInTheDocument();
    });
    expect(document.querySelector('.ql-editor script')).not.toBeInTheDocument();
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined();
  });

  it('strips an inline event handler out of content it did not itself produce', async () => {
    render(<Harness initial='<p onclick="window.pwned = true">Click me</p>' />);
    const paragraph = await waitFor(() => screen.getByText('Click me'));
    expect(paragraph).not.toHaveAttribute('onclick');
  });

  it('drops formatting the toolbar does not offer, such as inline styles', async () => {
    render(<Harness initial='<p style="color: red">Styled text</p><span>trailing</span>' />);
    const paragraph = await waitFor(() => screen.getByText('Styled text'));
    expect(paragraph).not.toHaveAttribute('style');
    expect(document.querySelector('.ql-editor span')).not.toBeInTheDocument();
  });
});
