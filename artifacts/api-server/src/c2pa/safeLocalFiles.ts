// SPDX-License-Identifier: AGPL-3.0-only
// Same-handle bounded local file I/O for the public CLI. No path is echoed.

import { randomBytes } from "node:crypto";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLocaleLowerCase("en-US") === path.resolve(right).toLocaleLowerCase("en-US");
}

export async function readRegularFileBounded(filePath: string, maxBytes: number): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("input_size_out_of_bounds");
  const before = await lstat(filePath);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
    throw new Error("input_must_be_regular_unlinked_file");
  }
  const handle = await open(filePath, "r");
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error("input_changed_during_open");
    }
    if (!Number.isSafeInteger(opened.size) || opened.size <= 0 || opened.size > maxBytes) {
      throw new Error("input_size_out_of_bounds");
    }
    const output = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < output.length) {
      const { bytesRead } = await handle.read(output, offset, output.length - offset, offset);
      if (bytesRead <= 0) throw new Error("input_changed_during_read");
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size) {
      throw new Error("input_changed_during_read");
    }
    return output;
  } finally {
    await handle.close();
  }
}

export async function atomicWriteNewFile(
  filePath: string,
  content: string | Uint8Array,
): Promise<void> {
  const target = path.resolve(filePath);
  const parent = path.dirname(target);
  const parentBefore = await lstat(parent);
  if (!parentBefore.isDirectory() || parentBefore.isSymbolicLink()) throw new Error("output_parent_invalid");
  const realParent = await realpath(parent);
  if (!samePath(parent, realParent)) throw new Error("output_parent_invalid");

  const temp = path.join(realParent, `.tancmark-${process.pid}-${randomBytes(12).toString("hex")}.tmp`);
  const handle = await open(temp, "wx", 0o600);
  let linked = false;
  try {
    await handle.writeFile(content);
    await handle.sync();
    const parentAfter = await lstat(parent);
    if (!parentAfter.isDirectory() || parentAfter.isSymbolicLink()
      || parentAfter.dev !== parentBefore.dev || parentAfter.ino !== parentBefore.ino
      || !samePath(await realpath(parent), realParent)) {
      throw new Error("output_parent_changed");
    }
    await link(temp, target);
    linked = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("output_already_exists");
    throw error;
  } finally {
    await handle.close();
    try { await unlink(temp); } catch (error) {
      if (!linked && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
