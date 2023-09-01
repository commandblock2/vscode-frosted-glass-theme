import fs = require("fs");
import { Uri, window, workspace } from "vscode";

export interface IFile {
  get path(): string;
}

export default class File implements IFile {
  static editor = class {
    private content: string;

    constructor(private file: File) {
      this.content = fs.readFileSync(file._path, "utf-8");
    }

    replace(
      searchValue: {
        [Symbol.replace](string: string, replaceValue: string): string;
      },
      replaceValue: string
    ) {
      this.content = this.content.replace(searchValue, replaceValue);
      return this;
    }

    apply() {
      fs.writeFileSync(this.file._path, this.content, "utf-8");
    }
  };

  constructor(private _path: string) {}

  editor() {
    return new File.editor(this);
  }

  openInVSCode() {
    workspace.openTextDocument(Uri.parse(this.path)).then((doc) => {
      window.showTextDocument(doc);
    });
  }

  public get path(): string {
    return "file:///" + this._path;
  }
}
