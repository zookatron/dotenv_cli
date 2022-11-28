import { main } from "../src/mod.ts";
import esMain from "npm:es-main";

if (esMain(import.meta)) {
  main(Deno.args);
}
