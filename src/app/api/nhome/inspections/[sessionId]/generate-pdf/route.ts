export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 60; // Allow up to 60 seconds for PDF generation

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ServerPDFTemplateEN } from '@/components/reports/ServerPDFTemplateEN';
import { ServerPDFTemplatePT } from '@/components/reports/ServerPDFTemplatePT';
import sharp from 'sharp';

const BUCKET_ID = 'nhome_photos';
const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500KB max per image for PDF embedding
const PDF_IMAGE_WIDTH = 400; // Max width for images in PDF

// Pre-fetch image, process with sharp, and convert to base64 PNG data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000) // 10 second timeout per image
    });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const originalSize = arrayBuffer.byteLength;

    // Skip images that are too large
    if (originalSize > MAX_IMAGE_SIZE_BYTES * 2) {
      console.warn(`[generate-pdf] Skipping very large image (${(originalSize / 1024).toFixed(0)}KB)`);
      return null;
    }

    // Use sharp to process the image - resize and convert to PNG
    // PNG format works better with react-pdf in server environments
    const processedBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize(PDF_IMAGE_WIDTH, undefined, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality: 80 })
      .toBuffer();

    const base64 = processedBuffer.toString('base64');
    console.log(`[generate-pdf] Image processed: ${(originalSize / 1024).toFixed(0)}KB -> ${(processedBuffer.length / 1024).toFixed(0)}KB PNG`);
    return `data:image/png;base64,${base64}`;
  } catch (e) {
    console.warn('[generate-pdf] Failed to process image:', url, e);
    return null;
  }
}

// Wrapper to add timeout to PDF rendering
function renderWithTimeout(renderFn: () => Promise<Buffer>, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`PDF rendering timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    renderFn()
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = params.sessionId;
  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') || 'en';

  console.log(`[generate-pdf] Starting PDF generation for session ${sessionId}, lang: ${lang}`);
  const startTime = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Load session
    const { data: session, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 2) Load apartment + project
    const { data: apartment } = await supabase
      .from('apartments')
      .select('*, projects(*)')
      .eq('id', session.apartment_id)
      .maybeSingle();

    if (!apartment) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    // 3) Load results with checklist templates
    console.log(`[generate-pdf] Querying inspection_results for session: ${sessionId}`);
    console.log(`[generate-pdf] Using Supabase URL: ${supabaseUrl}`);

    const { data: results, error: resultsError } = await supabase
      .from('inspection_results')
      .select('*, checklist_templates:item_id(id, room_type, room_type_pt, item_description, item_description_pt, order_sequence)')
      .eq('session_id', sessionId);

    if (resultsError) {
      console.error(`[generate-pdf] Error fetching results:`, resultsError);
    }

    // Debug: Log all results fetched - specifically check Blinds
    console.log(`[generate-pdf] Fetched ${results?.length || 0} results:`);
    const blindsResults = results?.filter(r => r.checklist_templates?.item_description === 'Blinds');
    console.log(`[generate-pdf] BLINDS ITEMS (${blindsResults?.length || 0}):`);
    blindsResults?.forEach(r => {
      console.log(`  >>> BLINDS [id=${r.id}, item_id=${r.item_id}] room=${r.checklist_templates?.room_type}: status=${r.status}, notes=${r.notes?.substring(0, 30) || 'none'}`);
    });

    // Sort by order_sequence
    const sortedResults = [...(results || [])].sort((a, b) => {
      const orderA = a.checklist_templates?.order_sequence ?? 9999;
      const orderB = b.checklist_templates?.order_sequence ?? 9999;
      return orderA - orderB;
    });

    // 4) Load photos and generate signed URLs
    const { data: photos } = await supabase
      .from('nhome_photos')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    console.log(`[generate-pdf] Found ${photos?.length || 0} photos`);

    // 5) Generate signed URLs and pre-fetch images as base64 (parallel)
    const photoPromises = (photos || []).map(async (photo) => {
      const fileName = photo.file_name ?? `photo-${photo.id}.jpg`;
      const storagePath = `sessions/${sessionId}/${fileName}`;

      const { data: signed } = await supabase.storage
        .from(BUCKET_ID)
        .createSignedUrl(storagePath, 60 * 60);

      if (signed?.signedUrl) {
        const base64 = await fetchImageAsBase64(signed.signedUrl);
        return { ...photo, base64_url: base64 };
      }
      return { ...photo, base64_url: null };
    });

    const photosWithBase64 = await Promise.all(photoPromises);
    console.log(`[generate-pdf] Pre-fetched ${photosWithBase64.filter(p => p.base64_url).length} images as base64`);

    // 6) Map photos to results by item_id
    const photosByItemId = new Map<string, string[]>();
    photosWithBase64.forEach(photo => {
      if (!photo.item_id || !photo.base64_url) return;
      const key = String(photo.item_id);
      const bucket = photosByItemId.get(key) ?? [];
      bucket.push(photo.base64_url);
      photosByItemId.set(key, bucket);
    });

    // 7) Attach photos to results
    // Add ?nophotos=1 to URL to skip photos for debugging
    const skipPhotos = url.searchParams.get('nophotos') === '1';
    const resultsWithPhotos = sortedResults.map(r => ({
      ...r,
      photo_base64_urls: skipPhotos ? [] : (photosByItemId.get(String(r.item_id)) ?? [])
    }));
    if (skipPhotos) {
      console.log(`[generate-pdf] Photos SKIPPED (nophotos=1 flag)`);
    }

    // 8) Prepare data for template
    const reportData = {
      session,
      apartment,
      project: apartment.projects,
      results: resultsWithPhotos,
    };

    // 9) Render PDF using static imports (dynamic imports can cause issues in Next.js)
    const resultsWithPhotosCount = resultsWithPhotos.filter(r => r.photo_base64_urls.length > 0).length;
    const totalPhotosCount = resultsWithPhotos.reduce((sum, r) => sum + r.photo_base64_urls.length, 0);
    console.log(`[generate-pdf] Starting PDF render for lang: ${lang}, items with photos: ${resultsWithPhotosCount}, total photos: ${totalPhotosCount}`);

    let pdfBuffer: Buffer;

    const renderStart = Date.now();
    if (lang === 'pt') {
      console.log(`[generate-pdf] Rendering Portuguese PDF...`);
      const element = React.createElement(ServerPDFTemplatePT, { data: reportData });
      pdfBuffer = await renderWithTimeout(() => renderToBuffer(element as any), 30000);
    } else {
      console.log(`[generate-pdf] Rendering English PDF...`);
      const element = React.createElement(ServerPDFTemplateEN, { data: reportData });
      pdfBuffer = await renderWithTimeout(() => renderToBuffer(element as any), 30000);
    }
    console.log(`[generate-pdf] renderToBuffer completed in ${Date.now() - renderStart}ms`);

    console.log(`[generate-pdf] PDF generated in ${Date.now() - startTime}ms, size: ${pdfBuffer.length} bytes`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="inspection-${sessionId}-${lang}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (e: any) {
    console.error('[generate-pdf] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
