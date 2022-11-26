import { assertEquals } from "https://deno.land/std@0.166.0/testing/asserts.ts";
import { command } from "./mod.ts";
import { assertExits, mockConsole } from "../test/utils.ts";
import * as path from "https://deno.land/std@0.162.0/path/mod.ts";

const testdataDir = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../test/data");

async function testCommand(commandString: string) {
  const parts = [];
  let match;
  let position = "dotenv_cli".length;
  const parseRegex = /^\s+((?<unquoted>[^'" ][^ ]*)|(?<quoted>'[^']*'|"[^"]*"))/;
  while ((match = parseRegex.exec(commandString.slice(position))) != null) {
    position += match[0].length;
    const { unquoted, quoted } = match.groups!;
    parts.push(typeof quoted === "string" ? quoted.slice(1, -1) : unquoted);
  }
  await command().parse(parts);
}

async function assertLog(file: string, commandString: string, log: string, contains = false) {
  await mockConsole(async (console) => {
    await testCommand(`dotenv_cli -f '${testdataDir}/${file}' ${commandString}`);
    contains ? console.assertLogContains(log) : console.assertLog(log);
  });
}

async function assertError(file: string, commandString: string, error: string, contains = false) {
  await mockConsole(async (console) => {
    await assertExits(1, () => testCommand(`dotenv_cli -f '${testdataDir}/${file}' ${commandString}`));
    contains ? console.assertErrorContains(error) : console.assertError(error);
  });
}

async function assertFile(file: string, commandString: string, contents: string) {
  await Deno.writeTextFile(`${testdataDir}/.env.temporary`, await Deno.readTextFile(`${testdataDir}/${file}`));
  await testCommand(`dotenv_cli -f '${testdataDir}/.env.temporary' ${commandString}`);
  assertEquals(await Deno.readTextFile(`${testdataDir}/.env.temporary`), contents);
  await Deno.remove(`${testdataDir}/.env.temporary`);
}

Deno.test("get", async (test) => {
  await test.step("handles missing file", () =>
    assertError(
      ".env.nonexistant",
      "get TEST",
      `Unable to read file "${testdataDir}/.env.nonexistant": `,
      true,
    ));
  await test.step("skips lines with comments", () =>
    assertError(
      ".env.test",
      "get #COMMENT",
      `The variable "#COMMENT" was not found in "${testdataDir}/.env.test"`,
    ));
  await test.step("variables beginning with a number are not parsed", () =>
    assertError(
      ".env.test",
      "get 1INVALID",
      `The variable "1INVALID" was not found in "${testdataDir}/.env.test"`,
    ));
  await test.step("reports non-existant variables", () =>
    assertError(
      ".env.test",
      "get NONEXISTANT",
      `The variable "NONEXISTANT" was not found in "${testdataDir}/.env.test"`,
    ));
  await test.step("parses a basic variable", () => assertLog(".env.test", "get BASIC", "basic"));
  await test.step("skips empty lines", () => assertLog(".env.test", "get AFTER_EMPTY", "empty"));
  await test.step("empty values are empty strings", () => assertLog(".env.test", "get EMPTY_VALUE", ""));
  await test.step("single quotes are escaped", () => assertLog(".env.test", "get QUOTED_SINGLE", "single quoted"));
  await test.step("double quotes are escaped", () => assertLog(".env.test", "get QUOTED_DOUBLE", "double quoted"));
  await test.step("handles empty single quotes", () => assertLog(".env.test", "get EMPTY_SINGLE", ""));
  await test.step("handles empty double quotes", () => assertLog(".env.test", "get EMPTY_DOUBLE", ""));
  await test.step("new lines are expanded in double quotes", () => assertLog(".env.test", "get MULTILINE", "hello\nworld"));
  await test.step("inner quotes are maintained", () => assertLog(".env.test", "get JSON", '{"foo": "bar"}'));
  await test.step("whitespace in single-quoted values is preserved", () => assertLog(".env.test", "get WHITESPACE", "    whitespace   "));
  await test.step("whitespace in double-quoted values is preserved", () =>
    assertLog(".env.test", "get WHITESPACE_DOUBLE", "    whitespace   "));
  await test.step("new lines are escaped in single quotes", () => assertLog(".env.test", "get MULTILINE_SINGLE_QUOTE", "hello\\nworld"));
  await test.step("handles equals inside string", () => assertLog(".env.test", "get EQUALS", "equ==als"));
  await test.step("variables defined with spaces are parsed", () => assertLog(".env.test", "get VAR_WITH_SPACE", "var with space"));
  await test.step("variables defined with ending whitespace are trimmed", () =>
    assertLog(".env.test", "get VAR_WITH_ENDING_WHITESPACE", "value"));
  await test.step("accepts variables containing number", () => assertLog(".env.test", "get V4R_W1TH_NUM8ER5", "var with numbers"));
  await test.step("accepts variables that are indented with space", () => assertLog(".env.test", "get INDENTED_VAR", "indented var"));
  await test.step("accepts values that are indented with space", () => assertLog(".env.test", "get INDENTED_VALUE", "indented value"));
  await test.step("accepts variables that are indented with tabs", () => assertLog(".env.test", "get TAB_INDENTED_VAR", "indented var"));
  await test.step("accepts values that are indented with tabs", () => assertLog(".env.test", "get TAB_INDENTED_VALUE", "indented value"));
  await test.step("private key single quoted", () =>
    assertLog(
      ".env.test",
      "get PRIVATE_KEY_SINGLE_QUOTED",
      "-----BEGIN RSA PRIVATE KEY-----\n...\nHkVN9...\n...\n-----END DSA PRIVATE KEY-----",
    ));
  await test.step("private key double quoted", () =>
    assertLog(
      ".env.test",
      "get PRIVATE_KEY_DOUBLE_QUOTED",
      "-----BEGIN RSA PRIVATE KEY-----\n...\nHkVN9...\n...\n-----END DSA PRIVATE KEY-----",
    ));
  await test.step("export at the start of the key is ignored", () => assertLog(".env.test", "get EXPORT_IS_IGNORED", "export is ignored"));
  await test.step("unquoted value with a simple comment", () => assertLog(".env.comments", "get FOO", "bar"));
  await test.step("double quoted value with a simple comment", () => assertLog(".env.comments", "get GREETING", "hello world"));
  await test.step("unquoted value with special characters in comment", () =>
    assertLog(".env.comments", "get SPECIAL_CHARACTERS_UNQUOTED", "123"));
  await test.step("unquoted value with special characters in comment which is right after value", () =>
    assertLog(".env.comments", "get SPECIAL_CHARACTERS_UNQUOTED_NO_SPACES", "123"));
  await test.step("variable is escaped not expanded", () => assertLog(".env.expand.test", "get EXPAND_ESCAPED", "\\$THE_ANSWER"));
  await test.step("variable is expanded", () => assertLog(".env.expand.test", "get EXPAND_VAR", "42"));
  await test.step("two variables are expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_TWO_VARS", "single quoted!==double quoted"));
  await test.step("recursive variables expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_RECURSIVE", "single quoted!==double quoted"));
  await test.step("default expanded", () => assertLog(".env.expand.test", "get EXPAND_DEFAULT_TRUE", "default"));
  await test.step("default not expanded", () => assertLog(".env.expand.test", "get EXPAND_DEFAULT_FALSE", "42"));
  await test.step("default var expanded", () => assertLog(".env.expand.test", "get EXPAND_DEFAULT_VAR", "42"));
  await test.step("default recursive var expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_DEFAULT_VAR_RECURSIVE", "single quoted!==double quoted"));
  await test.step("default variable's default value is used", () =>
    assertLog(".env.expand.test", "get EXPAND_DEFAULT_VAR_DEFAULT", "default"));
  await test.step("default with special characters expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_DEFAULT_WITH_SPECIAL_CHARACTERS", "/default/path"));
  await test.step("variable in brackets is expanded", () => assertLog(".env.expand.test", "get EXPAND_VAR_IN_BRACKETS", "42"));
  await test.step("two variables in brackets are expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_TWO_VARS_IN_BRACKETS", "single quoted!==double quoted"));
  await test.step("recursive variables in brackets expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_RECURSIVE_VAR_IN_BRACKETS", "single quoted!==double quoted"));
  await test.step("default in brackets expanded", () => assertLog(".env.expand.test", "get EXPAND_DEFAULT_IN_BRACKETS_TRUE", "default"));
  await test.step("default in brackets not expanded", () => assertLog(".env.expand.test", "get EXPAND_DEFAULT_IN_BRACKETS_FALSE", "42"));
  await test.step("default var in brackets expanded", () => assertLog(".env.expand.test", "get EXPAND_DEFAULT_VAR_IN_BRACKETS", "42"));
  await test.step("default recursive var in brackets expanded", () =>
    assertLog(
      ".env.expand.test",
      "get EXPAND_DEFAULT_VAR_IN_BRACKETS_RECURSIVE",
      "single quoted!==double quoted",
    ));
  await test.step("default variable's default value in brackets is used", () =>
    assertLog(".env.expand.test", "get EXPAND_DEFAULT_VAR_IN_BRACKETS_DEFAULT", "default"));
  await test.step("default in brackets with special characters expanded", () =>
    assertLog(
      ".env.expand.test",
      "get EXPAND_DEFAULT_IN_BRACKETS_WITH_SPECIAL_CHARACTERS",
      "/default/path",
    ));
  await test.step("variables within and without brackets expanded", () =>
    assertLog(".env.expand.test", "get EXPAND_WITH_DIFFERENT_STYLES", "single quoted!==double quoted"));
});

Deno.test("set", async (test) => {
  await test.step("does not allow #", () =>
    assertError(
      ".env.temporary",
      "set #COMMENT comment",
      'The variable name "#COMMENT" contains invalid characters',
    ));
  await test.step("properly encodes basic variable", () => assertFile(".env.empty", "set BASIC basic", "\nBASIC=basic\n"));
  await test.step("properly encodes single quote variable", () =>
    assertFile(".env.empty", "set QUOTED_SINGLE 'single quoted'", "\nQUOTED_SINGLE='single quoted'\n"));
  await test.step("properly encodes multiline variable", () =>
    assertFile(".env.empty", "set MULTILINE 'hello\nworld'", '\nMULTILINE="hello\\nworld"\n'));
  await test.step("properly encodes whitespace variable", () =>
    assertFile(".env.empty", "set WHITESPACE '    whitespace   '", "\nWHITESPACE='    whitespace   '\n"));
  await test.step("properly encodes equals variable", () => assertFile(".env.empty", "set EQUALS equ==als", "\nEQUALS='equ==als'\n"));
  await test.step("properly encodes numbe variabler", () => assertFile(".env.empty", "set THE_ANSWER 42", "\nTHE_ANSWER=42\n"));
  await test.step("properly encodes empty variable", () => assertFile(".env.empty", "set EMPTY ''", "\nEMPTY=\n"));
  await test.step("inner single quotes should be maintained", () =>
    assertFile(".env.empty", "set VARIABLE \"value'single'quotes\"", "\nVARIABLE='value\\'single\\'quotes'\n"));
  await test.step("inner double quotes should be maintained", () =>
    assertFile(".env.empty", 'set VARIABLE \'{"foo": "bar"}\'', '\nVARIABLE=\'{"foo": "bar"}\'\n'));
  await test.step("preserves other lines without comment", async () =>
    await assertFile(".env.preserve.before", "set TEST3 'my new value'", await Deno.readTextFile(`${testdataDir}/.env.preserve.after`)));
  await test.step("preserves other lines with comment", async () =>
    await assertFile(
      ".env.preserve.before",
      "set TEST2 'my new value'",
      await Deno.readTextFile(`${testdataDir}/.env.preserve.after.comment`),
    ));
});

Deno.test("run", async (test) => {
  await test.step("handles missing file", () =>
    assertError(
      ".env.nonexistant",
      "run ls",
      `Unable to read file "${testdataDir}/.env.nonexistant": `,
      true,
    ));
  await test.step("basic", async () => {
    await assertExits(
      2,
      () => testCommand(`dotenv_cli -f '${testdataDir}/.env.test' run sh -c 'if [ "$BASIC" = "basic" ]; then exit 2; else exit 1; fi'`),
    );
  });
});
