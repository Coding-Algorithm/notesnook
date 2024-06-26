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

import Sodium from "@ammarahmed/react-native-sodium";
import { isImage } from "@notesnook/core/dist/utils/filename";
import { Platform } from "react-native";
import RNFetchBlob from "react-native-blob-util";
import DocumentPicker from "react-native-document-picker";
import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary
} from "react-native-image-picker";
import { DatabaseLogger, db } from "../../../common/database";
import filesystem from "../../../common/filesystem";
import { compressToFile } from "../../../common/filesystem/compress";
import AttachImage from "../../../components/dialogs/attach-image-dialog";
import {
  ToastManager,
  eSendEvent,
  presentSheet
} from "../../../services/event-manager";
import PremiumService from "../../../services/premium";
import { useSettingStore } from "../../../stores/use-setting-store";
import { FILE_SIZE_LIMIT, IMAGE_SIZE_LIMIT } from "../../../utils/constants";
import { eCloseSheet } from "../../../utils/events";
import { useTabStore } from "./use-tab-store";
import { editorController, editorState } from "./utils";

const showEncryptionSheet = (file) => {
  presentSheet({
    title: "Encrypting attachment",
    paragraph: `Please wait while we encrypt ${file.name} file for upload`,
    icon: "attachment"
  });
};

const santizeUri = (uri) => {
  uri = decodeURI(uri);
  uri = Platform.OS === "ios" ? uri.replace("file:///", "/") : uri;
  return uri;
};

/**
 * @param {{
 *  noteId: string,
 * tabId: string,
 * type: "image" | "camera" | "file"
 * reupload: boolean
 * hash?: string
 * }} fileOptions
 */
const file = async (fileOptions) => {
  try {
    const options = {
      mode: "import",
      allowMultiSelection: false
    };
    if (Platform.OS === "ios") {
      options.copyTo = "cachesDirectory";
    }
    await db.attachments.generateKey();

    let file;
    try {
      useSettingStore.getState().setAppDidEnterBackgroundForAction(true);
      file = await DocumentPicker.pick(options);
    } catch (e) {
      return;
    }

    file = file[0];

    let uri = Platform.OS === "ios" ? file.fileCopyUri : file.uri;

    if (file.size > FILE_SIZE_LIMIT) {
      ToastManager.show({
        title: "File too large",
        message: "The maximum allowed size per file is 500 MB",
        type: "error"
      });
      return;
    }

    if (file.copyError) {
      ToastManager.show({
        heading: "Failed to open file",
        message: file.copyError,
        type: "error",
        context: "global"
      });
      return;
    }

    console.log("file uri: ", uri);
    uri = Platform.OS === "ios" ? santizeUri(uri) : uri;
    showEncryptionSheet(file);
    const hash = await Sodium.hashFile({
      uri: uri,
      type: "url"
    });
    if (!(await attachFile(uri, hash, file.type, file.name, fileOptions)))
      return;
    if (Platform.OS === "ios") await RNFetchBlob.fs.unlink(uri);

    if (
      useTabStore.getState().getNoteIdForTab(options.tabId) === options.noteId
    ) {
      if (isImage(file.type)) {
        editorController.current?.commands.insertImage(
          {
            hash: hash,
            filename: file.name,
            mime: file.type,
            size: file.size,
            dataurl: await db.attachments.read(hash, "base64"),
            title: file.name
          },
          fileOptions.tabId
        );
      } else {
        editorController.current?.commands.insertAttachment(
          {
            hash: hash,
            filename: file.name,
            mime: file.type,
            size: file.size
          },
          fileOptions.tabId
        );
      }
    }

    setTimeout(() => {
      eSendEvent(eCloseSheet);
    }, 1000);
  } catch (e) {
    ToastManager.show({
      heading: e.message,
      message: "You need internet access to attach a file",
      type: "error",
      context: "global"
    });
    console.log("attachment error: ", e);
  }
};

/**
 * @param {{
 *  noteId: string,
 * tabId: string,
 * type: "image" | "camera" | "file"
 * reupload: boolean
 * hash?: string
 * }} options
 */
const camera = async (options) => {
  try {
    await db.attachments.generateKey();
    useSettingStore.getState().setAppDidEnterBackgroundForAction(true);
    launchCamera(
      {
        includeBase64: true,
        mediaType: "photo"
      },
      (response) => handleImageResponse(response, options)
    );
  } catch (e) {
    ToastManager.show({
      heading: e.message,
      message: "You need internet access to attach a file",
      type: "error",
      context: "global"
    });
    console.log("attachment error:", e);
  }
};

const gallery = async (options) => {
  try {
    await db.attachments.generateKey();
    useSettingStore.getState().setAppDidEnterBackgroundForAction(true);
    launchImageLibrary(
      {
        includeBase64: true,
        mediaType: "photo",
        selectionLimit: 10
      },
      (response) => handleImageResponse(response, options)
    );
  } catch (e) {
    ToastManager.show({
      heading: e.message,
      message: "You need internet access to attach a file",
      type: "error",
      context: "global"
    });
    console.log("attachment error:", e);
  }
};

/**
 *
 * @typedef {{
 *  noteId?: string,
 * tabId?: string,
 * type: "image" | "camera" | "file"
 * reupload: boolean
 * hash?: string
 * context?: string
 * }} ImagePickerOptions
 *
 * @param {{
 *  noteId?: string,
 * tabId?: string,
 * type: "image" | "camera" | "file"
 * reupload: boolean
 * hash?: string
 * context?: string
 * }} options
 * @returns
 */
const pick = async (options) => {
  if (!PremiumService.get()) {
    let user = await db.user.getUser();
    if (editorState().isFocused) {
      editorState().isFocused = true;
    }
    if (user && !PremiumService.get() && !user?.isEmailConfirmed) {
      PremiumService.showVerifyEmailDialog();
    } else {
      PremiumService.sheet();
    }
    return;
  }
  if (options?.type.startsWith("image") || options?.type === "camera") {
    if (options.type.startsWith("image")) {
      gallery(options);
    } else {
      camera(options);
    }
  } else {
    file(options);
  }
};
/**
 *
 * @param {ImagePickerResponse} response
 * @param {ImagePickerOptions} options
 * @returns
 */
const handleImageResponse = async (response, options) => {
  if (
    response.didCancel ||
    response.errorMessage ||
    !response.assets ||
    response.assets?.length === 0
  ) {
    return;
  }

  const result = await AttachImage.present(response);

  if (!result) return;
  const compress = result.compress;

  for (let image of response.assets) {
    const isPng = /(png)/g.test(image.type);
    const isJpeg = /(jpeg|jpg)/g.test(image.type);

    if (compress && (isPng || isJpeg)) {
      image.uri = await compressToFile(
        Platform.OS === "ios" ? "file://" + image.uri : image.uri,
        isPng ? "PNG" : "JPEG"
      );
      const stat = await RNFetchBlob.fs.stat(image.uri.replace("file://", ""));
      image.fileSize = stat.size;
    }

    if (image.fileSize > IMAGE_SIZE_LIMIT) {
      ToastManager.show({
        title: "File too large",
        message: "The maximum allowed size per image is 50 MB",
        type: "error"
      });
      return;
    }
    let b64 = `data:${image.type};base64, ` + image.base64;
    const uri = decodeURI(image.uri);
    const hash = await Sodium.hashFile({
      uri: uri,
      type: "url"
    });

    let fileName = image.originalFileName || image.fileName;
    console.log("attaching file...");
    if (!(await attachFile(uri, hash, image.type, fileName, options))) return;

    if (Platform.OS === "ios") await RNFetchBlob.fs.unlink(uri);
    console.log("attaching image to note...");
    if (
      options.tabId !== undefined &&
      useTabStore.getState().getNoteIdForTab(options.tabId) === options.noteId
    ) {
      console.log("attaching image to note...");
      editorController.current?.commands.insertImage(
        {
          hash: hash,
          mime: image.type,
          title: fileName,
          dataurl: b64,
          size: image.fileSize,
          filename: fileName
        },
        options.tabId
      );
    }
  }
};

/**
 *
 * @param {string} uri
 * @param {string} hash
 * @param {string} type
 * @param {string} filename
 * @param {ImagePickerOptions} options
 * @returns
 */
export async function attachFile(uri, hash, type, filename, options) {
  try {
    let exists = await db.attachments.exists(hash);
    let encryptionInfo;
    if (options?.hash && options.hash !== hash) {
      ToastManager.show({
        heading: "Please select the same file for reuploading",
        message: `Expected hash ${options.hash} but got ${hash}.`,
        type: "error",
        context: "local"
      });
      return false;
    }

    if (!options.reupload && exists) {
      options.reupload = (await filesystem.getUploadedFileSize(hash)) <= 0;
    }

    if (!exists || options?.reupload) {
      let key = await db.attachments.generateKey();
      encryptionInfo = await Sodium.encryptFile(key, {
        uri: uri,
        type: options.type || "url",
        hash: hash
      });
      encryptionInfo.mimeType = type;
      encryptionInfo.filename = filename;
      encryptionInfo.alg = "xcha-stream";
      encryptionInfo.size = encryptionInfo.length;
      encryptionInfo.key = key;
      if (options?.reupload && exists) await db.attachments.reset(hash);
    } else {
      encryptionInfo = { hash: hash };
    }
    await db.attachments.add(encryptionInfo, options.noteId);
    return true;
  } catch (e) {
    DatabaseLogger.error(e);
    if (Platform.OS === "ios") {
      await RNFetchBlob.fs.unlink(uri);
    }
    return false;
  }
}

export default {
  file,
  pick
};
