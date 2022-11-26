import { build, emptyDir } from "https://deno.land/x/dnt@0.32.0/mod.ts";
import { copy } from "https://deno.land/std@0.165.0/fs/mod.ts";

await emptyDir("./npm/build");
await copy("test/data", "./npm/build/esm/test/data", { overwrite: true });
await copy("test/data", "./npm/build/script/test/data", { overwrite: true });

await build({
  entryPoints: [{
    kind: "bin",
    name: "dotenv_cli",
    path: "./npm/mod.ts",
  }],
  outDir: "./npm/build",
  shims: {
    deno: true,
  },
  package: {
    name: "deno_dotenv_cli",
    version: "1.0.2",
    description: "CLI tool for interacting with .env files",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://gitlab.com/zookatron/dotenv_cli.git",
    },
    bugs: {
      url: "https://gitlab.com/zookatron/dotenv_cli/-/issues",
    },
  },
});

await Deno.copyFile("LICENSE", "./npm/build/LICENSE");
await Deno.copyFile("README.md", "./npm/build/README.md");
await Deno.writeTextFile("./npm/build/.npmrc", "access=public\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}");
