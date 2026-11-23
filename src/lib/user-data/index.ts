import { MockUserDataRepository } from './mock-repository';
import type { UserDataRepository } from './repository';

let repository: UserDataRepository | undefined;
export function getRepository(): UserDataRepository {
  if (process.env.NEXT_PUBLIC_USE_MOCK !== '1') {
    throw new Error('실제 저장소는 이슈 #9에서 연결합니다. 현재는 NEXT_PUBLIC_USE_MOCK=1로 실행해 주세요.');
  }
  repository ??= new MockUserDataRepository();
  return repository;
}
export type { RepoError, Result, UserDataRepository } from './repository';
