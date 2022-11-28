# dotenv_cli

[![Deno version](https://deno.land/badge/dotenv_cli/version)](https://deno.land/x/dotenv_cli)
[![NPM version](https://img.shields.io/npm/v/deno_dotenv_cli.svg)](https://www.npmjs.org/package/deno_dotenv_cli)
[![Release](https://gitlab.com/zookatron/dotenv_cli/-/badges/release.svg)](https://gitlab.com/zookatron/dotenv_cli/-/releases/permalink/latest)

## Installing

Deno

```shell
deno install --allow-env --allow-read --allow-write --allow-run https://deno.land/x/dotenv_cli/mod.ts
```

Node

```shell
npm install -g deno_dotenv_cli
```

## Use without installing

Deno

```shell
deno run --allow-env --allow-read --allow-write --allow-run https://deno.land/x/dotenv_cli/mod.ts
```

Node

```shell
npx deno_dotenv_cli
```

## Usage

### Options

```
Usage: dotenv_cli [options] <command>

Options:
  -h, --help               Show this help message and exit.
  -v, --version            Show the version number and exit.
  -f, --file               Specify .env filename. (defaults to "./.env")
```

### Getting environment variables

```shell
$ dotenv get <variable name>
```

This will load the specified variable from the .env file in the current working directory (or the file specified with the --file option) and
output it.

### Setting environment variables

```shell
$ dotenv set <variable name> <variable value>
```

This will create or the specified variable in .env file in the current working directory (or the file specified with the --file option) with
the provided value.

### Run command with environment variables

```shell
$ dotenv run <command>
```

This will load the variables from the .env file in the current working directory (or the file specified with the --file option) and then run
the command with the new set of environment variables.
