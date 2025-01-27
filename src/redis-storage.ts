import { createClient } from "redis";
import { IStorage } from "@inrupt/solid-client-authn-node";

export class RedisStorage implements IStorage {
  private client;
  private static _instance: RedisStorage;

  private constructor() {
    this.client = createClient();
    this.client.on("error", (err) => {
      console.log("Critical Redis Error. Shutting down.");
      console.log(err);
      process.exit(1);
    });
    this.client.connect();
  }

  public static get instance(): RedisStorage {
    if (this._instance) {
      return this._instance;
    }

    this._instance = new RedisStorage();
    return this._instance;
  }

  async delete(key: string): Promise<void> {
    const result = await this.client.del(key).then();
    if (result > 0) return;
    else {
      return; // ??
    }
  }

  async get(key: string): Promise<string | undefined> {
      const value = await this.client.get(key);
      return value || undefined;
  }

  async set(key: string, value: string): Promise<void> {
    const result = await this.client.set(key, value);
    if (result == "OK") return;
  }
}
