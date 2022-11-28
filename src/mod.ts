import { Command, CompletionsCommand, HelpCommand } from "https://deno.land/x/cliffy@v0.25.4/command/mod.ts";
import { parse } from "https://deno.land/std@0.167.0/dotenv/mod.ts";

/**
 * @param {string} filename The filename of the dotenv file
 * @param {string} name The name of the environment variable to extract
 * @returns {Promise} The get process promise
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
 * @param {string} value Environment value to be encoded
 * @returns {string} encoded environment variable
 */
function encode(value: string) {
  let quote;
  let escapedValue = value;

  // Logic is based on the `stringify` function from https://deno.land/std/dotenv/mod.ts
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
 * @param {string} filename The filename of the dotenv file
 * @param {string} name The name of the environment variable to extract
 * @param {string} value The value of the environment variable to extract
 * @returns {Promise} The set process promise
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

  // Logic is based on the `parse` function from https://deno.land/std/dotenv/mod.ts
  const parseRegex =
    /^(?<prefix>\s*)(?:export\s+)?(?<key>[a-zA-Z_]+[a-zA-Z0-9_]*?)\s*=[\ \t]*('\n?(?<notInterpolated>(\\.|[^']|\n)*?)\n?'|"\n?(?<interpolated>(\\.|[^"]|\n)*?)\n?"|(?<unquoted>[^\n#]*))(?<postfix> *#*.*)$/gm;

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
 * @param {string} filename The filename of the dotenv file
 * @param {string[]} command The parts of the command to run
 * @returns {Promise} The run process promise
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

/**
 * @param {string[]} args The command line arguments
 * @returns {Promise} The main process promise
 */
export function main(args: string[]) {
  return new Command()
    .name("dotenv_cli")
    .version("1.0.3")
    .description("CLI tool for interacting with .env files")
    .globalOption("-f, --file <filename:file>", "Specify the path of the .env file.", { default: "./.env" })
    .default("help")
    .command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand())
    .command("get", "Get an environment variable")
    .arguments("<name>")
    .action((options, name) => get(options.file, name))
    .command("set", "Set an environment variable")
    .arguments("<name> <...value>")
    .stopEarly()
    .action((options, name, ...values) => set(options.file, name, values.join(" ")))
    .command("run", "Run a command with environment variables")
    .arguments("<command> [...args]")
    .stopEarly()
    .action((options, subcommand, ...args) => run(options.file, [subcommand].concat(args)))
    .parse(args);
}
