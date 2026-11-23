import type {} from 'vitest/jsdom';
import { vi } from 'vitest';

// Vitest의 jsdom 환경에서 Node의 전역 localStorage 대신 브라우저 저장소를 사용한다.
vi.stubGlobal('localStorage', jsdom.window.localStorage);
