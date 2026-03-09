import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { sep, win32, posix } from "node:path";

/**
 * Windows path regression tests for issue #132
 *
 * URL.pathname incorrectly returns paths like /C:/... on Windows,
 * which Node prepends with the current drive creating C:\C:\...
 * fileURLToPath handles this correctly on all platforms.
 */

describe("migration path construction", () => {
  it("should use fileURLToPath instead of URL.pathname", () => {
    // Simulate the old broken pattern for comparison
    const testUrl = new URL("./migrations", import.meta.url);
    const pathnamePath = testUrl.pathname;
    const correctPath = fileURLToPath(testUrl);

    // On Windows, pathname starts with / but fileURLToPath strips it correctly
    // On Unix, both should work but fileURLToPath is canonical
    if (process.platform === "win32") {
      // pathname should start with / on Windows (wrong)
      expect(pathnamePath).toMatch(/^\/[A-Za-z]:\//);
      // fileURLToPath should NOT start with / (correct)
      expect(correctPath).not.toMatch(/^\//);
      expect(correctPath).toMatch(/^[A-Za-z]:\\/);
    }

    // fileURLToPath should always produce a valid platform path
    expect(correctPath).toContain("migrations");
    expect(correctPath).not.toMatch(/^\/[A-Za-z]:\//); // Never doubled drive
  });

  it("should construct migration folder paths consistently", () => {
    const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

    // Should be an absolute path
    expect(migrationsFolder).toBeTruthy();
    expect(migrationsFolder).toContain("migrations");

    // Should use platform separator
    expect(migrationsFolder).toContain(sep);

    // Should not have doubled path separators or drives
    if (process.platform === "win32") {
      expect(migrationsFolder).not.toMatch(/[A-Za-z]:\\[A-Za-z]:\\/); // No C:\C:\
      expect(migrationsFolder).not.toMatch(/^\/[A-Za-z]:\//); // No /C:/
    }
  });

  it("should construct journal path consistently", () => {
    const journalPath = fileURLToPath(
      new URL("./migrations/meta/_journal.json", import.meta.url),
    );

    expect(journalPath).toBeTruthy();
    expect(journalPath).toContain("migrations");
    expect(journalPath).toContain("_journal.json");

    // Should use platform separator
    expect(journalPath).toContain(sep);

    // Should not have path issues
    if (process.platform === "win32") {
      expect(journalPath).not.toMatch(/[A-Za-z]:\\[A-Za-z]:\\/);
      expect(journalPath).not.toMatch(/^\/[A-Za-z]:\//);
    }
  });

  it("should demonstrate pathname vs fileURLToPath difference", () => {
    // This test documents the difference between the two approaches
    const testUrl = new URL("./test-path", import.meta.url);

    const wrongWay = testUrl.pathname;
    const rightWay = fileURLToPath(testUrl);

    // They should differ on Windows
    if (process.platform === "win32") {
      expect(wrongWay).not.toBe(rightWay);
      // pathname uses forward slashes and starts with /
      expect(wrongWay.replace(/\\/g, "/")).toMatch(/^\//);
      // fileURLToPath uses backslashes and proper drive letter
      expect(rightWay).toContain("\\");
    } else {
      // On Unix they might be similar, but fileURLToPath is still correct
      expect(rightWay).not.toMatch(/^file:/);
    }
  });

  it("should handle relative path joins correctly", () => {
    // Verify that combining fileURLToPath with path.join works correctly
    const basePath = fileURLToPath(new URL("./migrations", import.meta.url));
    const { join } = process.platform === "win32" ? win32 : posix;

    const combined = join(basePath, "0000_test.sql");

    expect(combined).toContain("migrations");
    expect(combined).toContain("0000_test.sql");

    if (process.platform === "win32") {
      expect(combined).toMatch(/[A-Za-z]:\\/);
      expect(combined).not.toMatch(/[A-Za-z]:\\[A-Za-z]:\\/);
    }
  });
});
