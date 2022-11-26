import { Command } from "https://deno.land/x/cliffy@v0.25.4/command/mod.ts";
import { parse } from "https://deno.land/std@0.166.0/dotenv/mod.ts";

/**
 * @param {string} filename the filename of the dotenv file
 * @param {string} name the name of the environment variable to extract
 */
async function get(filename: string, name: string) {
  let file;
  try {
    file = await Deno.readTextFile(filename);
  } catch (error) {
    console.error(`Unable to read file "${filename}": ${error.message}`);
    Deno.exit(1);
  }
  const variables = parse(file);
  if (!(name in variables)) {
    console.error(`The variable "${name}" was not found in "${filename}"`);
    Deno.exit(1);
  }
  console.log(variables[name]);
}

/**
 * @param {string} value environment value to be encoded
 * @returns {string} encoded environment variable
 */
function encode(value: string) {
  let quote;
  let escapedValue = value;

  // Logic is based on the `stringify` function from https://deno.land/std@0.166.0/dotenv/mod.ts
  if (escapedValue.includes("\n")) {
    // escape inner new lines
    escapedValue = escapedValue.replaceAll("\n", "\\n");
    quote = `"`;
  } else if (escapedValue.match(/\W/)) {
    quote = "'";
  }
  if (quote) {
    // escape inner quotes
    escapedValue = escapedValue.replaceAll(quote, `\\${quote}`);
    escapedValue = `${quote}${escapedValue}${quote}`;
  }

  return escapedValue;
}

/**
 * @param {string} filename the filename of the dotenv file
 * @param {string} name the name of the environment variable to extract
 * @param {string} value the value of the environment variable to extract
 */
async function set(filename: string, name: string, value: string) {
  if (name.includes("#")) {
    console.error(`The variable name "${name}" contains invalid characters`);
    Deno.exit(1);
  }
  const newLine = `${name}=${encode(value)}`;
  let file;
  try {
    file = await Deno.readTextFile(filename);
  } catch (error) {
    if (error.code === "ENOENT") {
      file = "";
    } else {
      console.error(`Unable to read file "${filename}": ${error.message}`);
      Deno.exit(1);
    }
  }
  let match;
  let progress = 0;
  let found = false;
  let newFile = "";

  // Logic is based on the `parse` function from https://deno.land/std@0.166.0/dotenv/mod.ts
  const parseRegex =
    /^(?<prefix>\s*)(?:export\s+)?(?<key>[a-zA-Z_]+[a-zA-Z0-9_]*?)\s*=[\ \t]*('\n?(?<notInterpolated>(.|\n)*?)\n?'|"\n?(?<interpolated>(.|\n)*?)\n?"|(?<unquoted>[^\n#]*))(?<postfix> *#*.*)$/gm;
  while ((match = parseRegex.exec(file)) != null) {
    const [matchText] = match;
    const { prefix, postfix, key, unquoted } = match.groups!;
    newFile += file.slice(progress, match.index);
    progress = match.index + matchText.length;
    if (key === name) {
      const unquotedPostfix = /(?<postfix>\s+)$/.exec(unquoted || "")?.groups!.postfix || "";
      newFile += `${prefix}${newLine}${unquotedPostfix}${postfix}`;
      found = true;
      break;
    } else {
      newFile += matchText;
    }
  }
  newFile += file.slice(progress);
  if (!found) {
    newFile += `\n${newLine}\n`;
  }

  try {
    await Deno.writeTextFile(filename, newFile);
  } catch (error) {
    console.error(`Unable to write file "${filename}": ${error.message}`);
    Deno.exit(1);
  }
}

/**
 * @param {string} filename the filename of the dotenv file
 * @param {string[]} command the parts of the command to run
 */
async function run(filename: string, command: string[]) {
  let file;
  try {
    file = await Deno.readTextFile(filename);
  } catch (error) {
    console.error(`Unable to read file "${filename}": ${error.message}`);
    Deno.exit(1);
  }
  const variables = parse(file);
  const process = Deno.run({ cmd: command, env: variables });
  const status = await process.status();
  process.close();
  Deno.exit(status.code);
}

export function command() {
  // deno-lint-ignore prefer-const
  let helper: { showHelp: () => void };
  const result = new Command()
    .name("dotenv_cli")
    .version("1.0.0")
    .description("CLI tool for interacting with .env files")
    .globalOption("-f, --file <filename:file>", "Specify the path of the .env file.", { default: "./.env" })
    .action(() => helper.showHelp())
    .command("get", "Get an environment variable")
    .arguments("<name>")
    .action((options, name) => get(options.file, name))
    .command("set", "Set an environment variable")
    .arguments("<name> <value>")
    .action((options, name, value) => set(options.file, name, value))
    .command("run", "Run a command with environment variables")
    .arguments("<command> [...args]")
    .stopEarly()
    .action((options, subcommand, ...args) => run(options.file, [subcommand].concat(args)));
  helper = result;
  return result;
}
