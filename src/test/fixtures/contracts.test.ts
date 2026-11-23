import { expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { resolveCompletion } from '@/lib/domain/completion';
import { evaluateGraduation } from '@/lib/domain/graduation';
import { recommendCourses } from '@/lib/domain/recommend';
import { demoEnrollments, demoProfile } from './demo-user';

it('도메인 계약 스텁을 import해 빈 결과를 호출할 수 있다', () => {
  const ref = getReferenceData(); const completion = resolveCompletion(demoEnrollments, ref);
  expect(completion.completed.size).toBe(0);
  expect(completion.isCompleted('COMP0204')).toBe(false);
  expect(completion.canonicalOf('COMP0204')).toBe('COMP0204');
  expect(evaluateGraduation({ profile: demoProfile, completion, noncredit: [], ref }).items).toEqual([]);
  expect(recommendCourses({ profile: demoProfile, completion, interests: [], followupStats: [], ref })).toEqual([]);
});
