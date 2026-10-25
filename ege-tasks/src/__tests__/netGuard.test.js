// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isPrivateAddress, isSdamgiaUrl, assertPublicUrl } from '../../../pocketbase/net-guard.mjs';

// Защита /fetch-image и /parse-sdamgia от запросов внутрь VPS (аудит 25.10.2026).
describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1',
    '::ffff:127.0.0.1', 'не-адрес',
  ])('%s — внутренний', (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '147.45.158.148', '172.15.0.1', '172.32.0.1', '2a00:1450:4010::8a'])(
    '%s — публичный', (ip) => expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe('isSdamgiaUrl', () => {
  it('sdamgia.ru и поддомены', () => {
    expect(isSdamgiaUrl('https://ege.sdamgia.ru/problem?id=1')).toBe(true);
    expect(isSdamgiaUrl('https://mathb-ege.sdamgia.ru/test?id=5')).toBe(true);
    expect(isSdamgiaUrl('http://sdamgia.ru/')).toBe(true);
  });
  it('подделки не проходят', () => {
    expect(isSdamgiaUrl('http://127.0.0.1:8095/?sdamgia.ru')).toBe(false);
    expect(isSdamgiaUrl('https://evilsdamgia.ru/')).toBe(false);
    expect(isSdamgiaUrl('https://sdamgia.ru.evil.com/')).toBe(false);
    expect(isSdamgiaUrl('file:///etc/passwd?sdamgia.ru')).toBe(false);
    expect(isSdamgiaUrl('не ссылка')).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  const resolveTo = (address) => async () => [{ address }];

  it('публичный хост — пропускает', async () => {
    await expect(assertPublicUrl('https://ege.sdamgia.ru/get_file?id=1', { resolve: resolveTo('84.201.0.1') })).resolves.toBeTruthy();
  });
  it('имя, ведущее во внутреннюю сеть, — нет', async () => {
    await expect(assertPublicUrl('https://evil.example/', { resolve: resolveTo('127.0.0.1') })).rejects.toThrow('внутренней');
  });
  it('IP-адрес внутри, порт, логин, протокол — нет', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toThrow();
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow();
    await expect(assertPublicUrl('http://example.com:8095/', { resolve: resolveTo('1.2.3.4') })).rejects.toThrow('порт');
    await expect(assertPublicUrl('http://u:p@example.com/', { resolve: resolveTo('1.2.3.4') })).rejects.toThrow('логин');
    await expect(assertPublicUrl('ftp://example.com/')).rejects.toThrow('http');
  });
});
