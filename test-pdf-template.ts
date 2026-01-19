import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ServerPDFTemplateEN } from './src/components/reports/ServerPDFTemplateEN';
import { ServerPDFTemplatePT } from './src/components/reports/ServerPDFTemplatePT';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);
const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

async function fetchImageAsBase64(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${base64}`;
}

async function testTemplate() {
  console.log('Loading data from Supabase...');

  // Load session
  const { data: session } = await supabase
    .from('inspection_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  // Load apartment + project
  const { data: apartment } = await supabase
    .from('apartments')
    .select('*, projects(*)')
    .eq('id', session.apartment_id)
    .single();

  // Load results
  const { data: results } = await supabase
    .from('inspection_results')
    .select('*, checklist_templates:item_id(id, room_type, item_description, order_sequence)')
    .eq('session_id', sessionId);

  // Load photos
  const { data: photos } = await supabase
    .from('nhome_photos')
    .select('*')
    .eq('session_id', sessionId);

  console.log(`Found ${results?.length || 0} results, ${photos?.length || 0} photos`);

  // Fetch images as base64
  const photosByItemId = new Map<string, string[]>();
  for (const photo of photos || []) {
    const storagePath = `sessions/${sessionId}/${photo.file_name}`;
    const { data: signed } = await supabase.storage
      .from('nhome_photos')
      .createSignedUrl(storagePath, 3600);

    if (signed?.signedUrl) {
      const base64 = await fetchImageAsBase64(signed.signedUrl);
      if (base64 && photo.item_id) {
        const bucket = photosByItemId.get(photo.item_id) ?? [];
        bucket.push(base64);
        photosByItemId.set(photo.item_id, bucket);
      }
    }
  }

  console.log(`Fetched ${photosByItemId.size} items with photos`);

  // Attach photos to results
  const resultsWithPhotos = (results || []).map(r => ({
    ...r,
    photo_base64_urls: photosByItemId.get(r.item_id) ?? []
  }));

  const reportData = {
    session,
    apartment,
    project: apartment.projects,
    results: resultsWithPhotos,
  };

  // Test without photos first
  console.log('\n--- Test 1: Template without photos ---');
  const dataNoPhotos = {
    ...reportData,
    results: resultsWithPhotos.map(r => ({ ...r, photo_base64_urls: [] }))
  };
  const element1 = React.createElement(ServerPDFTemplateEN, { data: dataNoPhotos });

  console.log('Rendering...');
  const start1 = Date.now();
  const buffer1 = await renderToBuffer(element1 as any);
  console.log(`Done: ${buffer1.length} bytes in ${Date.now() - start1}ms`);

  // Test with photos
  console.log('\n--- Test 2: Template WITH photos ---');
  const element2 = React.createElement(ServerPDFTemplateEN, { data: reportData });

  console.log('Rendering (might hang)...');
  const start2 = Date.now();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout after 15 seconds')), 15000);
  });

  try {
    const buffer2 = await Promise.race([
      renderToBuffer(element2 as any),
      timeoutPromise
    ]) as Buffer;
    console.log(`Done: ${buffer2.length} bytes in ${Date.now() - start2}ms`);
  } catch (e: any) {
    console.log(`ERROR: ${e.message}`);
  }
}

testTemplate().catch(console.error);
