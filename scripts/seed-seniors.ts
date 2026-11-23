import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

interface SeedRow {
  label: string;
  program_id: string;
  admission_year: number;
  course_code: string;
  taken_year: number;
  taken_semester: number;
}

const seedKeys = new Set(['label', 'program_id', 'admission_year', 'course_code', 'taken_year', 'taken_semester']);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function year(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 9999;
}

async function readJson(path: string | URL): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function readSeed(path: string): Promise<{ rows: SeedRow[]; skipped: number }> {
  const [input, programs, courses] = await Promise.all([
    readJson(path),
    readJson(new URL('../data/programs.json', import.meta.url)),
    readJson(new URL('../data/courses.json', import.meta.url)),
  ]);
  if (!Array.isArray(input) || !Array.isArray(programs) || !Array.isArray(courses)) {
    throw new Error('시드와 기준 데이터는 JSON 배열이어야 합니다.');
  }

  const programIds = new Set(programs.filter(record).map((entry) => entry.program_id));
  const courseCodes = new Set(courses.filter(record).map((entry) => entry.course_code));
  const profiles = new Map<string, string>();
  const records = new Map<string, SeedRow>();
  let skipped = 0;

  for (const [index, entry] of input.entries()) {
    const invalid = (): Error => new Error(`시드 ${index + 1}번째 행의 형식 또는 기준 데이터 키가 올바르지 않습니다.`);
    if (!record(entry) || Object.keys(entry).some((key) => !seedKeys.has(key))) throw invalid();

    const { label, program_id, admission_year, course_code, taken_year, taken_semester } = entry;
    if (taken_semester == null || taken_semester === '') {
      skipped++;
      continue;
    }
    if (typeof label !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(label)
      || typeof program_id !== 'string' || !programIds.has(program_id)
      || typeof course_code !== 'string' || !courseCodes.has(course_code)
      || !year(admission_year) || !year(taken_year) || taken_year < admission_year
      || typeof taken_semester !== 'number' || ![1, 2, 3, 4].includes(taken_semester)) throw invalid();

    const profile = `${program_id}:${admission_year}`;
    if (profiles.has(label) && profiles.get(label) !== profile) {
      throw new Error(`시드 ${index + 1}번째 행의 익명 식별자에 전공 또는 학번이 두 가지 이상 지정됐습니다.`);
    }
    profiles.set(label, profile);
    const key = `${label}:${course_code}:${taken_year}:${taken_semester}`;
    records.set(key, { label, program_id, admission_year, course_code, taken_year, taken_semester });
  }

  if (records.size === 0) throw new Error('적재할 유효한 행이 없습니다.');
  return { rows: [...records.values()], skipped };
}

async function main(args: string[]): Promise<void> {
  const [mode, path] = args;
  if (!((args.length === 1 && mode === '--refresh')
    || (args.length === 2 && (mode === '--check' || mode === '--replace') && path))) {
    throw new Error('사용법: node scripts/seed-seniors.ts --check <file.json> | --replace <file.json> | --refresh');
  }

  const seed = mode === '--refresh' ? undefined : await readSeed(path);
  if (seed) console.log(`검증 완료: 유효한 수강 기록 ${seed.rows.length}건, 학기 누락 제외 ${seed.skipped}건`);
  if (mode === '--check') return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase URL과 서비스 역할 키를 설정해 주세요.');

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = seed
    ? await client.rpc('replace_senior_seed', { seed_rows: seed.rows })
    : await client.rpc('refresh_followup_stats');

  if (result.error) throw new Error(`시드 작업이 실패했습니다. SQL 설치와 서비스 역할 권한을 확인해 주세요. (HTTP ${result.status})`);
  if (typeof result.data !== 'number') throw new Error('집계 건수를 확인할 수 없습니다.');
  console.log(`함께 수강 통계 ${result.data}건을 재계산했습니다.`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof SyntaxError ? 'JSON 형식이 올바르지 않습니다.'
    : error instanceof Error && !('code' in error) ? error.message : '시드 파일을 읽거나 처리할 수 없습니다.';
  console.error(message);
  process.exitCode = 1;
});
