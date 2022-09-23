import { randomUUID } from "crypto";
import { getSessionFromStorage, IStorage, Session } from "@inrupt/solid-client-authn-node";
import { AuthorizationAgent } from "@janeirodigital/interop-authorization-agent";
import { ISessionManager } from "@janeirodigital/sai-server-interfaces"
import { webId2agentUrl } from "./url-templates";

type WebId = string;

const cache = new Map<WebId, AuthorizationAgent>();

const prefixes = {
  subscription: 'push:sub'
}

async function buildSaiSession(
  oidcSession: Session,
  clientId: string
): Promise<AuthorizationAgent> {
  // TODO handle if (!oidcSession.info.isLoggedIn)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const webId = oidcSession.info.webId!;
  return AuthorizationAgent.build(webId, clientId, {
    fetch: oidcSession.fetch,
    randomUUID,
  });
}

export class SessionManager implements ISessionManager {
  constructor(public storage: IStorage) {}
  async getSaiSession(webId: string): Promise<AuthorizationAgent> {
    const cached = cache.get(webId);
    if (cached) return cached;

    const oidcSession = await this.getOidcSession(webId)
    const agentUrl = webId2agentUrl(webId)
    const saiSession = await buildSaiSession(oidcSession, agentUrl);
    cache.set(webId, saiSession);
    return saiSession;
  }

  async getOidcSession(webId: string): Promise<Session> {
    let session = await getSessionFromStorage(webId, this.storage);

    if (!session) {
      session =  new Session({ storage: this.storage }, webId);
    }

    return session;
  }

  async getPushSubscriptions(webId: string): Promise<PushSubscription[]> {
    const key = `${prefixes.subscription}${webId}`
    const value = await this.storage.get(key)

    return value ? JSON.parse(value) as PushSubscription[] : [];
  }

  async addPushSubscription(webId: string, subscription: PushSubscription): Promise<void> {
    const key = `${prefixes.subscription}${webId}`
    const existing = await this.getPushSubscriptions(webId);

    await this.storage.set(key, JSON.stringify([subscription, ...existing]));
  }
}
