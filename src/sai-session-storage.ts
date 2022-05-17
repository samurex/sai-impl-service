import { randomUUID } from "crypto";
import { getSessionFromStorage, IStorage, Session } from "@inrupt/solid-client-authn-node";
import { AuthorizationAgent } from "@janeirodigital/interop-authorization-agent";
import { agentUrl } from "./url-templates"

type WebId = string;

const cache = new Map<WebId, AuthorizationAgent>();

export function getClientIdKey(clientId: string): string {
  return `clientId:${clientId}`;
}

async function buildSaiSession(
  oidcSession: Session,
  clientId: string
): Promise<AuthorizationAgent> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const webId = oidcSession.info.webId!;
  return AuthorizationAgent.build(webId, clientId, {
    fetch: oidcSession.fetch,
    randomUUID,
  });
}

export class SessionManager {
  constructor(public storage: IStorage) {}

  async get(webId: string): Promise<AuthorizationAgent | undefined> {
    const cached = cache.get(webId);
    if (cached) return cached;
    const oidcSession = await getSessionFromStorage(webId, this.storage);
    if (oidcSession) {
      const saiSession = await buildSaiSession(oidcSession, oidcSession.info.clientAppId!);
      cache.set(webId, saiSession);
      return saiSession;
    }
  }

  async getFromUuid(uuid: string): Promise<AuthorizationAgent | undefined> {
    const clientId = agentUrl(uuid);
    const webId = await this.getWebId(clientId);
    return webId ? this.get(webId) : undefined;
  }

  async getWebId(clientId: string): Promise<string | undefined> {
    return this.storage.get(getClientIdKey(clientId));
  }

  async setClientId2WebIdMapping (clientId: string, webId: string): Promise<void> {
    await this.storage.set(getClientIdKey(clientId), webId)
  }
}
