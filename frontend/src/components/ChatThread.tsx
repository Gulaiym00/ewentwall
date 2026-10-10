'use client';

import { useEffect, useRef, useState } from 'react';
import { CHAT_IMAGE_MAX_MB, type ChatMessage, type OutgoingMessage } from '@/api/support';
import { useToast } from '@/components/Toast';
import { IconButton } from '@/ui';
import { cx } from '@/utils/cx';
import { formatDate, formatDateTime } from '@/utils/format';
import { useT } from '@/utils/locale';

/** Calls `tick` every `ms` while the tab is visible (chat updates are fetched by polling). */
export function usePolling(tick: () => void, ms: number) {
  const ref = useRef(tick);
  useEffect(() => { ref.current = tick; });
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') ref.current(); }, ms);
    const onVisible = () => { if (document.visibilityState === 'visible') ref.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [ms]);
}

const day = (iso: string) => iso.slice(0, 10);

const EMOJIS = ['😀', '😂', '🥹', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😉', '🙂', '🤔', '😅', '😢', '😭', '😡', '😱', '😴', '🤗',
  '👍', '👎', '👏', '🙏', '👌', '✌️', '🤝', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🔥', '✨', '🎉', '✅', '❌', '⭐'];
const STICKERS = ['👍', '❤️', '😂', '🥳', '🎉', '🙏', '👏', '🔥', '😍', '😢', '🤔', '👌', '✅', '📸', '💐', '🎂', '💍', '🥂'];

/** 1–3 emoji and nothing else: shown large without a bubble, like a sticker. */
const isSticker = (text: string) => {
  const s = text.replace(/\s/g, '');
  if (!s || /^[\d#*]+$/.test(s) || !/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u.test(s)) return false;
  return [...new Intl.Segmenter().segment(s)].length <= 3;
};

/**
 * Message list + composer shared by Dashboard → Support (organizer) and Admin → Support.
 * `mine` decides which side a bubble is on. Enter sends, Shift+Enter adds a line.
 * The smiley button opens emoji (inserted into the text) and stickers (sent right away).
 * Pictures and GIFs come from the paperclip, a paste (Ctrl+V, or a keyboard's sticker/GIF) or drag & drop.
 */
export default function ChatThread({ messages, mine, onSend, empty, className }: {
  messages: ChatMessage[];
  mine: (m: ChatMessage) => boolean;
  onSend: (message: OutgoingMessage) => Promise<boolean>;
  empty?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const toast = useToast();
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState<null | 'emoji' | 'stickers'>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Free the preview's object URL when it's replaced or the chat closes.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  /** Takes the first image from a file list (picker, paste or drop); returns false if there is none. */
  const attach = (files: FileList | File[] | null | undefined) => {
    const file = [...(files ?? [])].find(f => f.type.startsWith('image/'));
    if (!file) return false;
    if (file.size > CHAT_IMAGE_MAX_MB * 1024 * 1024) {
      toast(t(`The image must be under ${CHAT_IMAGE_MAX_MB} MB`, `Картинка должна быть меньше ${CHAT_IMAGE_MAX_MB} МБ`), 'danger');
      return true;
    }
    setImage({ file, url: URL.createObjectURL(file) });
    inputRef.current?.focus();
    return true;
  };

  // Keep the newest message in view when one arrives.
  const last = messages.at(-1)?.id;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  // Close the picker on a click outside it or on Escape.
  useEffect(() => {
    if (!picker) return;
    const onDown = (e: PointerEvent) => { if (!pickerRef.current?.contains(e.target as Node)) setPicker(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicker(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [picker]);

  /** Sends the composer (text + attached image), or just a sticker without touching the composer. */
  const submit = async (sticker?: string) => {
    const message = sticker ? { text: sticker } : { text: text.trim(), image: image?.file };
    if ((!message.text && !message.image) || sending) return;
    setSending(true);
    if (await onSend(message) && !sticker) { setText(''); setImage(null); }
    setSending(false);
  };

  /** Puts the emoji at the cursor and keeps typing there. */
  const insert = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const sendSticker = (sticker: string) => {
    setPicker(null);
    submit(sticker);
  };

  return (
    <div className={cx('relative flex min-h-0 flex-col', className)}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); attach(e.dataTransfer.files); }}>
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent-soft/90 text-sm font-semibold text-accent">
          {t('Drop the image to attach it', 'Отпустите, чтобы прикрепить картинку')}
        </div>
      )}
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && empty}
        {messages.map((m, i) => {
          const own = mine(m);
          const newDay = i === 0 || day(messages[i - 1].createdAt) !== day(m.createdAt);
          const sameAuthor = i > 0 && !newDay && messages[i - 1].fromAdmin === m.fromAdmin;
          const time = formatDateTime(m.createdAt, { timeStyle: 'short' });
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center text-xs font-medium text-muted">{formatDate(day(m.createdAt))}</p>}
              <div className={cx('flex', own ? 'justify-end' : 'justify-start')}>
                {!m.imageUrl && isSticker(m.text) ? (
                  <div className={cx('flex flex-col', own ? 'items-end' : 'items-start')}>
                    {!own && !sameAuthor && <p className="mb-0.5 text-xs font-semibold text-accent">{m.authorName}</p>}
                    <p className="text-5xl leading-tight" role="img" aria-label={m.text}>{m.text}</p>
                    <p className="text-[11px] text-muted">{time}</p>
                  </div>
                ) : (
                  <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2 md:max-w-[70%]',
                    own ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md border border-line bg-surface')}>
                    {!own && !sameAuthor && <p className="mb-0.5 text-xs font-semibold text-accent">{m.authorName}</p>}
                    {m.imageUrl && (
                      <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="-mx-1.5 mt-0.5 mb-1 block">
                        <img src={m.imageUrl} alt={t('Image', 'Картинка')} loading="lazy"
                          className="max-h-72 w-auto max-w-full rounded-xl object-contain" onLoad={() => { if (m.id === last) listRef.current?.scrollTo({ top: 1e9 }); }} />
                      </a>
                    )}
                    {m.text && <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{m.text}</p>}
                    <p className={cx('mt-0.5 text-right text-[11px]', own ? 'text-white/70' : 'text-muted')}>{time}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {image && (
        <div className="flex items-center gap-3 border-t border-line px-3 pt-3">
          <img src={image.url} alt={t('Attached image', 'Прикреплённая картинка')} className="size-16 rounded-lg border border-line object-cover" />
          <p className="min-w-0 flex-1 truncate text-xs text-muted">{image.file.name}</p>
          <IconButton icon="x" label={t('Remove image', 'Убрать картинку')} onClick={() => setImage(null)} />
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); submit(); }} className={cx('relative flex items-end gap-1 p-3 sm:gap-2', !image && 'border-t border-line')}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={e => { attach(e.target.files); e.target.value = ''; }} />
        <IconButton icon="paperclip" label={t('Attach a picture or GIF', 'Прикрепить картинку или GIF')} onClick={() => fileRef.current?.click()} className="size-10" />
        <div ref={pickerRef} className="contents">
          <IconButton icon="smile" label={t('Emoji and stickers', 'Эмодзи и стикеры')} aria-expanded={!!picker}
            onClick={() => setPicker(p => (p ? null : 'emoji'))} className={cx('size-10', picker && 'bg-bg text-accent')} />
          {picker && (
            <div role="dialog" aria-label={t('Emoji and stickers', 'Эмодзи и стикеры')}
              className="fade-in absolute bottom-full left-3 z-20 mb-2 w-[min(340px,calc(100%-24px))] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              <div className="flex border-b border-line text-[13px] font-semibold">
                {(['emoji', 'stickers'] as const).map(p => (
                  <button key={p} type="button" onClick={() => setPicker(p)} aria-pressed={picker === p}
                    className={cx('flex-1 py-2.5 transition-colors', picker === p ? 'text-accent shadow-[inset_0_-2px_0_var(--accent)]' : 'text-muted hover:text-fg')}>
                    {p === 'emoji' ? t('Emoji', 'Эмодзи') : t('Stickers', 'Стикеры')}
                  </button>
                ))}
              </div>
              {picker === 'emoji' ? (
                <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
                  {EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => insert(e)} aria-label={e}
                      className="flex aspect-square items-center justify-center rounded-lg text-2xl transition-transform hover:scale-110 hover:bg-bg">{e}</button>
                  ))}
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto p-2">
                  {STICKERS.map(s => (
                    <button key={s} type="button" onClick={() => sendSticker(s)} disabled={sending} aria-label={t(`Send ${s}`, `Отправить ${s}`)}
                      className="flex aspect-square items-center justify-center rounded-xl text-4xl transition-transform hover:scale-110 hover:bg-bg disabled:opacity-50">{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <label htmlFor="chat-input" className="sr-only">{t('Message', 'Сообщение')}</label>
        <textarea id="chat-input" ref={inputRef} rows={1} maxLength={2000} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          // A pasted screenshot, or a sticker/GIF from the phone keyboard, arrives as a file.
          onPaste={e => { if (attach(e.clipboardData.files)) e.preventDefault(); }}
          placeholder={t('Write a message…', 'Напишите сообщение…')}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2 text-base leading-relaxed text-fg outline-none placeholder:text-muted focus:border-accent md:text-sm"
          style={{ fieldSizing: 'content' } as React.CSSProperties} />
        <IconButton type="submit" icon="arrowRight" label={t('Send', 'Отправить')} disabled={sending || (!text.trim() && !image)}
          className="size-10 bg-accent text-white hover:bg-accent hover:text-white hover:opacity-90" />
      </form>
    </div>
  );
}
