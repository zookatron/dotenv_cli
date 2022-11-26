import { command } from "../src/mod.ts";
import esMain from "npm:es-main";

if (esMain(import.meta)) {
  command().parse(Deno.args);
}
