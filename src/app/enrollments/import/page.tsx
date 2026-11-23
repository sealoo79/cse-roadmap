import Link from 'next/link';
import type { JSX } from 'react';
import { OcrImport } from '@/features/ocr/OcrImport';

export default function Page(): JSX.Element {
  return <>
    <Link className="inline-link" href="/enrollments">수강 이력으로 돌아가기</Link>
    <h1>수강 내역 불러오기</h1>
    <p className="page-description">시간표 캡처의 과목명을 기준 데이터와 대조합니다. 과목코드와 수강 기간을 확인한 항목만 수강 이력에 추가됩니다.</p>
    <OcrImport />
  </>;
}
