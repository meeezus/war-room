import WebSocket from "ws";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types — mirrors OpenClaw gateway JSON-RPC frames
// ---------------------------------------------------------------------------

type ReqFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

type ResFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: unknown;
};

type EventFrame = {
  type: "event";
  event: string;
  seq?: number;
  payload?: unknown;
};

type Frame = ReqFrame | ResFrame | EventFrame;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GATEWAY_URL = `ws://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT || "18789"}`;
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

const CONNECT_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConnectFrame(): ReqFrame {
  return {
    type: "req",
    id: randomUUID(),
    method: "connect",
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "shoin-chat",
        displayName: "Shoin Chat",
        version: "1.0",
        platform: "web",
        mode: "ui",
        instanceId: `shoin-chat-${randomUUID().slice(0, 8)}`,
      },
      locale: "en-US",
      userAgent: "shoin-chat",
      role: "operator",
      scopes: ["operator.read", "operator.write"],
      caps: [],
      auth: { token: GATEWAY_TOKEN },
    },
  };
}

function buildChatSendFrame(message: string): ReqFrame {
  return {
    type: "req",
    id: randomUUID(),
    method: "chat.send",
    params: {
      sessionKey: "main",
      message,
      idempotencyKey: randomUUID(),
    },
  };
}

function send(ws: WebSocket, frame: ReqFrame): void {
  ws.send(JSON.stringify(frame));
}

/**
 * Wait for a `res` frame matching `reqId`. Rejects on timeout or error.
 */
function waitForResponse(
  ws: WebSocket,
  reqId: string,
  timeoutMs = CONNECT_TIMEOUT_MS,
): Promise<ResFrame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`OpenClaw: timed out waiting for response to ${reqId}`));
    }, timeoutMs);

    function onMessage(data: WebSocket.RawData) {
      try {
        const frame = JSON.parse(data.toString()) as Frame;
        if (frame.type === "res" && frame.id === reqId) {
          cleanup();
          if (frame.ok) {
            resolve(frame);
          } else {
            reject(
              new Error(
                `OpenClaw: request ${reqId} failed — ${JSON.stringify(frame.error)}`,
              ),
            );
          }
        }
      } catch {
        // Ignore non-JSON or irrelevant frames
      }
    }

    function onError(err: Error) {
      cleanup();
      reject(err);
    }

    function cleanup() {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
    }

    ws.on("message", onMessage);
    ws.on("error", onError);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a message to the OpenClaw gateway and return a ReadableStream of text
 * chunks as the assistant streams its response.
 *
 * The stream yields raw text strings (delta chunks). It closes when the
 * gateway emits a `done` chat event. On `error` events the stream errors out.
 *
 * If the gateway is unreachable an error is thrown immediately (before the
 * stream is created), allowing callers to fall back to another provider.
 */
export function sendToOpenClaw(message: string): ReadableStream<string> {
  let ws: WebSocket | null = null;

  return new ReadableStream<string>({
    async start(controller) {
      try {
        // 1. Open WebSocket
        ws = new WebSocket(GATEWAY_URL);

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`OpenClaw: connection timed out (${GATEWAY_URL})`));
          }, CONNECT_TIMEOUT_MS);

          ws!.once("open", () => {
            clearTimeout(timer);
            resolve();
          });

          ws!.once("error", (err) => {
            clearTimeout(timer);
            reject(
              new Error(
                `OpenClaw: failed to connect to ${GATEWAY_URL} — ${err.message}`,
              ),
            );
          });
        });

        // 2. Authenticate
        const connectFrame = buildConnectFrame();
        send(ws, connectFrame);
        await waitForResponse(ws, connectFrame.id);

        // 3. Send the chat message
        const chatFrame = buildChatSendFrame(message);
        send(ws, chatFrame);
        // We don't wait for the res frame of chat.send before streaming —
        // deltas may arrive before the ack, and waiting could cause us to miss
        // early chunks. We handle the res frame inside the message listener.

        // 4. Listen for chat events
        ws.on("message", (data: WebSocket.RawData) => {
          try {
            const frame = JSON.parse(data.toString()) as Frame;

            // Handle chat.send res frame (error case)
            if (
              frame.type === "res" &&
              frame.id === chatFrame.id &&
              !frame.ok
            ) {
              controller.error(
                new Error(
                  `OpenClaw: chat.send failed — ${JSON.stringify(frame.error)}`,
                ),
              );
              ws?.close();
              return;
            }

            if (frame.type !== "event" || frame.event !== "chat") return;

            const payload = frame.payload as {
              state: string;
              runId?: string;
              sessionKey?: string;
              message?: {
                role: string;
                content: Array<{ type: string; text?: string }>;
              };
            } | undefined;

            if (!payload) return;

            switch (payload.state) {
              case "delta": {
                const text = payload.message?.content?.[0]?.text;
                if (text) {
                  controller.enqueue(text);
                }
                break;
              }

              case "done": {
                controller.close();
                ws?.close();
                break;
              }

              case "error": {
                controller.error(
                  new Error("OpenClaw: assistant run errored"),
                );
                ws?.close();
                break;
              }
            }
          } catch {
            // Ignore parse errors for non-JSON frames
          }
        });

        ws.on("close", () => {
          // If the stream hasn't been closed yet, close it gracefully.
          try {
            controller.close();
          } catch {
            // Already closed — no-op
          }
        });

        ws.on("error", (err) => {
          try {
            controller.error(err);
          } catch {
            // Stream already errored or closed
          }
        });
      } catch (err) {
        // Connection or auth failed — error the stream
        controller.error(err);
        ws?.close();
      }
    },

    cancel() {
      // Consumer cancelled the stream — tear down the socket
      ws?.close();
    },
  });
}
