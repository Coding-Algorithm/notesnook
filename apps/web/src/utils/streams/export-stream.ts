/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { ExportableItem } from "@notesnook/common";
import { db } from "../../common/db";
import { showToast } from "../toast";
import { ZipFile } from "./zip-stream";
import { lazify } from "../lazify";

export class ExportStream extends TransformStream<
  ExportableItem | Error,
  ZipFile
> {
  constructor(report: (progress: { text: string; current?: number }) => void) {
    let progress = 0;
    super({
      async transform(item, controller) {
        if (item instanceof Error) {
          showToast("error", item.message);
          return;
        }
        if (item.type === "attachment") {
          report({ text: `Downloading attachment: ${item.path}` });
          await db
            .fs()
            .downloadFile("exports", item.data.hash, item.data.chunkSize);
          const key = await db.attachments.decryptKey(item.data.key);
          if (!key) return;
          const stream = await lazify(
            import("../../interfaces/fs"),
            ({ streamingDecryptFile }) =>
              streamingDecryptFile(item.data.hash, {
                key,
                iv: item.data.iv,
                name: item.data.filename,
                type: item.data.mimeType,
                isUploaded: !!item.data.dateUploaded
              })
          );
          if (!stream) return;
          controller.enqueue({ ...item, data: stream });
          report({
            current: progress++,
            text: `Saving attachment: ${item.path}`
          });
        } else {
          controller.enqueue(item);
          report({
            current: progress++,
            text: `Exporting note: ${item.path}`
          });
        }
      }
    });
  }
}
