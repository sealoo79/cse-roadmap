import type { Enrollment, Profile } from '@/types/user';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const timestamp = '2026-01-01T00:00:00.000Z';
export const demoProfile: Profile = {
  id: DEMO_USER_ID, email: 'demo@example.invalid', program_id: 'adv_computing', admission_year: 2026,
  major_type: 'single', created_at: timestamp, updated_at: timestamp,
};
export const demoEnrollments: Enrollment[] = [
  { id: 'demo-completed', user_id: DEMO_USER_ID, course_code: 'COMP0204', taken_year: 2026, taken_semester: 1, status: 'completed', source: 'manual', credit: null, grade: 'A', created_at: timestamp },
  { id: 'demo-failed', user_id: DEMO_USER_ID, course_code: 'COMP0216', taken_year: 2026, taken_semester: 1, status: 'failed', source: 'manual', credit: null, grade: 'F', created_at: timestamp },
];
