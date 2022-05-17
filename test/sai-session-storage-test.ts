import { jest } from '@jest/globals';
import { InMemoryStorage, Session } from '@inrupt/solid-client-authn-node';

import { AuthorizationAgent } from '@janeirodigital/interop-authorization-agent';
jest.mock('@janeirodigital/interop-authorization-agent');
const MockedAuthorizationAgent = AuthorizationAgent as jest.MockedFunction<any>

import { getSessionFromStorage } from '@inrupt/solid-client-authn-node';
jest.mock('@inrupt/solid-client-authn-node', () => {
  const originalModule = jest.requireActual('@inrupt/solid-client-authn-node') as object;

  return {
    ...originalModule,
    getSessionFromStorage: jest.fn()
  }
})
const mockedGetSessionFromStorage = getSessionFromStorage as jest.MockedFunction<any>;

import { SessionManager, getClientIdKey } from '../src/sai-session-storage';
import { agentUrl } from '../src/url-templates'

let manager: SessionManager

beforeEach(() => {
  manager = new SessionManager(new InMemoryStorage())
  mockedGetSessionFromStorage.mockReset();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('getWebId', () => {
  test('should return WebID based on ClientId', async () => {
    const webId = 'https://alice.example/';
    const clientId = 'https://sai.example/agents/0a0b5f5c-a352-4d8e-b5f4-d031afff0f23';
    manager.storage.set(getClientIdKey(clientId), webId)
    expect(await manager.getWebId(clientId)).toEqual(webId);
  });
});

describe('getFromUuid', () => {
  test('should try to get using correct WebId', async () => {
    const uuid = '8c4b1081-bc98-44ef-af57-271bac06d95f';
    const webId = 'https://alice.example/';
    manager.storage.set(getClientIdKey(agentUrl(uuid)), webId)
    const getSpy = jest.spyOn(manager, 'get').mockImplementationOnce(async () => ({} as AuthorizationAgent));
    await manager.getFromUuid(uuid);
    expect(getSpy).toBeCalledTimes(1);
    expect(getSpy).toBeCalledWith(webId);
  });

  test('should return undefined when using unregistered clientId', async () => {
    const uuid = 'fff8be42-8946-4759-b758-40a026ac7a06';
    const authAgent = await manager.getFromUuid(uuid);
    expect(authAgent).toBeUndefined()
  });
});

describe('get', () => {
  test('creates sai session', async () => {
    const webId = 'https://user.example/'
    const clientId = 'https://aa.example/'
    const oidcSession = {
      info: { webId, clientAppId: clientId },
      fetch: () => {}
    } as unknown as Session

    mockedGetSessionFromStorage.mockImplementationOnce((webId: string, iStorage: Storage) => {
      return oidcSession
    });
    const authAgent = {} as unknown as AuthorizationAgent
    MockedAuthorizationAgent.build.mockImplementationOnce((webid: string, agentid: string, dependencies: {fetch: Function}) => {
      expect(webid).toBe(webId)
      expect(agentid).toBe(clientId)
      expect(dependencies.fetch).toBe(oidcSession.fetch)

      return authAgent
    })

    const saiSession = await manager.get(webId) as AuthorizationAgent
    expect(saiSession).toBe(authAgent)

    const cachedSession = await manager.get(webId) as AuthorizationAgent
    expect(cachedSession).toBe(authAgent)
  })
})
