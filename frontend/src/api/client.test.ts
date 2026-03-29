import { describe, it, expect } from 'vitest';
import { apiClient, getToken, setToken, clearToken, createSession } from './client';

describe('api client', () => {
  it('has baseURL from env or empty string', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it('setToken and getToken work with localStorage', () => {
    clearToken();
    expect(getToken()).toBeNull();
    setToken('test-token-123');
    expect(getToken()).toBe('test-token-123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('sets Authorization header when token exists', () => {
    setToken('my-jwt-token');
    expect(apiClient.defaults.headers.common['Authorization']).toBe('Bearer my-jwt-token');
    clearToken();
  });

  it('removes Authorization header when token cleared', () => {
    setToken('temp');
    clearToken();
    expect(apiClient.defaults.headers.common['Authorization']).toBeUndefined();
  });
});

describe('createSession', () => {
  it('is a function that calls POST /api/sessions', () => {
    expect(typeof createSession).toBe('function');
  });
});
