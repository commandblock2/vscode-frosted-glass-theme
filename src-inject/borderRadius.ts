import config from "./config.json" with { type: "json" };
import fgtSheet from "./vscode-frosted-glass-theme.css" with { type: "css" };

const { borderRadius } = config;

if (borderRadius.menuItem) {
  fgtSheet.insertRule(
    `.monaco-menu-container ul.actions-container > li > a.action-menu-item {
      border-radius: ${borderRadius.menuItem} !important;
    }`
  );
}

if (borderRadius.menu) {
  fgtSheet.insertRule(
    `.monaco-menu-container .monaco-scrollable-element {
      border-radius: ${borderRadius.menu} !important;
    }`
  );
}

if (borderRadius.suggestWidget) {
  fgtSheet.insertRule(
    `.editor-widget.suggest-widget {
      border-radius: ${borderRadius.suggestWidget} !important;
      overflow: hidden;
    }`
  );
}
