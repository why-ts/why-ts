# A Type-safe and Hackable Command-line Library

Building robust and maintainable command-line interfaces (CLIs) in TypeScript.

## Commands

Commands are constructed with the `command()` call and added to a Program with a string name.

```ts
import { program, command, option as o } from '@why-ts/cli';
const output = await program()
  .command(
    'ls',
    command().handle(() => console.log('Running list'))
  )
  .run(process.argv.slice(2));
```

## Options (Flags)

options are are constructed with the `option.<type>()` call and added to a Command with a string name.
The options can be accessed in the handler via the `args` field

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.string())
  .option('bar', o.number())
  .option('baz', o.boolean())
  .handle(({ args }) => console.log(args)); // type of `args`: {foo?:string, bar?:number, baz?:boolean}
```

#### Examples

Basic usage

```bash
> ts-node index.ts --foo=orange --bar=7 --baz
# {foo: 'orange', bar: 7, baz: true}
```

Boolean fields will produce a false value for `0`, `n` & `false` (TODO: allow customisation)

```bash
> ts-node index.ts --baz=false
# {baz: false}
```

Boolean false values can also be specified with the `--no-<name>` option (TODO: allow disabling this feature)

```bash
> ts-node index.ts --no-baz
# {baz: false}
```

### Mandatory Options

Options can be marked as `required`. If user did not specify the option via command line, an error will be thrown.

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.string({ required: true }))
  .option('bar', o.number({ required: true }))
  .option('baz', o.boolean({ required: true }))
  .handle(({ args }) => console.log(args)); // type of `args`: {foo:string, bar:string, baz:boolean}
```

#### Examples

```bash
> ts-node index.ts --bar=7 --baz
# Error: --foo is required
```

### String Choices

Only allow a specified list of strings. When user provides values other than the specified ones, a `UsageError` will be thrown.

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.choices(['apple', 'orange']))
  .handle(({ args }) => console.log(args)); // type of `args`: {foo:'apple'|'orange'}
```

### Multiple Values

Allow user to specify a option more than once. Values are represented as an array at runtime.

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.strings())
  .option('bar', o.numbers())
  .handle(({ args }) => console.log(args)); // type of `args`: {foo?:string[], bar?:string[]}
```

Example:

```bash
> ts-node index.ts --foo=orange --foo=apple --bar=7 --bar=42
# {foo: ['orange', 'apple'], bar: [7, 42]}
```

### Alias

TODO

### Environment Variables

An option can fallback to an environment variable if not specified via command line:

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.string({ env: 'MY_FOO' }))
  .option('bar', o.number({ env: 'MY_BAR' }))
  .handle(({ args }) => console.log(args));
```

By default, enviroment variables will be read from `process.env` and basic transformation is applied.
Provide a custom `Env` implementation to customize the behavior. (See more in Configuration section)

#### Examples

Basic

```bash
> MY_FOO=apple MY_BAR=42 ts-node index.ts
# {foo: 'apple', bar: 42}
```

### Custom Validation

While this library provides basic validations on user input (e.g. make sure a number value is provided to a number option),
custom validations can be added over that.

```ts
import { command, option as o } from '@why-ts/cli';
command()
  // the validate function supports other return types for more control including
  // custom error message and value transformation, see inline code documentation
  .option('bar', o.number({ validate: (v) => v > 10 }))
  .handle(({ args }) => console.log(args));
```

#### Examples

Basic

```bash
> ts-node index.ts --bar=5
# Error: --bar is invalid
```

## Runtime Configuration

There are various runtime configurations to customise program behaviour.
Specific configurable functionality is listed in the following sub-sections.
They can be provided/overridden at multiple places, listed below with lower-priority first:

At Program definition:

```ts
program({logger: ...})
```

At Command definition:

```ts
command({logger: ...})
```

At execution:

```ts
program().run(argv, {logger:...})
```

If none is provided anywhere, it will fallback to an internal default.

### Argument Parsing

Represented by the `Parser` interface.
Controls how shell arguments (string array) are parsed into typed values
The default implementation is based on the `minimist` package.

### Environment Variable Handling

Represented by the `Env` interface.
Controls how environment variables are retrieved and interpreted.
The default implementation reads values from `process.env`.
Then the value is transformed with `parseFloat` for numbers and splitting at comma(`,`) for array values.

### Logging

Represented by the `Logger` interface.
Controls how output is logged to screen.
The default implementation is `console.log` and `console.error`

### Prompt for User Input

Represented by the `Prompter` interface.
Controls how input is captured from user.
The default implementation is based on Node.js `readline` module.

### Help Formatter

Controls how the help text is formatted.
