import path from "path";
import { commands, ExtensionContext, window, workspace } from "vscode";
import File from "./File";
import Injection from "./Injection";
import { msg } from "./msg";
import { showChoiceMessage } from "./Utils";

export function activate(context: ExtensionContext) {
  const cssFile = new File(
    path.resolve(`${__dirname}/../inject/vscode-frosted-glass-theme.css`)
  );
  const jsFile = new File(
    path.resolve(`${__dirname}/../inject/vscode-frosted-glass-theme.js`)
  );
  const injection = new Injection([jsFile]);

  function reloadWindow() {
    commands.executeCommand("workbench.action.reloadWindow");
  }

  function updateConfiguration() {
    jsFile
      .editor()
      .replace(
        /(const config = )[^]*?;/,
        "$1" +
          JSON.stringify(
            workspace.getConfiguration().get("frosted-glass-theme"),
            null,
            2
          ) +
          ";"
      )
      .apply();
  }

  const enableTheme = commands.registerCommand(
    "frosted-glass-theme.enableTheme",
    async () => {
      try {
        updateConfiguration();
        await injection.inject();
        if (await showChoiceMessage(msg.enabled, msg.restartIde))
          reloadWindow();
      } catch (e) {
        console.error(e);
        window.showErrorMessage(msg.somethingWrong + e);
      }
    }
  );

  const disableTheme = commands.registerCommand(
    "frosted-glass-theme.disableTheme",
    async () => {
      try {
        await injection.restore();
        if (await showChoiceMessage(msg.disabled, msg.restartIde))
          reloadWindow();
      } catch (e) {
        console.error(e);
        window.showErrorMessage(msg.somethingWrong + e);
      }
    }
  );

  const applyConfig = commands.registerCommand(
    "frosted-glass-theme.applyConfig",
    async () => {
      try {
        updateConfiguration();
        if (await showChoiceMessage(msg.applied, msg.restartIde))
          reloadWindow();
      } catch (e) {
        console.error(e);
        window.showErrorMessage(msg.somethingWrong + e);
      }
    }
  );

  const openCSS = commands.registerCommand("frosted-glass-theme.openCSS", () =>
    cssFile.openInVSCode()
  );

  let isConfigChangedShowing = false;
  const onConfigureChanged = workspace.onDidChangeConfiguration(async (e) => {
    if (
      !isConfigChangedShowing &&
      e.affectsConfiguration("frosted-glass-theme")
    ) {
      isConfigChangedShowing = true;
      if (await showChoiceMessage(msg.configChanged, msg.applyChanges)) {
        try {
          updateConfiguration();
          window.showInformationMessage(msg.applied);
        } catch (e) {
          console.error(e);
          window.showErrorMessage(msg.somethingWrong + e);
        }
      }
      isConfigChangedShowing = false;
    }
  });

  context.subscriptions.push(
    enableTheme,
    disableTheme,
    applyConfig,
    openCSS,
    onConfigureChanged
  );
}

export function deactivate() {}
