import type { Worker as RecognitionWorker } from 'tesseract.js';
import { findTimetableCells, titleFromCell, titlesFromText, type CellBounds } from './timetable-grid';

const assetPath = '/api/ocr/assets';
const maxFileBytes = 15 * 1024 * 1024;
const maxPixelsPerSide = 2400;

export function validateDocument(file: File): string | null {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) && !(!file.type && /\.(png|jpe?g|webp)$/i.test(file.name))) {
    return 'PNG, JPG 또는 WebP 시간표 캡처를 선택해 주세요.';
  }
  if (file.size === 0 || file.size > maxFileBytes) return '15MB 이하의 비어 있지 않은 이미지를 선택해 주세요.';
  return null;
}

function graphics(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) throw new Error('이미지를 읽을 수 없는 브라우저입니다.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return context;
}

async function imageCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxPixelsPerSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    graphics(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

function cropCell(canvas: HTMLCanvasElement, bounds: CellBounds): HTMLCanvasElement {
  const cropped = document.createElement('canvas');
  const { x, y, width } = bounds;
  const height = Math.min(bounds.height, Math.ceil(width * .85));
  const scale = Math.max(1, 420 / width);
  const padding = 12;
  cropped.width = Math.ceil(width * scale) + 2 * padding;
  cropped.height = Math.ceil(height * scale) + 2 * padding;
  graphics(cropped).drawImage(canvas, x, y, width, height, padding, padding, width * scale, height * scale);
  return cropped;
}

export async function extractDocument(file: File, progress: (label: string) => void): Promise<string[]> {
  const invalid = validateDocument(file);
  if (invalid) throw new Error(invalid);

  progress('시간표 이미지 읽는 중…');
  const canvas = await imageCanvas(file);
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지를 읽을 수 없는 브라우저입니다.');
    const cells = findTimetableCells(context.getImageData(0, 0, canvas.width, canvas.height));

    progress('한글·영문 인식 준비 중…');
    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const worker = await new Promise<RecognitionWorker>((resolve, reject) => {
      // 언어팩 초기화 실패는 createWorker의 반환 Promise에서 누락될 수 있다.
      const initializationFailed = (): void => reject(new Error('문자 인식 엔진을 시작할 수 없습니다. 다시 시도해 주세요.'));
      void createWorker(['kor', 'eng'], OEM.LSTM_ONLY, {
        workerPath: `${assetPath}/worker.js`,
        corePath: `${assetPath}/core.js`,
        langPath: assetPath,
        workerBlobURL: false,
        cachePath: 'cse-ocr-v7',
        errorHandler: initializationFailed,
      }).then(resolve, initializationFailed);
    });

    try {
      if (cells.length === 0) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        const { data } = await worker.recognize(canvas);
        return titlesFromText(data.text);
      }

      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const titles: string[] = [];
      for (const [index, rect] of cells.entries()) {
        progress(`시간표 과목 읽는 중 (${index + 1}/${cells.length})…`);
        const cell = cropCell(canvas, rect);
        try {
          const { data } = await worker.recognize(cell);
          const title = titleFromCell(data.text);
          if (title) titles.push(title);
        } finally {
          cell.width = 0;
          cell.height = 0;
        }
      }
      return titles;
    } finally {
      await worker.terminate();
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
