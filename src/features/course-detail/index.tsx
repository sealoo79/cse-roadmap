import type { JSX } from 'react';
import type { CourseCode } from '@/types/reference';

// #16 계약 스텁
export function CourseDetailPanel(_props: { code: CourseCode | null; onClose(): void; onNavigate(code: CourseCode): void }): JSX.Element | null {
  void _props; return null;
}
