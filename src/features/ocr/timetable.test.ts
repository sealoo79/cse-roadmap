import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { courseMatchLabel, matchCourses } from './match-courses';
import { findTimetableCells, titleFromCell, titlesFromText } from './timetable-grid';

const reference = getReferenceData();

it('요일별 색상 칸을 찾고 줄바꿈된 제목에서 강의실 정보를 떼어낸다', () => {
  const width = 240;
  const height = 360;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [left, top] of [[25, 60], [65, 110], [105, 60]]) {
    for (let y = top; y < top + 50; y++) {
      for (let x = left; x < left + 36; x++) data.set([168, 224, 215, 255], (y * width + x) * 4);
    }
  }

  expect(findTimetableCells({ width, height, data, colorSpace: 'srgb' })).toEqual([
    { x: 25, y: 60, width: 36, height: 50 },
    { x: 105, y: 60, width: 36, height: 50 },
    { x: 65, y: 110, width: 36, height: 50 },
  ]);
  expect(titleFromCell('시스템프로그\n래밍\n\n산격동 캠퍼스 |\n융복합관-355')).toBe('시스템프로그 래밍');
  expect(titleFromCell('클라우드컴퓨\n티\no\n산격동 캠퍼스')).toBe('클라우드컴퓨 티');
});

it('코드·정확한 제목·유사 이름 후보를 구분하고 같은 수업을 묶는다', () => {
  const rows = matchCourses([
    '시스템프로그 래밍',
    '시스템프로그래밍',
    '클라우드컴퓨 티',
    '인공지능의 이 해 - 튜터',
    'CHEM 0506 일반화학실험',
    '일반화학실험',
  ], reference);

  expect(rows.map((row) => courseMatchLabel(row, reference))).toEqual([
    'DB 일치', '유사 과목 후보', '미매칭', 'DB 후보 2개',
  ]);
  expect(rows.map(({ candidate_codes }) => candidate_codes)).toEqual([
    ['ELEC0462'], ['GLSO0227'], [], ['CHEM0506', 'SCED0213'],
  ]);
  expect(rows.every((item) => item.review_status === 'pending' && item.matched_course_code === null)).toBe(true);
});

it('한글·영문 OCR 엔진으로 합성 시간표 이미지의 과목을 추출해 기준 데이터와 대조한다', async () => {
  const models = await mkdtemp(join(tmpdir(), 'cse-ocr-models-'));
  try {
    await Promise.all(['kor', 'eng'].map((lang) => copyFile(
      join(process.cwd(), 'node_modules', `@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),
      join(models, `${lang}.traineddata.gz`),
    )));
    // 브라우저와 동일한 언어팩을 쓰는 Node 워커로 이미지 자체를 검증한다.
    const script = `
      const { createWorker, OEM, PSM } = require('tesseract.js');
      (async () => {
        const worker = await createWorker(['kor', 'eng'], OEM.LSTM_ONLY, {
          langPath: process.argv[1], cacheMethod: 'none',
        });
        try {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
          const {data} = await worker.recognize('src/features/ocr/fixtures/timetable.png');
          process.stdout.write(data.text);
        } finally {
          await worker.terminate();
        }
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ['-e', script, models], { timeout: 15000 });
    const rows = matchCourses(titlesFromText(stdout), reference);
    expect(rows.flatMap(({ candidate_codes }) => candidate_codes)).toEqual(expect.arrayContaining(['COMP0218', 'COME0301']));
    expect(rows.some((row) => row.candidate_codes.length === 0)).toBe(true);
  } finally {
    await rm(models, { recursive: true, force: true });
  }
}, 20000);
