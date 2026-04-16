'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  hasResume: boolean;
}

const SUGGESTED_PROMPTS = [
  'Find jobs that match my resume',
  'Why am I not getting interviews?',
  'What skills am I missing for AI roles?',
];

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#555566] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  );
}

// Render inline markdown: **bold** and bare URLs as clickable links
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-[#f0f0fa]">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      // Trim trailing punctuation that's not part of the URL
      const url = token.replace(/[.,;:!?)\]]+$/, '');
      const trailing = token.slice(url.length);
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline break-all"
        >
          {url}
        </a>
      );
      if (trailing) parts.push(trailing);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="leading-7">
      {lines.map((line, i) => {
        if (line === '') {
          return <div key={i} className="h-3" />;
        }
        return (
          <p key={i} className="text-sm text-[#f0f0fa]">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatClient({ hasResume }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const atLimit = messages.filter(m => m.role === 'user').length >= 20;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  async function sendMessage(query: string) {
    if (!query.trim() || isStreaming || atLimit) return;

    const userMessage: Message = { role: 'user', content: query.trim() };
    const historyBeforeSend = messages;

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Placeholder for streaming assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyBeforeSend,
          query: query.trim(),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        const msg = data.error ?? 'Something went wrong';
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: msg };
          return next;
        });
        return;
      }

      if (!res.body) {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: 'No response received.' };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush any remaining bytes in the decoder
          const flushed = decoder.decode();
          if (flushed) {
            accumulated += flushed;
            const snap = accumulated;
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: snap };
              return next;
            });
          }
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          accumulated += chunk;
          const snap = accumulated;
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: snap };
            return next;
          });
        }
      }

      // If the stream completed with no content, show an error
      if (!accumulated) {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: 'No response received. Please try again.' };
          return next;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: accumulated || 'Failed to get a response. Please try again.',
        };
        return next;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function handleNewChat() {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setInput('');
    setIsStreaming(false);
    inputRef.current?.focus();
  }

  const showTypingIndicator = isStreaming && messages.at(-1)?.content === '';

  return (
    <div className="flex flex-col h-full bg-[#0d0d12]">
      {/* Fixed header */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#2a2a35] bg-[#1a1a24] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <SparkleIcon className="text-indigo-400 h-5 w-5" />
          <div>
            <span className="text-base font-bold text-[#f0f0fa]">NextRole AI</span>
            <span className="ml-2 text-xs text-[#555566]">Powered by Claude</span>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          className="rounded-lg border border-[#2a2a35] bg-transparent px-3 py-1.5 text-xs font-medium text-[#8888aa] transition-colors hover:bg-[#2a2a35] hover:text-[#f0f0fa]"
        >
          New Chat
        </button>
      </div>

      {/* Resume banner */}
      {!hasResume && !resumeBannerDismissed && (
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#2a2a35] bg-[#1a1a24] px-4 py-2.5 sm:px-6">
          <p className="text-xs text-[#8888aa]">
            For personalized results,{' '}
            <a href="/profile" className="text-indigo-400 hover:underline">
              upload your resume on your Profile page
            </a>
          </p>
          <button
            onClick={() => setResumeBannerDismissed(true)}
            className="shrink-0 text-[#555566] hover:text-[#8888aa] transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <SparkleIcon className="h-12 w-12 text-indigo-400 mb-4" />
            <h2 className="text-xl font-bold text-[#f0f0fa]">Your AI Job Search Assistant</h2>
            <p className="mt-2 max-w-sm text-sm text-[#8888aa]">
              Ask me to find jobs that match your resume, analyze your resume, or explain why you might not be getting callbacks
            </p>
            <div className="mt-6 flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => void sendMessage(prompt)}
                  disabled={isStreaming}
                  className="rounded-xl border border-[#2a2a35] bg-[#1a1a24] px-4 py-3 text-sm text-[#e0e0f0] text-left transition-colors hover:border-indigo-500/40 hover:bg-[#1e1e2c] disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isLastAssistant = !isUser && i === messages.length - 1;
              const showLabel =
                !isUser &&
                (i === 0 || messages[i - 1]?.role === 'user');

              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${isUser ? '' : 'flex flex-col gap-1'}`}>
                    {showLabel && (
                      <span className="text-[11px] font-medium text-[#555566] px-1">NextRole AI</span>
                    )}
                    <div
                      className={
                        isUser
                          ? 'rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm text-white'
                          : 'rounded-2xl rounded-tl-sm border border-[#2a2a35] bg-[#1a1a24] px-4 py-3 text-sm text-[#f0f0fa]'
                      }
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                      ) : isLastAssistant && showTypingIndicator ? (
                        <TypingIndicator />
                      ) : (
                        <MessageContent content={msg.content} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Fixed input area */}
      <div className="shrink-0 border-t border-[#2a2a35] bg-[#1a1a24] px-4 py-3 sm:px-6">
        {atLimit ? (
          <p className="text-center text-sm text-[#8888aa]">
            Conversation limit reached.{' '}
            <button onClick={handleNewChat} className="text-indigo-400 hover:underline">
              Start a new chat.
            </button>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about jobs, your resume, or career advice..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-[#2a2a35] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0fa] placeholder:text-[#555566] focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
