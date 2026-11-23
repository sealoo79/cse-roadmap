'use client';

import { useId, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { useNoncredit } from '@/lib/user-data/hooks';
import type { Result } from '@/lib/user-data/repository';
import type { ChecklistItem, ChecklistKey } from '@/types/reference';
import type { NoncreditStatus } from '@/types/user';
import { decideNoncredit, scoreThreshold, type NoncreditChoice } from './noncredit-status';
import styles from './graduation.module.css';

type Choice = NoncreditChoice | 'none';

const BOOLEAN_CHOICES: ReadonlyArray<[Choice, string]> = [['met', '충족'], ['unmet', '미충족'], ['none', '입력 안 함']];
const INPUT_TYPE: Record<Exclude<ChecklistItem['input_type'], 'boolean'>, 'number' | 'text' | 'date'> = {
  number: 'number', text: 'text', date: 'date',
};

export interface NoncreditInputProps {
  checklistKey: ChecklistKey;
  /** 입력 묶음의 이름(스크린리더가 읽는 legend) */
  legend: string;
  definition: ChecklistItem | undefined;
  answer: NoncreditStatus | undefined;
  /** 규칙 문장. 숫자 입력의 기준 점수를 여기서 찾는다. */
  rule: string | null;
}

/** 비학점 요건 하나를 checklist의 input_type에 맞게 입력받아 setNoncredit / clearNoncredit으로 저장한다. */
export function NoncreditInput({ checklistKey, legend, definition, answer, rule }: NoncreditInputProps): JSX.Element {
  const { set, clear } = useNoncredit();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputType = definition?.input_type ?? 'boolean';

  async function run(action: () => Promise<Result<unknown>>): Promise<void> {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) setError(result.error.message);
  }

  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [definition?.help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  if (inputType === 'boolean') {
    const current: Choice = answer?.status ?? 'none';
    return (
      <fieldset className={styles.noncredit} aria-describedby={describedBy} disabled={pending}>
        <legend className={styles.visuallyHidden}>{legend}</legend>
        <div className={styles.choices}>
          {BOOLEAN_CHOICES.map(([value, label]) => (
            <label key={value} className={styles.choice} data-choice={value}>
              <input className="form-control"
                type="radio" name={`${id}-choice`} value={value} checked={current === value}
                onChange={() => void run(() => (value === 'none' ? clear(checklistKey) : set(checklistKey, value, value === 'met' ? 'true' : 'false')))}
              />
              {label}
            </label>
          ))}
        </div>
        {definition?.help && <p id={helpId} className={styles.help}>{definition.help}</p>}
        {error && <p id={errorId} className="error" role="alert">{error}</p>}
      </fieldset>
    );
  }

  return (
    <ValueInput
      key={`${answer?.input_value ?? ''}:${answer?.status ?? ''}`}
      id={id} legend={legend} type={inputType} help={definition?.help} answer={answer} rule={rule}
      pending={pending} error={error} setError={setError}
      onSave={(status, value) => run(() => set(checklistKey, status, value))}
      onClear={() => run(() => clear(checklistKey))}
    />
  );
}

function ValueInput(props: {
  id: string; legend: string; type: Exclude<ChecklistItem['input_type'], 'boolean'>; help: string | undefined;
  answer: NoncreditStatus | undefined; rule: string | null; pending: boolean; error: string | null;
  setError(message: string | null): void;
  onSave(status: NoncreditChoice, value: string | null): Promise<void>;
  onClear(): Promise<void>;
}): JSX.Element {
  const { id, legend, type, help, answer, rule, pending, error, setError, onSave, onClear } = props;
  const [value, setValue] = useState(answer?.input_value ?? '');
  const [choice, setChoice] = useState<NoncreditChoice | null>(answer?.status ?? null);
  const threshold = type === 'number' ? scoreThreshold(rule) : null;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const decision = decideNoncredit(type, { value, choice }, threshold);
    if (!decision.ok) {
      setError(decision.message);
      return;
    }
    void onSave(decision.status, decision.value);
  }

  return (
    <form className={styles.noncredit} onSubmit={submit} aria-label={legend}>
      <fieldset disabled={pending} aria-describedby={describedBy}>
        <legend className={styles.visuallyHidden}>{legend}</legend>
        <div className={styles.valueRow}>
          <label className={styles.valueLabel}>
            <span>{type === 'number' ? '점수' : type === 'date' ? '날짜' : '내용'}</span>
            <input className="form-control"
              type={INPUT_TYPE[type]} value={value} inputMode={type === 'number' ? 'numeric' : undefined}
              min={type === 'number' ? 0 : undefined} onChange={(event) => setValue(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </label>
          {threshold === null && (
            <div className={styles.choices} role="radiogroup" aria-label={`${legend} 충족 여부`}>
              {(['met', 'unmet'] as const).map((option) => (
                <label key={option} className={styles.choice} data-choice={option}>
                  <input type="radio" name={`${id}-choice`} checked={choice === option} onChange={() => setChoice(option)} />
                  {option === 'met' ? '충족' : '미충족'}
                </label>
              ))}
            </div>
          )}
          <Button type="submit">저장</Button>
          {answer && <Button onClick={() => void onClear()}>입력 지우기</Button>}
        </div>
        {threshold !== null && <p className={styles.help}>기준 {threshold}점 이상이면 충족으로 판정합니다.</p>}
        {help && <p id={helpId} className={styles.help}>{help}</p>}
        {error && <p id={errorId} className="error" role="alert">{error}</p>}
      </fieldset>
    </form>
  );
}
