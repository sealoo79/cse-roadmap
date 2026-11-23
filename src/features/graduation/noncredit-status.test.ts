import { describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { checklistRuleText, decideNoncredit, scoreThreshold } from './noncredit-status';

describe('scoreThreshold', () => {
  it('기준 점수가 하나면 그 점수를 쓴다', () => {
    expect(scoreThreshold('토익 700점 이상')).toBe(700);
    expect(scoreThreshold('토익 700점 이상 또는 이에 상응하는 공인 영어성적')).toBe(700);
  });
  it('점수가 없거나 트랙마다 다르면 null', () => {
    expect(scoreThreshold(null)).toBeNull();
    expect(scoreThreshold('현장실습 3학점 이상')).toBeNull();
    expect(scoreThreshold('트랙별 토익 기준: 다중전공·학석사연계 700점 이상, 해외복수학위 800점 이상')).toBeNull();
  });
});

describe('decideNoncredit', () => {
  it('숫자는 기준 점수로 자동 판정한다', () => {
    expect(decideNoncredit('number', { value: ' 700 ', choice: null }, 700)).toEqual({ ok: true, status: 'met', value: '700' });
    expect(decideNoncredit('number', { value: '699', choice: 'met' }, 700)).toEqual({ ok: true, status: 'unmet', value: '699' });
  });
  it('기준이 없으면 학생이 고른 값을 쓴다', () => {
    expect(decideNoncredit('number', { value: '750', choice: null }, null)).toEqual({ ok: false, message: '충족 여부를 선택해 주세요.' });
    expect(decideNoncredit('number', { value: '750', choice: 'met' }, null)).toEqual({ ok: true, status: 'met', value: '750' });
    expect(decideNoncredit('text', { value: '정보처리기사', choice: 'met' }, null)).toEqual({ ok: true, status: 'met', value: '정보처리기사' });
  });
  it('형식이 틀리면 저장하지 않는다', () => {
    expect(decideNoncredit('number', { value: '', choice: 'met' }, 700).ok).toBe(false);
    expect(decideNoncredit('number', { value: '-1', choice: 'met' }, 700).ok).toBe(false);
    expect(decideNoncredit('number', { value: 'abc', choice: 'met' }, null).ok).toBe(false);
    expect(decideNoncredit('date', { value: '2026/11/23', choice: 'met' }, null).ok).toBe(false);
    expect(decideNoncredit('date', { value: '2026-11-23', choice: 'unmet' }, null)).toEqual({ ok: true, status: 'unmet', value: '2026-11-23' });
  });
});

describe('checklistRuleText', () => {
  it('학생에게 적용되는 규칙의 문장만 모은다', () => {
    const ref = getReferenceData();
    const texts = checklistRuleText(ref.rules, ['univ__2024_2026', 'adv_computing__2026']);
    expect(texts.get('english_score')).toBe('토익 700점 이상 또는 이에 상응하는 공인 영어성적');
    expect(texts.has('portfolio')).toBe(false);
    expect(texts.get('gq_software')).toMatch(/^소프트웨어:/);
  });
});
