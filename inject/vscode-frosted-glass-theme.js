(function () {
  const useThemeColor = true;
  const opacity = 0.4;

  function applyAlpha(color, alpha) {
    color = color.trim();
    if (color.length < 7) throw new Error("incorrect color format");
    return color.length === 7 ? color + alpha : color.substring(0, 7) + alpha;
  }

  function getStyleSheetList(ownerNode) {
    for (const styleSheetList of document.styleSheets) {
      if (styleSheetList.ownerNode === ownerNode) {
        return styleSheetList;
      }
    }
  }

  let _contributedColorTheme;
  function getContributedColorTheme() {
    return _contributedColorTheme ?? (_contributedColorTheme = document.querySelector("head > style.contributedColorTheme"));
  }

  function setupColor() {
    const colorList = [
      "--vscode-editorHoverWidget-background",
      "--vscode-editorSuggestWidget-background",
      "--vscode-peekViewResult-background",
      "--vscode-quickInput-background",
      "--vscode-menu-background",
      "--vscode-editorWidget-background",
      "--vscode-notifications-background",
      "--vscode-debugToolBar-background",
      "--vscode-editorHoverWidget-statusBarBackground"
    ];
    const monacoWorkbench = document.querySelector("body > .monaco-workbench");
    if (useThemeColor) {
      const alpha = Math.round(opacity * 255).toString(16);
      const monacoWorkbenchCSSRule = getStyleSheetList(getContributedColorTheme()).cssRules;
      const cssVariablesStyle = monacoWorkbenchCSSRule[monacoWorkbenchCSSRule.length - 1].style;
      for (const color of colorList) {
        monacoWorkbench.style
          .setProperty(color, applyAlpha(cssVariablesStyle.getPropertyValue(color), alpha));
      }
    } else {
      for (const color of colorList) {
        monacoWorkbench.style.setProperty(color, "var(--background-color)");
      }
    }
  }

  function observeThemeColorChange() {
    setupColor();
    if (useThemeColor) {
      const observer = new MutationObserver(setupColor);
      observer.observe(getContributedColorTheme(), { characterData: false, attributes: false, childList: true, subtree: false });
    }
  }

  // proxy function of src
  function proxy(src, functionName, before, after) {
    if (!src) return;
    if (src[functionName]._hiddenTag) return;
    const oldFunction = src[functionName];
    src[functionName] = function () {
      if (!(before && before.call(this, ...arguments))) {
        const temp = oldFunction.call(this, ...arguments);
        return after ? after(temp) : temp;
      }
    };
    src[functionName]._hiddenTag = true;
  }

  fixEverything = () => {
    // proxy dom operation on src element
    function proxyDOM(src, parent) {
      src.append = e => {
        parent.appendChild(e);
        // DOM.isAncestor will always return true
        Object.defineProperty(e, "parentNode", {
          get() {
            return src;
          }
        });
        // fix new sub menu
        fixMenu(e);
      };
      src.removeChild = e => parent.removeChild(e);
      src.replaceChild = e => parent.replaceChild(e);
    }

    function fixMenu(menuContainer) {
      function fix(e) {
        const parent = e.querySelector(".monaco-menu");
        if (!parent) return;
        e.querySelectorAll(".actions-container li").forEach(menuItem => {
          // position:absolute will be invalid if drop-filter is set on menu
          // so I just move sub menu below .monaco-menu instead of <ul>	
          proxyDOM(menuItem, parent);
        });
      }
      // if menu has existed, fix it now, otherwise, wait for appendChild
      if (menuContainer.childElementCount <= 0)
        proxy(menuContainer, "appendChild", fix);
      else fix(menuContainer);
    }

    function hasChildWithTagName(e, tagName) {
      for (const child of e.children) {
        if (child.tagName === tagName)
          return true;
      }
      return false;
    }

    // fix top bar menu
    function fixMenuBotton(menu) {
      proxy(menu, "append", fixMenu);
      proxy(menu, "appendChild", fixMenu);
    }
    const menuBar = document.querySelector("#workbench\\.parts\\.titlebar > div > div.titlebar-left > div.menubar");
    const menus = menuBar.querySelectorAll(".menubar-menu-button");
    menus.forEach(fixMenuBotton);
    proxy(menuBar, "append", fixMenuBotton);
    proxy(menuBar, "appendChild", fixMenuBotton);
    proxy(menuBar, "insertBefore", fixMenuBotton);

    // fix context menu which is wrapped into shadow dom
    const oldAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function () {
      const e = oldAttachShadow.call(this, ...arguments);
      proxy(e, "appendChild", (menuContainer) => {
        if (menuContainer.tagName !== "SLOT") {
          if (!hasChildWithTagName(e, "LINK")) {
            // copy style from document into shadowDOM
            for (const child of document.body.children)
              if (child.tagName === "LINK")
                HTMLElement.prototype.appendChild.call(e, child.cloneNode());
          }
          fixMenu(menuContainer);
        }
      });
      return e;
    };

    // fix side bar menu
    const contextView = document.querySelector("body > .monaco-workbench > .context-view");
    proxy(contextView, "appendChild", (e) => {
      if (e.classList.contains("monaco-scrollable-element"))
        fixMenu(e);
    });
  };

  let isFixed = false;
  proxy(document.body, "appendChild", (monacoWorkbench) => {
    function onAppended(e) {
      if (!isFixed
        && monacoWorkbench.firstChild?.className === "monaco-grid-view"
        && monacoWorkbench.lastChild?.className === "context-view") {
        observeThemeColorChange();
        fixEverything();
        isFixed = true;
      }
      return e;
    }
    proxy(monacoWorkbench, "prepend", undefined, onAppended);
    proxy(monacoWorkbench, "appendChild", undefined, onAppended);
  });
})();
