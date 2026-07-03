/** @jest-environment node */
import { logger } from "@/lib/logger";

describe("logger", () => {
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("emits a single JSON line with level, msg, ts", () => {
    logger.info("hello", { a: 1 });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0][0]);
    expect(line.level).toBe("info");
    expect(line.msg).toBe("hello");
    expect(line.a).toBe(1);
    expect(typeof line.ts).toBe("string");
  });

  it("routes warn/error to stderr", () => {
    logger.error("boom");
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("err() serialises an Error into message + stack", () => {
    const fields = logger.err(new Error("nope"));
    expect(fields.error).toBe("nope");
    expect(typeof fields.stack).toBe("string");
  });

  it("err() stringifies non-Error values", () => {
    expect(logger.err("plain").error).toBe("plain");
  });
});
