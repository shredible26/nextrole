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

interface JobContextJob {
  id?: string;
  title: string;
  company: string;
  location?: string | null;
  url: string;
  salary_min?: number | null;
  salary_max?: number | null;
}

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
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

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('[chat] OpenAI embeddings request failed:', {
        status: res.status,
        body: errorText,
      });
      return null;
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    const embedding = data.data[0]?.embedding ?? null;

    if (!embedding) {
      console.error('[chat] OpenAI embeddings response missing embedding data');
    }

    return embedding;
  } catch (err) {
    console.error('[chat] OpenAI embeddings request threw:', err);
    return null;
  }
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
      console.error('[chat] auth failed:', {
        authError,
        hasUser: Boolean(user),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('tier, resume_embedding, resume_text')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[chat] profile lookup failed:', profileError);
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    if (profile?.tier !== 'pro') {
      console.error('[chat] non-pro access denied:', {
        userId: user.id,
        tier: profile?.tier ?? null,
      });
      return NextResponse.json({ error: 'Pro required' }, { status: 402 });
    }

    let body: { messages?: unknown; query?: unknown };
    try {
      body = await req.json() as { messages?: unknown; query?: unknown };
    } catch (err) {
      console.error('[chat] invalid JSON body:', err);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || typeof body.query !== 'string') {
      console.error('[chat] invalid request payload:', body);
      return NextResponse.json({ error: 'messages (array) and query (string) required' }, { status: 400 });
    }

    const messages = body.messages as ChatMessage[];
    const query = (body.query as string).trim();

    if (messages.length >= 20) {
      console.error('[chat] conversation limit reached:', {
        userId: user.id,
        messageCount: messages.length,
      });
      return NextResponse.json({ error: 'Conversation limit reached' }, { status: 429 });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      console.error('[chat] missing AI service credentials:', {
        hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
        hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      });
      return NextResponse.json({ error: 'AI services unavailable' }, { status: 503 });
    }

    // Embed the query
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) {
      console.error('[chat] query embedding unavailable');
      return NextResponse.json({ error: 'Embedding service unavailable' }, { status: 503 });
    }

    // Parse resume embedding and build hybrid vector
    let searchEmbedding = queryEmbedding;
    let resumeEmbedding: number[] | null = null;
    if (profile.resume_embedding) {
      try {
        const raw = profile.resume_embedding as string | number[];
        resumeEmbedding = typeof raw === 'string' ? JSON.parse(raw) as number[] : raw;
      } catch (err) {
        console.error('[chat] failed to parse resume embedding:', err);
        resumeEmbedding = null;
      }
    }

    if (resumeEmbedding && resumeEmbedding.length === queryEmbedding.length) {
      const hybrid = queryEmbedding.map((v, i) => v * 0.7 + (resumeEmbedding as number[])[i] * 0.3);
      searchEmbedding = normalizeVector(hybrid);
    } else if (resumeEmbedding && resumeEmbedding.length !== queryEmbedding.length) {
      console.error('[chat] resume embedding length mismatch:', {
        resumeEmbeddingLength: resumeEmbedding.length,
        queryEmbeddingLength: queryEmbedding.length,
      });
    }

    // RAG: find relevant jobs via pgvector
    const primaryMatchThreshold = 0.2;
    const primaryResult = await admin.rpc('match_jobs', {
      query_embedding: searchEmbedding,
      match_count: 10,
      match_threshold: primaryMatchThreshold,
    });
    console.log('[chat] primary match_jobs raw response:', {
      data: primaryResult.data,
      error: primaryResult.error,
      match_count: 10,
      match_threshold: primaryMatchThreshold,
    });

    if (primaryResult.error) {
      console.error('[chat] primary match_jobs failed:', primaryResult.error);
    }

    let matchedJobs: JobContextJob[] = Array.isArray(primaryResult.data)
      ? primaryResult.data as JobContextJob[]
      : [];

    // Fallback: if no results, retry with no threshold filter
    if (matchedJobs.length === 0) {
      console.error('[chat] primary match_jobs returned 0 jobs; retrying fallback with match_threshold: 0.0');
      const fallbackResult = await admin.rpc('match_jobs', {
        query_embedding: searchEmbedding,
        match_count: 15,
        match_threshold: 0.0,
      });
      console.log('[chat] fallback match_jobs raw response:', {
        data: fallbackResult.data,
        error: fallbackResult.error,
        match_count: 15,
        match_threshold: 0.0,
      });

      if (fallbackResult.error) {
        console.error('[chat] fallback match_jobs failed:', fallbackResult.error);
      }

      if (Array.isArray(fallbackResult.data)) {
        matchedJobs = fallbackResult.data as JobContextJob[];
      }
    }

    if (matchedJobs.length === 0) {
      console.error('[chat] match_jobs still empty after fallback; querying jobs table directly');
      const directJobsResult = await admin
        .from('jobs')
        .select('id, title, company, location, url, salary_min, salary_max')
        .eq('is_active', true)
        .not('embedding', 'is', null)
        .limit(10);

      if (directJobsResult.error) {
        console.error('[chat] direct jobs fallback failed:', directJobsResult.error);
      } else if (!directJobsResult.data || directJobsResult.data.length === 0) {
        console.error('[chat] direct jobs fallback returned 0 rows');
      } else {
        matchedJobs = directJobsResult.data as JobContextJob[];
        console.log('[chat] direct jobs fallback succeeded:', {
          count: matchedJobs.length,
          jobIds: matchedJobs.map(job => job.id).filter(Boolean),
        });
      }
    }

    const resumeText = (profile.resume_text as string | null) ?? null;

    // Format job context
    const jobContext = matchedJobs
      .map((job) => {
        let line = `${job.company} | ${job.title} | ${job.location ?? 'Remote'} | ${job.url}`;
        if (job.salary_min) {
          line += ` | $${Math.round(job.salary_min / 1000)}k${job.salary_max ? `-$${Math.round(job.salary_max / 1000)}k` : '+'}`;
        }
        return line;
      })
      .join('\n');

    console.log(`[chat] jobContext length before Claude: ${jobContext.length} chars, jobs matched: ${matchedJobs.length}`);

    if (jobContext.length === 0) {
      console.error('[chat] jobContext is empty after all retrieval attempts');
      return NextResponse.json({ error: 'Unable to load job context' }, { status: 503 });
    }

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
