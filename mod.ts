import { main } from "./src/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
