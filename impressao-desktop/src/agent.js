import { EventEmitter } from "node:events";
import { createClient } from "@supabase/supabase-js";

/** Fallback when a Realtime wake-up is missed. Kept short so mean delay stays ~1s. */
const POLL_MS = 2_000;
/** Keep the station marked online without delaying every drain. */
const HELLO_MS = 120_000;
const CLAIM_BATCH = 20;

/** The station was removed in Gestão or the code is wrong; retrying will not help. */
export class UnauthorizedError extends Error {}

/**
 * Pulls print jobs for the printers mapped on this computer and prints them.
 * A Realtime broadcast wakes it up as soon as a job is queued; polling covers
 * missed broadcasts and keeps the station marked as online.
 *
 * Events: "status" ({ online, error }), "info" (hello payload), "job" ({ ...job, ok, error }).
 */
export class PrintAgent extends EventEmitter {
  /**
   * @param {{ url: string, key: string, token: string }} connection
   * @param {{ printerIds: () => string[], print: (job: object) => Promise<void>, version?: string }} handlers
   */
  constructor(connection, handlers) {
    super();
    this.connection = connection;
    this.handlers = handlers;
    this.client = createClient(connection.url, connection.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    this.info = null;
    this.channel = null;
    this.pollTimer = null;
    this.helloTimer = null;
    this.draining = false;
    this.again = false;
    this.stopped = false;
    this.resubscribeTimer = null;
  }

  /** Validates the token. Throws UnauthorizedError for a bad code. */
  async hello() {
    const { data, error } = await this.client.rpc("agente_impressao_ola", {
      p_token: this.connection.token,
      p_versao: this.handlers.version ?? null,
    });
    if (error) throw toError(error);
    const stationChanged = this.info?.estacao.id !== data.estacao.id;
    this.info = data;
    this.emit("info", data);
    if (stationChanged) this.subscribe();
    return data;
  }

  start() {
    this.stopped = false;
    this.pollTimer = setInterval(() => void this.safeDrain(), POLL_MS);
    this.helloTimer = setInterval(() => void this.safeHello(), HELLO_MS);
    void this.safeDrain();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.pollTimer);
    clearInterval(this.helloTimer);
    clearTimeout(this.resubscribeTimer);
    this.pollTimer = null;
    this.helloTimer = null;
    this.resubscribeTimer = null;
    if (this.channel) await this.client.removeChannel(this.channel);
    this.channel = null;
  }

  subscribe() {
    if (this.channel) void this.client.removeChannel(this.channel);
    const topic = `impressao-estacao:${this.info.estacao.id}`;
    this.channel = this.client
      .channel(topic)
      .on("broadcast", { event: "jobs" }, () => void this.drain())
      .subscribe((status) => {
        if (this.stopped) return;
        // Catch jobs queued while the socket was down, and recover from drops.
        if (status === "SUBSCRIBED") void this.drain();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(this.resubscribeTimer);
          this.resubscribeTimer = setTimeout(() => {
            this.resubscribeTimer = null;
            if (!this.stopped && this.info) this.subscribe();
          }, 1_000);
        }
      });
  }

  async safeHello() {
    if (this.stopped) return;
    try {
      await this.hello();
    } catch (error) {
      this.fail(error);
    }
  }

  async safeDrain() {
    if (this.stopped) return;
    try {
      await this.drain();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Claims and prints until the queue is empty. Concurrent calls coalesce into one more pass. */
  async drain() {
    if (this.stopped || !this.info) return;
    if (this.draining) {
      this.again = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.again = false;
        const { data, error } = await this.client.rpc("agente_impressao_pegar", {
          p_token: this.connection.token,
          p_impressora_ids: this.handlers.printerIds(),
        });
        if (error) throw toError(error);
        const jobs = [...(data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
        for (const job of jobs) await this.run(job);
        if (jobs.length >= CLAIM_BATCH) this.again = true;
      } while (this.again && !this.stopped);
      this.emit("status", { online: true, error: null });
    } catch (error) {
      this.fail(error);
    } finally {
      this.draining = false;
    }
  }

  async run(job) {
    let failure = null;
    try {
      await this.handlers.print(job);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    this.emit("job", { ...job, ok: !failure, error: failure });
    const { error } = await this.client.rpc("agente_impressao_concluir", {
      p_token: this.connection.token,
      p_job_id: job.id,
      p_erro: failure,
    });
    if (error) throw toError(error);
  }

  fail(error) {
    if (error instanceof UnauthorizedError) void this.stop();
    this.emit("status", { online: false, error });
  }
}

function toError(error) {
  if (error.code === "28000") return new UnauthorizedError(error.message);
  const offline = /fetch failed|network|ENOTFOUND|ECONN|ETIMEDOUT/i.test(error.message ?? "");
  return new Error(offline ? "Sem conexão com a internet." : error.message || "Erro ao falar com o servidor.");
}
