'use client';

import type { CSSProperties, JSX } from 'react';
import type { AdmissionYear, Field, FieldId, Program, ProgramId } from '@/types/reference';
import styles from './profile.module.css';

export interface AcademicSelection {
  programId: ProgramId | '';
  admissionYear: AdmissionYear | '';
}

interface AcademicFieldsProps {
  programs: Program[];
  value: AcademicSelection;
  onChange(value: AcademicSelection): void;
  disabled?: boolean;
}

export function AcademicFields({ programs, value, onChange, disabled }: AcademicFieldsProps): JSX.Element {
  const program = programs.find((item) => item.program_id === value.programId);
  const years = program?.years ?? [];
  const year = years.find((item) => item.admission_year === value.admissionYear);
  const status = year?.curriculum_status;

  return (
    <fieldset className={styles.group} disabled={disabled}>
      <legend>전공·학번</legend>
      <div className={styles.selects}>
        <label>
          전공
          <select value={value.programId} required onChange={(event) => {
            const next = programs.find((item) => item.program_id === event.target.value);
            const keepYear = next?.years.some((entry) => entry.admission_year === value.admissionYear);
            onChange({ programId: next?.program_id ?? '', admissionYear: keepYear ? value.admissionYear : '' });
          }}>
            <option value="">전공 선택</option>
            {programs.map((item) => <option value={item.program_id} key={item.program_id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          학번
          <select value={year?.admission_year ?? ''} required disabled={!program}
            aria-describedby={status === 'missing' || status === 'assumed' ? 'curriculum-status' : undefined}
            onChange={(event) => {
              const next = years.find((item) => String(item.admission_year) === event.target.value);
              onChange({ ...value, admissionYear: next?.admission_year ?? '' });
            }}>
            <option value="">학번 선택</option>
            {years.map((item) => <option value={item.admission_year} key={item.admission_year}>{item.admission_year}학번</option>)}
          </select>
        </label>
      </div>
      {(status === 'missing' || status === 'assumed') && (
        <p id="curriculum-status" className={styles.warning} role="status">
          {status === 'missing'
            ? '이 전공·학번의 교육과정 자료가 아직 없습니다. 자료가 추가되기 전까지 노선도와 졸업요건이 제한될 수 있습니다.'
            : '이 전공·학번에는 임시 교육과정 자료가 사용됩니다.'}
        </p>
      )}
    </fieldset>
  );
}

interface InterestFieldsProps {
  fields: Field[];
  selected: FieldId[];
  onChange(ids: FieldId[]): void;
  disabled?: boolean;
}

export function InterestFields({ fields, selected, onChange, disabled }: InterestFieldsProps): JSX.Element {
  return (
    <fieldset className={styles.group} disabled={disabled}>
      <legend>관심 분야</legend>
      <p className={styles.help}>여러 분야를 선택할 수 있습니다.</p>
      <div className={styles.interests}>
        {fields.map((field) => {
          const checked = selected.includes(field.field_id);
          const colors = {
            '--field-color': field.color,
            '--field-color-dark': field.color_dark ?? field.color,
          } as CSSProperties;
          return (
            <label key={field.field_id} className={styles.field} style={colors}>
              <input type="checkbox" checked={checked} onChange={(event) => {
                onChange(event.target.checked
                  ? [...selected, field.field_id]
                  : selected.filter((id) => id !== field.field_id));
              }} />
              <span>
                <strong>{field.name_ko}</strong>
                {field.description && <small>{field.description}</small>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
