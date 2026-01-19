import { createClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const supabaseUrl = 'https://aojewecjssqwkhtrcjim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamV3ZWNqc3Nxd2todHJjamltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyNzU1NywiZXhwIjoyMDc3MzAzNTU3fQ.b9A9_FsNj5ZzYULYQiE6FntWGSvmd0sSHcXu3GAy-Ro';

const supabase = createClient(supabaseUrl, supabaseKey);
const sessionId = '5b6acc70-442d-4525-b22a-3c6c32ec1281';

const styles = StyleSheet.create({
  page: { padding: 40 },
  photo: { width: 200, height: 150, objectFit: 'contain' },
});

async function testPdfWithImage() {
  console.log('Fetching photo from database...');

  // Get photo
  const { data: photos } = await supabase
    .from('nhome_photos')
    .select('*')
    .eq('session_id', sessionId)
    .limit(1);

  if (!photos || photos.length === 0) {
    console.log('No photos found');
    return;
  }

  const photo = photos[0];
  const storagePath = `sessions/${sessionId}/${photo.file_name}`;

  console.log('Getting signed URL...');
  const { data: signed } = await supabase.storage
    .from('nhome_photos')
    .createSignedUrl(storagePath, 3600);

  if (!signed?.signedUrl) {
    console.log('Could not get signed URL');
    return;
  }

  console.log('Fetching image...');
  const response = await fetch(signed.signedUrl);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const dataUrl = `data:${contentType};base64,${base64}`;

  console.log(`Image fetched: ${(arrayBuffer.byteLength / 1024).toFixed(0)}KB, type: ${contentType}`);
  console.log(`Base64 data URL length: ${dataUrl.length} chars`);
  console.log(`Data URL starts with: ${dataUrl.substring(0, 50)}...`);

  // Test 1: PDF without image
  console.log('\n--- Test 1: PDF without image ---');
  const doc1 = React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(Text, {}, 'Hello World - No Image')
    )
  );

  console.log('Rendering PDF without image...');
  const start1 = Date.now();
  const buffer1 = await renderToBuffer(doc1 as any);
  console.log(`PDF without image: ${buffer1.length} bytes in ${Date.now() - start1}ms`);

  // Test 2: PDF with image
  console.log('\n--- Test 2: PDF with image ---');
  const doc2 = React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(Text, {}, 'Hello World - With Image'),
      React.createElement(Image, { style: styles.photo, src: dataUrl })
    )
  );

  console.log('Rendering PDF with image (this might hang)...');
  const start2 = Date.now();

  // Add timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000);
  });

  try {
    const buffer2 = await Promise.race([
      renderToBuffer(doc2 as any),
      timeoutPromise
    ]) as Buffer;
    console.log(`PDF with image: ${buffer2.length} bytes in ${Date.now() - start2}ms`);
  } catch (e: any) {
    console.log(`ERROR: ${e.message}`);
  }
}

testPdfWithImage().catch(console.error);
