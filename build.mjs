import * as esbuild from "esbuild";
import fs from "fs/promises";
import { generateLicenseFile } from "generate-license-file";
import { parseLiterals } from "parse-literals";
import path from "path";

const taskList = [];

taskList.push(
  mergeConfiguration(
    "src-inject/config.schema.json",
    "src-inject/config.json",
    "frosted-glass-theme."
  )
);
taskList.push(mergeLicense());

const common = {
  bundle: true,
  platform: "node",
  target: ["node18"],
  logLevel: "silent",
  minify: true,
  legalComments: "none",
  sourcemap: true,
  plugins: [minifyLiteralsPlugin(["css"])],
};

const buildExtensionOptions = {
  ...common,
  external: ["vscode"],
  entryPoints: ["src/extension.ts"],
  outfile: "out/extension.js",
};
if (process.argv.includes("watch")) {
  const ctx = await esbuild.context({
    ...buildExtensionOptions,
    logLevel: "info",
  });
  await ctx.watch();
  console.log("watching...");
} else build(buildExtensionOptions);

taskList.push(
  build({
    ...common,
    entryPoints: ["src/InjectionAdminMain.ts"],
    outfile: "out/InjectionAdminMain.js",
  })
);

taskList.push(
  build({
    ...common,
    platform: "browser",
    external: ["vs/base/browser/dompurify/dompurify"],
    target: ["esnext"],
    format: "esm",
    loader: { ".css": "copy", ".json": "copy" },
    assetNames: "[name]",
    entryPoints: ["src-inject/main.ts"],
    outfile: "inject/vscode-frosted-glass-theme.js",
  })
);

taskList.push(
  fs
    .copyFile("src-inject/config.schema.json", "inject/config.schema.json")
    .then(() => "inject/config.schema.json")
);

for (const builtFile of await Promise.all(taskList)) {
  console.log(builtFile);
  console.log("\u001b[32mDone\u001b[0m\n");
}

async function mergeConfiguration(schemaFile, defaultFile, prefix) {
  const schema = JSON.parse(await fs.readFile(schemaFile));
  const defaultValue = JSON.parse(await fs.readFile(defaultFile));
  const packageJson = JSON.parse(await fs.readFile("package.json"));

  const configuration = [{ title: "General", properties: {} }];
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.type == "object" && prop.properties) {
      const title = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, s => s.toUpperCase());
      const newEntries = Object.entries(prop.properties).map(
        ([key2, prop2]) => [
          prefix + key + "." + key2,
          { ...prop2, default: defaultValue[key][key2] },
        ]
      );
      configuration.push({
        title,
        properties: Object.fromEntries(newEntries),
      });
    } else
      configuration[0].properties[prefix + key] = {
        ...prop,
        default: defaultValue[key],
      };
  }
  packageJson.contributes.configuration = configuration;

  await fs.writeFile("package.json", JSON.stringify(packageJson, null, 2));
  return "package.json";
}

function minifyLiteralsPlugin(tags) {
  return {
    name: "minifyLiteralsPlugin",
    setup(build) {
      const cache = new Map();
      build.onLoad({ filter: /\.[jt]s$/ }, async ({ path }) => {
        const content = await fs.readFile(path, "utf8");
        const value = cache.get(path);
        if (value && value.content === content) return value.output;
        let result = "";
        let index = 0;
        for (const literal of parseLiterals(content)) {
          if (tags.includes(literal.tag)) {
            for (const part of literal.parts) {
              result += content.substring(index, part.start);
              result += part.text.replace(/\s+/gm, " ");
              index = part.end;
            }
          }
        }
        result += content.substring(index);
        const output = {
          contents: result,
          loader: path.endsWith(".ts") ? "ts" : "js",
        };
        cache.set(path, { content, output });
        return output;
      });
    },
  };
}

async function build(options) {
  const result = await esbuild.build(options);
  if (result.warnings.length == 0 && result.errors.length == 0)
    return options.outfile;
  else {
    throw (
      options.outfile +
      "\n" +
      esbuild
        .formatMessagesSync(result.warnings, {
          kind: "warning",
          color: true,
        })
        .join("\n") +
      esbuild
        .formatMessagesSync(result.errors, {
          kind: "error",
          color: true,
        })
        .join("\n")
    );
  }
}

async function mergeLicense(outputFile = "3rdPartyLicense.txt") {
  const licensesPath = "./licenses";
  generateLicenseFile("./package.json", outputFile, {
    append: (await fs.readdir(licensesPath)).map(file =>
      path.join(licensesPath, file)
    ),
  });
  return outputFile;
}
