import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFields } from '@/lib/reference';
import { MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import type { CourseCode } from '@/types/reference';
import { RoadmapSearch } from './index';

const fields = getFields().map(({ field_id }) => field_id);

function SearchWithFilters({ onSelect }: { onSelect(code: CourseCode): void }): JSX.Element {
  const [visibleFields, setVisibleFields] = useState(fields);
  return <RoadmapSearch onSelect={onSelect} visibleFields={visibleFields} onChangeVisibleFields={setVisibleFields} />;
}

function openSearch(onSelect = vi.fn()): void {
  render(
    <UserDataProvider repository={new MockUserDataRepository(() => ({ getItem: () => null, setItem: () => {} }))}>
      <SearchWithFilters onSelect={onSelect} />
    </UserDataProvider>,
  );
}

afterEach(cleanup);

describe('RoadmapSearch', () => {
  it('finds partial course names and codes in the student roadmap and sends the selected course code', async () => {
    const onSelect = vi.fn();
    openSearch(onSelect);
    const search = screen.getByRole('searchbox', { name: '과목 검색' });
    fireEvent.change(search, { target: { value: '기초 프로그래밍' } });
    expect(await screen.findByRole('button', { name: /^기초프로그래밍 COMP0206$/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: ' coMp020 ' } });
    const match = within(screen.getByRole('list', { name: '과목 검색 결과' }));
    expect(match.queryByRole('button', { name: /COMP0204/ })).toBeNull();
    const course = match.getByRole('button', { name: /COMP0206/ });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(course);
    fireEvent.click(course);
    expect(onSelect).toHaveBeenCalledWith('COMP0206');
    expect(screen.queryByRole('list', { name: '과목 검색 결과' })).toBeNull();
  });

  it('toggles fields and restores all fields when the filters are cleared', () => {
    openSearch();
    const group = within(screen.getByRole('group', { name: '분야 필터' }));
    const systems = group.getByRole('button', { name: '시스템' });
    const common = group.getByRole('button', { name: '공통 기초' });
    const reset = group.getByRole('button', { name: '필터 초기화' });

    fireEvent.click(systems);
    fireEvent.click(common);
    expect(systems.getAttribute('aria-pressed')).toBe('false');
    expect(common.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(reset);
    expect(group.getAllByRole('button', { pressed: true })).toHaveLength(fields.length);
    expect(reset.hasAttribute('disabled')).toBe(true);
  });
});
