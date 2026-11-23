import { expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { resolveCompletion } from '@/lib/domain/completion';
import { evaluateGraduation } from '@/lib/domain/graduation';
import { recommendCourses } from '@/lib/domain/recommend';
import { demoProfile } from './demo-user';

it('수강 기록이 없을 때 도메인 계약 함수를 함께 호출할 수 있다', () => {
  const ref = getReferenceData();
  const completion = resolveCompletion([], ref);
  expect(completion.completed.size).toBe(0);
  expect(completion.isCompleted('COMP0204')).toBe(false);
  expect(completion.canonicalOf('XXXX9999')).toBe('XXXX9999');
  const graduation = evaluateGraduation({ profile: demoProfile, completion, noncredit: [], ref });
  expect(graduation.programId).toBe(demoProfile.program_id);
  expect(graduation.summary.met).toBe(0);
  expect(recommendCourses({ profile: demoProfile, completion, interests: [], followupStats: [], ref })).toEqual([]);
});
