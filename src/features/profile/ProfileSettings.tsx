'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { useEnrollments, useInterests, useProfile, useReference } from '@/lib/user-data/hooks';
import type { FieldId } from '@/types/reference';
import type { Profile } from '@/types/user';
import { AcademicFields, InterestFields, type AcademicSelection } from './ProfileFields';
import { EnrollmentStep } from './EnrollmentStep';
import styles from './profile.module.css';

type Mode = 'onboarding' | 'account';
type AccountSection = 'academic' | 'interests';

const steps = [
  { label: '전공·학번', title: '전공과 학번 선택', description: '전공과 학번에 맞는 교육과정과 졸업요건을 불러옵니다.' },
  { label: '수강 내역', title: '수강 내역 확인', description: '저장된 과목을 확인하고 다음 단계로 이동하세요.' },
  { label: '관심 분야', title: '관심 분야 선택', description: '선택한 분야는 다음 학기 추천에 반영됩니다.' },
] as const;

export function ProfileSettings({ mode }: { mode: Mode }): JSX.Element {
  const { profile, loading, error } = useProfile();
  const { fieldIds } = useInterests();

  if (loading) return <p role="status">회원정보를 불러오는 중입니다.</p>;
  if (mode === 'account' && !profile) {
    return error
      ? <p role="alert" className={styles.error}>{error.message}</p>
      : <p>온보딩에서 전공과 학번을 먼저 등록해 주세요.</p>;
  }

  return <ProfileEditor key={mode === 'onboarding' ? mode : profile?.id} mode={mode} profile={profile} initialInterests={fieldIds} />;
}

function ProfileEditor({ mode, profile, initialInterests }: {
  mode: Mode;
  profile: Profile | null;
  initialInterests: FieldId[];
}): JSX.Element {
  const { programs, fields } = useReference();
  const { save: saveProfile, error: profileError } = useProfile();
  const { fieldIds: savedInterests, save: saveInterests } = useInterests();
  const { items: enrollments } = useEnrollments();
  const [academic, setAcademic] = useState<AcademicSelection>({
    programId: profile?.program_id ?? '',
    admissionYear: profile?.admission_year ?? '',
  });
  const [interests, setInterests] = useState(initialInterests);
  const [step, setStep] = useState(0);
  const [accountSection, setAccountSection] = useState<AccountSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const onboarding = mode === 'onboarding';
  const showAcademic = onboarding ? step === 0 : accountSection === 'academic';
  const showInterests = onboarding ? step === 2 : accountSection === 'interests';

  function editAccount(section: AccountSection): void {
    setAcademic({ programId: profile?.program_id ?? '', admissionYear: profile?.admission_year ?? '' });
    setInterests(savedInterests);
    setNotice(null);
    setAccountSection(section);
  }

  useEffect(() => {
    if (onboarding) stepHeading.current?.focus();
  }, [onboarding, step]);

  const validAcademic = programs.some((program) => program.program_id === academic.programId
    && program.years.some((year) => year.admission_year === academic.admissionYear));

  async function save(ids: FieldId[]): Promise<void> {
    if (saving) return;
    if ((onboarding || showAcademic) && !validAcademic) {
      setNotice({ error: true, text: '등록 가능한 전공과 학번을 선택해 주세요.' });
      if (onboarding) setStep(0);
      return;
    }

    setSaving(true);
    setNotice(null);
    const changedInterests = ids.length !== savedInterests.length || ids.some((id) => !savedInterests.includes(id));
    let leaving = false;
    try {
      if ((onboarding || showInterests) && changedInterests) {
        const result = await saveInterests(ids);
        if (!result.ok) {
          setNotice({ error: true, text: result.error.message });
          return;
        }
      }

      // The route guard considers a profile complete, so write the profile last.
      if (academic.programId && academic.admissionYear && (onboarding || (showAcademic
        && (academic.programId !== profile?.program_id || academic.admissionYear !== profile?.admission_year)))) {
        const result = await saveProfile({ program_id: academic.programId, admission_year: academic.admissionYear });
        if (!result.ok) {
          setNotice({
            error: true,
            text: changedInterests
              ? `관심 분야는 저장됐지만 전공·학번을 저장하지 못했습니다. ${result.error.message}`
              : result.error.message,
          });
          return;
        }
      }

      if (onboarding) {
        // A document request rechecks the saved profile instead of reusing a prefetched redirect.
        window.location.replace(new URL('/roadmap', window.location.origin));
        leaving = true;
      } else {
        setAccountSection(null);
        setNotice({ error: false, text: '회원정보를 저장했습니다.' });
      }
    } catch {
      setNotice({ error: true, text: '회원정보를 저장할 수 없습니다. 다시 시도해 주세요.' });
    } finally {
      if (!leaving) setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (onboarding && step < 2) {
      if (step === 0 && validAcademic) setStep(1);
      return;
    }
    void save(interests);
  }

  const academicFields = <AcademicFields programs={programs} value={academic} disabled={saving} onChange={(value) => {
    setAcademic(value);
    setNotice(null);
  }} />;
  const interestFields = <InterestFields fields={fields} selected={interests} disabled={saving} onChange={(value) => {
    setInterests(value);
    setNotice(null);
  }} />;

  return (
    <div className={styles.shell}>
      {onboarding && (
        <>
          <ol className={styles.steps} aria-label="온보딩 단계">
            {steps.map(({ label }, index) => (
              <li key={label} aria-current={step === index ? 'step' : undefined} data-complete={index < step}>
                <span aria-hidden="true">{index + 1}</span> {label}
              </li>
            ))}
          </ol>
          <h1 ref={stepHeading} tabIndex={-1}>{steps[step].title}</h1>
          <p className="page-description">{steps[step].description}</p>
        </>
      )}

      {!onboarding && !accountSection && (
        <section className={styles.panel} aria-label="저장된 회원정보">
          {profile?.email && <p className={styles.help}>{profile.email}</p>}
          <dl className={styles.summary}>
            <div>
              <dt>전공·학번</dt>
              <dd>{programs.find((program) => program.program_id === profile?.program_id)?.name} · {profile?.admission_year}학번</dd>
              <Button onClick={() => editAccount('academic')}>전공·학번 변경</Button>
            </div>
            <div>
              <dt>수강 내역</dt>
              <dd>저장된 수강 내역 {enrollments.length}건</dd>
              <Link className="button" href="/enrollments">수강 내역 변경</Link>
            </div>
            <div>
              <dt>관심 분야</dt>
              <dd>{fields.filter((field) => savedInterests.includes(field.field_id)).map((field) => field.name_ko).join(' · ') || '선택한 분야 없음'}</dd>
              <Button onClick={() => editAccount('interests')}>관심 분야 변경</Button>
            </div>
          </dl>
          {notice && <p role="status" className={styles.success}>{notice.text}</p>}
        </section>
      )}
      {(onboarding || accountSection) && <form className={styles.panel} onSubmit={submit} aria-busy={saving}>
        {!onboarding && <h2>{showAcademic ? '전공·학번 변경' : '관심 분야 변경'}</h2>}
        {showAcademic && academicFields}
        {onboarding && step === 1 && <EnrollmentStep />}
        {showInterests && interestFields}

        {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? styles.error : styles.success}>
          {notice.text}
        </p>}
        {!notice && !saving && profileError && <p role="alert" className={styles.error}>{profileError.message}</p>}

        <div className={styles.actions}>
          {!onboarding && <Button disabled={saving} onClick={() => { setNotice(null); setAccountSection(null); }}>취소</Button>}
          {onboarding && step > 0 && <Button disabled={saving} onClick={() => setStep(step - 1)}>이전</Button>}
          {onboarding && step === 1 && <Button className="button-primary" onClick={() => setStep(2)}>건너뛰기</Button>}
          {onboarding && step === 2 && (
            <Button disabled={saving} onClick={() => void save([])}>관심 분야 건너뛰기</Button>
          )}
          {(!onboarding || step !== 1) && (
            <Button className="button-primary" type="submit" disabled={saving || (showAcademic && !validAcademic)}>
              {saving ? '저장 중…' : !onboarding ? '변경사항 저장' : step === 0 ? '다음: 수강 내역' : '설정 완료하고 노선도 보기'}
            </Button>
          )}
        </div>
      </form>}
    </div>
  );
}
