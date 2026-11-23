import type { Worker as RecognitionWorker } from 'tesseract.js';
import type { TakenSemester } from '@/types/user';
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

/**
 * 시간표 칸은 색 배경에 흰 글자라 대비가 낮다. 회색조로 바꾸고 오츠 임계값으로 흑백을 나눈 뒤,
 * 더 많은 쪽(배경)을 흰색으로 맞춰 '흰 바탕에 검은 글자'로 만든다(합성 시간표 120칸 기준 인식률 89% → 92%).
 */
export function binarize(pixels: Uint8ClampedArray, fixedThreshold?: number): void {
  const histogram = new Array<number>(256).fill(0);
  const gray = new Uint8Array(pixels.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const value = Math.round(.299 * pixels[i * 4] + .587 * pixels[i * 4 + 1] + .114 * pixels[i * 4 + 2]);
    gray[i] = value;
    histogram[value]++;
  }
  const total = gray.length;
  const sum = histogram.reduce((acc, count, value) => acc + count * value, 0);
  let below = 0;
  let belowSum = 0;
  let best = -1;
  let threshold = fixedThreshold ?? 127;
  for (let value = 0; fixedThreshold === undefined && value < 256; value++) {
    below += histogram[value];
    if (below === 0) continue;
    const above = total - below;
    if (above === 0) break;
    belowSum += value * histogram[value];
    const between = below * above * (belowSum / below - (sum - belowSum) / above) ** 2;
    if (between > best) {
      best = between;
      threshold = value;
    }
  }
  let dark = 0;
  for (const value of gray) if (value <= threshold) dark++;
  const lightText = fixedThreshold === undefined && dark > total / 2;
  for (let i = 0; i < gray.length; i++) {
    const isText = lightText ? gray[i] > threshold : gray[i] <= threshold;
    const color = isText ? 0 : 255;
    pixels[i * 4] = color;
    pixels[i * 4 + 1] = color;
    pixels[i * 4 + 2] = color;
    pixels[i * 4 + 3] = 255;
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
  const context = graphics(cropped);
  context.drawImage(canvas, x, y, width, height, padding, padding, width * scale, height * scale);
  // 여백(흰색)은 빼고 칸 안쪽만 흑백으로 바꾼다.
  const inner = context.getImageData(padding, padding, Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale)));
  binarize(inner.data);
  context.putImageData(inner, padding, padding);
  return cropped;
}

/** 캡처에서 읽은 수강 학기(에브리타임 시간표 왼쪽 위 '2023년 1학기'). */
export interface DetectedTerm { year: number; semester: TakenSemester }
export interface ExtractedDocument { titles: string[]; term: DetectedTerm | null }

/** OCR은 '년'을 '4'·'d' 등으로 잘못 읽기도 해서, 연도 뒤 두 글자까지는 무엇이든 허용한다. */
export function termFromText(text: string): DetectedTerm | null {
  const normalized = text.normalize('NFKC');
  const regular = normalized.match(/(20\d{2})\S{0,2}\s*([12])\s*학\s*기/u);
  if (regular) return { year: Number(regular[1]), semester: regular[2] === '1' ? 1 : 2 };
  const season = normalized.match(/(20\d{2})\S{0,2}\s*(여름|겨울)/u);
  if (season) return { year: Number(season[1]), semester: season[2] === '여름' ? 3 : 4 };
  return null;
}

/** 시간표 위쪽(학기 표시가 있는 곳)을 2배로 키우고, 옅은 회색 글자도 남도록 고정 임계값으로 흑백 처리한다. */
function headerCanvas(canvas: HTMLCanvasElement, bottom: number): HTMLCanvasElement {
  const header = document.createElement('canvas');
  const height = Math.max(1, Math.min(canvas.height, bottom));
  header.width = canvas.width * 2;
  header.height = height * 2;
  const context = graphics(header);
  context.drawImage(canvas, 0, 0, canvas.width, height, 0, 0, header.width, header.height);
  const image = context.getImageData(0, 0, header.width, header.height);
  binarize(image.data, 215);
  context.putImageData(image, 0, 0);
  return header;
}

export async function extractDocument(file: File, progress: (label: string) => void): Promise<ExtractedDocument> {
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
        return { titles: titlesFromText(data.text), term: termFromText(data.text) };
      }

      progress('수강 학기 읽는 중…');
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const header = headerCanvas(canvas, Math.min(...cells.map((cell) => cell.y)));
      let term: DetectedTerm | null = null;
      try {
        term = termFromText((await worker.recognize(header)).data.text);
      } finally {
        header.width = 0;
        header.height = 0;
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
      return { titles, term };
    } finally {
      await worker.terminate();
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
