import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfile } from '@/lib/user-data/hooks';
import { MOCK_STORAGE_KEY, MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import { ProfileSettings } from './ProfileSettings';

function ProfileObserver(): JSX.Element {
  const { profile } = useProfile();
  return <output aria-label="저장된 전공·학번">{profile?.program_id}:{profile?.admission_year}</output>;
}

function openEditor(mode: 'onboarding' | 'account') {
  if (mode === 'onboarding') {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
      version: 1, profile: null, enrollments: [], interests: [], noncredit: [], ocrItems: [],
    }));
  }
  const repository = new MockUserDataRepository();
  render(
    <UserDataProvider repository={repository}>
      <ProfileSettings mode={mode} />
      <ProfileObserver />
    </UserDataProvider>,
  );
  return repository;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('온보딩과 회원정보', () => {
  it('전공별 학번을 표시하고 교육과정이 없는 조합을 안내한다', async () => {
    openEditor('onboarding');
    const program = await screen.findByRole('combobox', { name: '전공' });
    fireEvent.change(program, { target: { value: 'ai_computing' } });
    const year = screen.getByRole('combobox', { name: '학번' });
    fireEvent.change(year, { target: { value: '2023' } });
    expect(screen.getByText(/교육과정 자료가 아직 없습니다/)).toBeTruthy();

    fireEvent.change(program, { target: { value: 'adv_computing' } });
    expect((year as HTMLSelectElement).value).toBe('');
    expect(screen.queryByRole('option', { name: '2023학번' })).toBeNull();
    expect((screen.getByRole('button', { name: '다음: 수강 내역' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('관심 분야를 먼저 저장하며 프로필 저장에 실패해도 마지막 단계에서 재시도할 수 있다', async () => {
    const repo = openEditor('onboarding');
    const interests = vi.spyOn(repo, 'setInterests');
    const profile = vi.spyOn(repo, 'upsertProfile').mockResolvedValue({
      ok: false, error: { code: 'network', message: '다시 시도할 수 있습니다.' },
    });

    fireEvent.change(await screen.findByRole('combobox', { name: '전공' }), { target: { value: 'adv_computing' } });
    fireEvent.change(screen.getByRole('combobox', { name: '학번' }), { target: { value: '2026' } });
    fireEvent.click(screen.getByRole('button', { name: '다음: 수강 내역' }));
    expect(screen.getByText('저장된 수강 내역 0건')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /AI·데이터/ }));
    fireEvent.click(screen.getByRole('button', { name: '설정 완료하고 노선도 보기' }));

    expect(await screen.findByText(/관심 분야는 저장됐지만/)).toBeTruthy();
    expect(interests).toHaveBeenCalledWith(['ai_data']);
    expect(profile).toHaveBeenCalledWith({ program_id: 'adv_computing', admission_year: 2026 });
    expect(interests.mock.invocationCallOrder[0]).toBeLessThan(profile.mock.invocationCallOrder[0]);
    expect((screen.getByRole('button', { name: '설정 완료하고 노선도 보기' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('회원정보 저장 후 같은 프로필 훅을 사용하는 화면에 변경을 전달한다', async () => {
    const repo = openEditor('account');
    fireEvent.click(await screen.findByRole('button', { name: '전공·학번 변경' }));
    fireEvent.change(await screen.findByRole('combobox', { name: '전공' }), { target: { value: 'global_sw' } });
    fireEvent.change(screen.getByRole('combobox', { name: '학번' }), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(screen.getByLabelText('저장된 전공·학번').textContent).toBe('global_sw:2025'));
    fireEvent.click(await screen.findByRole('button', { name: '관심 분야 변경' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /소프트웨어·웹/ }));
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));

    expect(await screen.findByText('회원정보를 저장했습니다.')).toBeTruthy();
    expect(await repo.getInterests()).toEqual({ ok: true, data: ['sw_web'] });
    expect(await repo.getProfile()).toMatchObject({ ok: true, data: { major_type: 'single' } });
  });
});
