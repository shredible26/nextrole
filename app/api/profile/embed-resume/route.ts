import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Embedding service unavailable' }, { status: 503 });
    }

    const admin = createAdminClient();

    // Get the user's profile to find their resume path
    const { data: profile } = await admin
      .from('profiles')
      .select('resume_url')
      .eq('id', user.id)
      .maybeSingle();

    // Download the PDF from storage — path is always userId/resume.pdf
    const storagePath = `${user.id}/resume.pdf`;
    const { data: fileData, error: downloadError } = await admin
      .storage
      .from('resumes')
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Could not download resume' }, { status: 404 });
    }

    // Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF text
    let extractedText: string;
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      extractedText = result.text;
    } catch {
      return NextResponse.json({ error: 'Could not parse PDF' }, { status: 422 });
    }

    const truncatedText = extractedText.slice(0, 8000);

    // Get embedding from OpenAI
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: truncatedText,
        dimensions: 1536,
      }),
    });

    if (!embedRes.ok) {
      const errBody = await embedRes.text().catch(() => '');
      console.error('[embed-resume] OpenAI error:', errBody);
      return NextResponse.json({ error: 'Embedding service unavailable' }, { status: 503 });
    }

    const embedData = await embedRes.json() as { data: Array<{ embedding: number[] }> };
    const embedding = embedData.data[0]?.embedding;

    if (!embedding) {
      return NextResponse.json({ error: 'Embedding service unavailable' }, { status: 503 });
    }

    // Update profile with text and embedding
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        resume_text: truncatedText,
        resume_embedding: JSON.stringify(embedding),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[embed-resume] profile update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to save embedding' }, { status: 500 });
    }

    // Suppress unused variable warning
    void profile;

    return NextResponse.json({ success: true, textLength: truncatedText.length });
  } catch (err) {
    console.error('[embed-resume] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
