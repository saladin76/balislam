import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { readBody } from "../app/server/body";

const req = (chunks: Array<string | Buffer>, headers: Record<string, string> = {}) =>
  Object.assign(Readable.from(chunks), { headers }) as unknown as IncomingMessage;

describe("core API request limits", () => {
  it("accepts valid legacy JSON and empty bodies", async () => {
    await expect(readBody(req(['{"channel":"balislam","value":2}']))).resolves.toEqual({ channel: "balislam", value: 2 });
    await expect(readBody(req([]))).resolves.toEqual({});
  });

  it("refuses a declared oversized body before allocating a buffer", async () => {
    await expect(readBody(req([], { "content-length": "500" }), 64))
      .rejects.toMatchObject({ status: 413 });
    await expect(readBody(req([], { "content-length": "not-a-number" }), 64))
      .rejects.toMatchObject({ status: 413 });
  });

  it("refuses chunked streaming overflow without trusting Content-Length", async () => {
    const request = req(['{"one":', '"0123456789"', '}']);
    await expect(readBody(request, 14)).rejects.toMatchObject({ status: 413 });
  });

  it("reports invalid JSON with a stable HTTP 400", async () => {
    await expect(readBody(req(['{"broken"']))).rejects.toMatchObject({ status: 400 });
  });
});
