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

it('OCR 오타·잘린 이름·깨진 강의실 글자에도 가장 가까운 과목을 첫 후보로 둔다', () => {
  const rows = matchCourses([
    '기초프로그래밍실 A',
    '인공지능융합옹용 특강          i',
    '컴퓨터윤리 odio oy 0',
    '알고리즘2',
    '종합설계프로젝트',
    '동아리 회의',
  ], reference, { programId: 'adv_computing', admissionYear: 2026 });
  expect(rows.map(({ candidate_codes }) => candidate_codes[0] ?? null)).toEqual([
    'COMP0207', 'COMP0342', expect.any(String), 'COMP0320', 'ITEC0401', null,
  ]);
  expect(reference.courses.get(rows[2].candidate_codes[0])?.name_ko).toBe('컴퓨터윤리');
  // 번호만 다른 과목(알고리즘1)은 비슷한 이름으로 보지 않는다.
  expect(rows[3].candidate_codes).toEqual(['COMP0320']);
  expect(rows[4].candidate_codes).toEqual(['ITEC0401', 'ITEC0402']);
});

it('호실 표기만 남은 강의실 줄도 제목에서 떼어낸다', () => {
  expect(titleFromCell('운영체제\nAi HHA IT5-21\n')).toBe('운영체제');
  expect(titleFromCell('수치해석\n산격동 캠퍼스 |15-37\n2\n')).toBe('수치해석');
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
