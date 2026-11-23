import { readFile } from 'node:fs/promises';
// Keep the native path calls visible to Next.js output file tracing.
declare const __non_webpack_require__: NodeRequire;
const path: typeof import('node:path') = __non_webpack_require__('node:path');

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }): Promise<Response> {
  const { asset } = await params;
  let data: Buffer;
  let contentType = 'text/javascript; charset=utf-8';
  switch (asset) {
    case 'worker.js':
      data = await readFile(path.join(process.cwd(), 'node_modules/tesseract.js/dist/worker.min.js'));
      break;
    case 'core.js':
      data = await readFile(path.join(process.cwd(), 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'));
      break;
    case 'eng.traineddata.gz':
      data = await readFile(path.join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'));
      contentType = 'application/octet-stream';
      break;
    case 'kor.traineddata.gz':
      data = await readFile(path.join(process.cwd(), 'node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz'));
      contentType = 'application/octet-stream';
      break;
    default:
      return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
  });
}
