import { randomInt, randomUUID } from "node:crypto";

const DEFAULT_LIFETIME_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;

export class PairingManager {
  #sessions = new Map();
  #attempts = new Map();
  #now;
  #lifetimeMs;

  constructor({ now = () => Date.now(), lifetimeMs = DEFAULT_LIFETIME_MS } = {}) {
    this.#now = now;
    this.#lifetimeMs = lifetimeMs;
  }

  create() {
    this.#removeExpired();
    let code;
    do code = String(randomInt(100000, 1000000));
    while ([...this.#sessions.values()].some((session) => session.code === code));

    const session = {
      id: randomUUID(),
      code,
      createdAt: this.#now(),
      expiresAt: this.#now() + this.#lifetimeMs
    };
    this.#sessions.set(session.id, session);
    return this.#publicSession(session);
  }

  consume(code, requester = "default") {
    this.#removeExpired();
    const attempt = this.#attempts.get(requester);
    if (attempt && attempt.resetAt > this.#now() && attempt.count >= MAX_FAILED_ATTEMPTS) {
      throw Object.assign(new Error("配对尝试过多，请稍后再试。"), { status: 429 });
    }
    const session = [...this.#sessions.values()].find((candidate) => candidate.code === String(code ?? ""));
    if (!session) {
      const current = attempt && attempt.resetAt > this.#now() ? attempt : { count: 0, resetAt: this.#now() + this.#lifetimeMs };
      current.count += 1;
      this.#attempts.set(requester, current);
      throw Object.assign(new Error("配对码无效或已过期。"), { status: 401 });
    }
    this.#sessions.delete(session.id);
    this.#attempts.delete(requester);
    return this.#publicSession(session);
  }

  #removeExpired() {
    const now = this.#now();
    for (const session of this.#sessions.values()) {
      if (session.expiresAt <= now) this.#sessions.delete(session.id);
    }
    for (const [requester, attempt] of this.#attempts) {
      if (attempt.resetAt <= now) this.#attempts.delete(requester);
    }
  }

  #publicSession(session) {
    return {
      id: session.id,
      code: session.code,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString()
    };
  }
}
