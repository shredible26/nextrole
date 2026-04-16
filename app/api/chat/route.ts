import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function getEmbedding(text: string): Promise<number[] | null> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0]?.embedding ?? null;
}

function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  if (magnitude === 0) return vec;
  return vec.map(x => x / magnitude);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('tier, resume_embedding, resume_text')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.tier !== 'pro') {
      return NextResponse.json({ error: 'Pro required' }, { status: 402 });
    }

    let body: { messages?: unknown; query?: unknown };
    try {
      body = await req.json() as { messages?: unknown; query?: unknown };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'messages (array) and query (string) required' }, { status: 400 });
    }

    const messages = body.messages as ChatMessage[];
    const query = (body.query as string).trim();

    if (messages.length >= 20) {
      return NextResponse.json({ error: 'Conversation limit reached' }, { status: 429 });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI services unavailable' }, { status: 503 });
    }

    // Embed the query
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) {
      return NextResponse.json({ error: 'Embedding service unavailable' }, { status: 503 });
    }

    // Parse resume embedding and build hybrid vector
    let searchEmbedding = queryEmbedding;
    let resumeEmbedding: number[] | null = null;
    if (profile.resume_embedding) {
      try {
        const raw = profile.resume_embedding as string | number[];
        resumeEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
      } catch {
        resumeEmbedding = null;
      }
    }

    if (resumeEmbedding && resumeEmbedding.length === queryEmbedding.length) {
      const hybrid = queryEmbedding.map((v, i) => v * 0.7 + (resumeEmbedding as number[])[i] * 0.3);
      searchEmbedding = normalizeVector(hybrid);
    }

    // RAG: find relevant jobs via pgvector
    const primaryResult = await admin.rpc('match_jobs', {
      query_embedding: searchEmbedding,
      match_count: 10,
    });
    let matchedJobs = primaryResult.data;

    // Fallback: if no results, retry with no threshold filter
    if (!matchedJobs || !Array.isArray(matchedJobs) || matchedJobs.length === 0) {
      console.warn('[chat] match_jobs returned 0 results — retrying with match_threshold: 0.0');
      const fallbackResult = await admin.rpc('match_jobs', {
        query_embedding: searchEmbedding,
        match_count: 15,
        match_threshold: 0.0,
      });
      if (fallbackResult.error) {
        console.warn('[chat] fallback match_jobs failed:', fallbackResult.error.message);
      } else {
        matchedJobs = fallbackResult.data;
      }
    }

    const resumeText = (profile.resume_text as string | null) ?? null;

    // Format job context
    const jobContext = (Array.isArray(matchedJobs) ? matchedJobs : [])
      .map((job: { company: string; title: string; location?: string | null; url: string; salary_min?: number | null; salary_max?: number | null }) => {
        let line = `${job.company} | ${job.title} | ${job.location ?? 'Remote'} | ${job.url}`;
        if (job.salary_min) {
          line += ` | $${Math.round(job.salary_min / 1000)}k${job.salary_max ? `-$${Math.round(job.salary_max / 1000)}k` : '+'}`;
        }
        return line;
      })
      .join('\n');

    console.log(`[chat] jobContext length: ${jobContext.length} chars, jobs matched: ${Array.isArray(matchedJobs) ? matchedJobs.length : 0}`);

    const hasJobs = jobContext.length > 0;

    const systemPrompt = `You are NextRole AI, an expert career assistant built into NextRole — the largest new grad and entry-level tech job aggregator.

You have two powerful inputs:
1. The user's actual resume text (if uploaded)
2. Real job listings from NextRole's database of 63,000+ active new grad and entry-level tech positions, retrieved for this query

User's resume:
${resumeText ?? 'No resume uploaded yet'}

Relevant jobs from NextRole's database:
${hasJobs ? jobContext : 'No matching jobs found for this query.'}

RESPONSE RULES — follow exactly:
${hasJobs ? `- Begin your response with exactly this sentence: "Based on NextRole's database of 63,000+ active jobs, here are the best matches for you:"
- After that line, list ONLY the jobs. No preamble, no tips, no filler.
- Format each job as:
  **[Company]** — **[Job Title]** | [Location] | [Salary if available]
  [Full URL on its own line]
- Separate each job with a blank line.
- Cap the list at 300 words total.` : `- Respond with exactly: "I couldn't find strong matches in NextRole's database for this query. Try adjusting your filters on the Jobs page or search for a specific role."`}
- For resume analysis: reference specific details from the resume. Keep under 500 words.
- For "why am I not getting interviews": give honest, constructive feedback based on their resume. No generic advice.
- For skill gaps: compare resume against the job descriptions above.
- Never suggest jobs or companies outside of NextRole's database.
- No generic career advice. Be direct, specific, and actionable.`;

    // Call Claude with streaming
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: 'user', content: query },
        ],
      }),
    });

    if (!claudeRes.ok || !claudeRes.body) {
      const errText = await claudeRes.text().catch(() => '');
      console.error('[chat] Claude error:', errText);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
    }

    // Stream SSE from Anthropic → plain text chunks to client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const dataStr = line.slice(6).trim();
              if (!dataStr || dataStr === '[DONE]') continue;

              try {
                const event = JSON.parse(dataStr) as {
                  type: string;
                  delta?: { type: string; text?: string };
                };
                if (
                  event.type === 'content_block_delta' &&
                  event.delta?.type === 'text_delta' &&
                  event.delta.text
                ) {
                  controller.enqueue(new TextEncoder().encode(event.delta.text));
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }

          // Flush any remaining buffered SSE lines
          if (buffer.startsWith('data: ')) {
            const dataStr = buffer.slice(6).trim();
            if (dataStr && dataStr !== '[DONE]') {
              try {
                const event = JSON.parse(dataStr) as {
                  type: string;
                  delta?: { type: string; text?: string };
                };
                if (
                  event.type === 'content_block_delta' &&
                  event.delta?.type === 'text_delta' &&
                  event.delta.text
                ) {
                  controller.enqueue(new TextEncoder().encode(event.delta.text));
                }
              } catch {
                // ignore
              }
            }
          }
        } catch (err) {
          console.error('[chat] stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[chat] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
