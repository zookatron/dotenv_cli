import { command } from "./src/mod.ts";

if (import.meta.main) {
  command().parse(Deno.args);
}
