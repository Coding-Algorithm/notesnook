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

/* eslint-disable @typescript-eslint/no-var-requires */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef
} from "react";
import { Platform, ViewStyle } from "react-native";
import WebView from "react-native-webview";
import { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { notesnook } from "../../../e2e/test.ids";
import { db } from "../../common/database";
import BiometicService from "../../services/biometrics";
import {
  ToastManager,
  eSendEvent,
  eSubscribeEvent
} from "../../services/event-manager";
import {
  eOnLoadNote,
  eUnlockNote,
  eUnlockWithBiometrics,
  eUnlockWithPassword
} from "../../utils/events";
import { openLinkInBrowser } from "../../utils/functions";
import EditorOverlay from "./loading";
import { EDITOR_URI } from "./source";
import { EditorProps, useEditorType } from "./tiptap/types";
import { useEditor } from "./tiptap/use-editor";
import { useEditorEvents } from "./tiptap/use-editor-events";
import { syncTabs, useTabStore } from "./tiptap/use-tab-store";
import { editorController, editorState } from "./tiptap/utils";

const style: ViewStyle = {
  height: "100%",
  maxHeight: "100%",
  width: "100%",
  alignSelf: "center",
  backgroundColor: "transparent"
};
const onShouldStartLoadWithRequest = (request: ShouldStartLoadRequest) => {
  if (request.url.includes("https")) {
    if (Platform.OS === "ios" && !request.isTopFrame) return true;
    openLinkInBrowser(request.url);
    return false;
  } else {
    return true;
  }
};

const Editor = React.memo(
  forwardRef<
    {
      get: () => useEditorType;
    },
    EditorProps
  >(
    (
      {
        readonly = false,
        noToolbar = false,
        noHeader = false,
        withController = true,
        editorId = "",
        onLoad,
        onChange
      },
      ref
    ) => {
      const editor = useEditor(editorId || "", readonly, onChange);
      const onMessage = useEditorEvents(editor, {
        readonly,
        noToolbar,
        noHeader
      });
      const renderKey = useRef(`editor-0` + editorId);
      useImperativeHandle(ref, () => ({
        get: () => editor
      }));
      useLockedNoteHandler();

      const onError = useCallback(() => {
        renderKey.current =
          renderKey.current === `editor-0`
            ? `editor-1` + editorId
            : `editor-0` + editorId;

        editor.state.current.ready = false;
        editor.setLoading(true);
      }, [editor, editorId]);

      useEffect(() => {
        const sub = [eSubscribeEvent("webview_reset", onError)];
        return () => {
          sub.forEach((s) => s?.unsubscribe());
        };
      }, [onError]);

      useLayoutEffect(() => {
        setImmediate(() => {
          onLoad && onLoad();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [onLoad]);

      if (withController) {
        editorController.current = editor;
      }

      return editor.loading ? null : (
        <>
          <WebView
            testID={notesnook.editor.id}
            ref={editor.ref}
            key={renderKey.current}
            onRenderProcessGone={onError}
            nestedScrollEnabled
            onError={onError}
            injectedJavaScriptBeforeContentLoaded={`
          globalThis.readonly=${readonly};
          globalThis.noToolbar=${noToolbar};
          globalThis.noHeader=${noHeader};
          `}
            useSharedProcessPool={false}
            javaScriptEnabled={true}
            focusable={true}
            onContentProcessDidTerminate={onError}
            setSupportMultipleWindows={false}
            overScrollMode="never"
            scrollEnabled={false}
            keyboardDisplayRequiresUserAction={false}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            cacheMode="LOAD_DEFAULT"
            cacheEnabled={true}
            domStorageEnabled={true}
            bounces={false}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            allowFileAccess={true}
            scalesPageToFit={true}
            hideKeyboardAccessoryView={false}
            allowsFullscreenVideo={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            originWhitelist={["*"]}
            source={{
              uri: EDITOR_URI
            }}
            style={style}
            autoManageStatusBarEnabled={false}
            onMessage={onMessage || undefined}
          />
          <EditorOverlay editor={editor} editorId={editorId} />
        </>
      );
    }
  ),
  () => true
);

export default Editor;

const useLockedNoteHandler = () => {
  const tab = useTabStore((state) => state.getTab(state.currentTab));
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    for (const tab of useTabStore.getState().tabs) {
      const noteId = useTabStore.getState().getTab(tab.id)?.noteId;
      if (!noteId) continue;
      if (tabRef.current && tabRef.current.noteLocked) {
        useTabStore.getState().updateTab(tabRef.current.id, {
          locked: true
        });
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const biometry = await BiometicService.isBiometryAvailable();
      const fingerprint = await BiometicService.hasInternetCredentials();
      useTabStore.setState({
        biometryAvailable: !!biometry,
        biometryEnrolled: !!fingerprint
      });
      syncTabs();
    })();
  }, [tab?.id]);

  useEffect(() => {
    const unlockWithBiometrics = async () => {
      try {
        if (!tabRef.current?.noteLocked || !tabRef.current) return;
        console.log("Trying to unlock with biometrics...");
        const credentials = await BiometicService.getCredentials(
          "Unlock note",
          "Unlock note to open it in editor. If biometrics are not working, you can enter device pin to unlock vault."
        );

        if (credentials && credentials?.password && tabRef.current.noteId) {
          const note = await db.vault.open(
            tabRef.current.noteId,
            credentials?.password
          );
          eSendEvent(eOnLoadNote, {
            item: note
          });

          useTabStore.getState().updateTab(tabRef.current.id, {
            locked: false
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    const onSubmit = async ({
      password,
      biometrics: enrollBiometrics
    }: {
      password: string;
      biometrics?: boolean;
    }) => {
      if (!tabRef.current?.noteId || !tabRef.current) return;
      if (!password || password.trim().length === 0) {
        ToastManager.show({
          heading: "Password not entered",
          message: "Enter a password for the vault and try again.",
          type: "error"
        });
        return;
      }

      try {
        const note = await db.vault.open(tabRef.current?.noteId, password);
        if (enrollBiometrics && note) {
          try {
            const unlocked = await db.vault.unlock(password);
            if (!unlocked) throw new Error("Incorrect vault password");
            await BiometicService.storeCredentials(password);
            eSendEvent("vaultUpdated");
            ToastManager.show({
              heading: "Biometric unlocking enabled!",
              message: "Now you can unlock notes in vault with biometrics.",
              type: "success",
              context: "global"
            });

            const biometry = await BiometicService.isBiometryAvailable();
            const fingerprint = await BiometicService.hasInternetCredentials();
            useTabStore.setState({
              biometryAvailable: !!biometry,
              biometryEnrolled: !!fingerprint
            });
            syncTabs();
          } catch (e) {
            ToastManager.show({
              heading: "Incorrect password",
              message:
                "Please enter the correct vault password to enable biometrics.",
              type: "error"
            });
          }
        }
        eSendEvent(eOnLoadNote, {
          item: note
        });
        useTabStore.getState().updateTab(tabRef.current.id, {
          locked: false
        });
      } catch (e) {
        console.log(e);
        ToastManager.show({
          heading: "Incorrect password",
          type: "error"
        });
      }
    };

    const unlock = () => {
      if (
        (tabRef.current?.locked,
        useTabStore.getState().biometryAvailable &&
          useTabStore.getState().biometryEnrolled &&
          !editorState().movedAway)
      ) {
        setTimeout(() => {
          unlockWithBiometrics();
        }, 150);
      } else {
        console.log("Biometrics unavailable.", editorState().movedAway);
        if (!editorState().movedAway) {
          setTimeout(() => {
            if (tabRef.current && tabRef.current?.locked) {
              editorController.current?.commands.focus(tabRef.current?.id);
            }
          }, 100);
        }
      }
    };

    const subs = [
      eSubscribeEvent(eUnlockNote, unlock),
      eSubscribeEvent(eUnlockWithBiometrics, () => {
        unlock();
      }),
      eSubscribeEvent(eUnlockWithPassword, onSubmit)
    ];
    if (tabRef.current?.locked) {
      unlock();
    }
    return () => {
      subs.map((s) => s?.unsubscribe());
    };
  }, [tab?.id, tab?.locked]);

  return null;
};
