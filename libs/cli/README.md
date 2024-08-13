# A Type-safe and Hackable Command-line Library

Building robust and maintainable command-line interfaces (CLIs) in TypeScript.

## Quick Start

```ts
import { command, option as o, program } from '@why-ts/cli';

(async () => {
  const output = await program({ description: 'Example CLI' })
    .command(
      'say',
      command({ description: 'Prints a message to the console' })
        .option(
          'what',
          o.string({ required: true, description: 'The message to print' })
        )
        .handle(({ args }) => {
          console.log(args.what);
          return 0;
        })
    )
    .run(process.argv.slice(2))
    .catch(() => process.exit(1));

  if (output.kind === 'command')
    console.log(`Result: ${output.result}`);
})();

```

Build and run the script:

```bash
> node index.js say --what="Hello, World!"

Hello, World!
Result: 0
```

```bash
> node index.js --help

Example CLI

Available Commands:

  say     Prints a message to the console   
```

```bash
> node index.js say --help

Prints a message to the console

Required Flags:

  --what     [string]     The message to print   
```



## Commands

Commands are constructed with the `command()` call and added to a Program with a string name.
Command handler is registered by providing a callback to the `.handle()` function.

```ts
import { program, command, option as o } from '@why-ts/cli';
const output = await program()
  .command(
    'ls',
    command().handle(() => console.log('Running list'))
  )
  .run(process.argv.slice(2));
```

Command objects are immutable. Any function that returns a `Command` instance is always a new instance.

```ts
const command1 = command();
const command2 = command1.option('foo', o.string());
const command3 = command2.handle(console.log);
console.log(command1 === command2); // false
console.log(command2 === command3); // false
```

### Command Handler

A command hander is a function that gets invoked when user specifies to run the command
(first entry in the string array passed to `.run()` is the command name).  
The handler function will receive the following arguments:

- `args`: Parsed type-safe args
- `argv`: Raw args passed to `program.run()`
- `logger`: `Logger` instance (see more in the Configuration section below)
- `prompter`: `Prompter` instance (see more in the Configuration section below)

Since Commands are immutable, it is possible redefine/override a handler and invoke the "parent" one.  
This is usually useful for implementing options and logic that are shared by multiple commands.

#### Examples

Basic:

```ts
const command = command().handle({args, argv}) => {
  console.log(args); // typed args
  console.log(argv); // raw argv string array
}
```

Share options and logic between multiple commands:

```ts
const common = command()
  .option('working-directory', o.string())
  .handle({args} => {
    if(args.workingDirectory)
      process.chdir(args.workingDirectory);
});

const foo = common
  .options('foo', o.string())
  .handle(({args}, _super) => {
    await _super(); // change directory logic is implemented in base command
    console.log(args.foo);
  });
```

Note that in the following example, the first handler is shadowed
because it is not explicitly called via the `_super` pattern in the second handler

```ts
command()
  .handle(() => console.log('foo'))
  .handle(() => console.log('bar'));
```

### Command Metadata

Metadata for a command (e.g. description) can be specified in the `command()` constructor call, or overridden via the `.meta()` call

#### Examples

```ts
const c1 = command({ description: 'Foo' });
const c2 = c1.meta({ description: 'Bar' });
const c3 = c1.meta((base) => ({ ...base, description: `${base.description} & Bar` }));
```

## Options (Flags)

Options are are constructed with the `option.<type>()` call and added to a Command with a string name.
The options can be accessed in the handler via the `args` field.

The following types are currently supported:

- `o.string()`: single string option, e.g. `--foo=orange` => `{foo: 'orange'}`
- `o.strings()`: multiple string options, e.g. `--foo=orange --foo=apple`=> `{foo: ['orange', 'apple']}`
- `o.number()`: single number option, e.g. `--foo=42` => `{foo: 42}`
- `o.numbers()`: multiple number options, e.g. `--foo=42 --foo=100`=> `{foo: [42, 100]}`
- `o.boolean()`: boolean option, e.g. `--foo` => `{foo: true}` (The default `Parser` will also interpret `--no-<name>`, i.e. `--no-foo` => `{foo: false}`)
- `o.choice(['orange', 'apple'])`: only allow the specified string values, e.g. `--foo=lemon` will throw an error

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

### Aliases

Option aliases can be specified with an object in the `.option()` function.

```ts
command()
  .option({ name: 'foo', aliases: ['f'] }, o.string())
  .handle(({ args }) => console.log(args)); // type of `args`: {foo?:string}
```

#### Examples

Basic usage

```bash
> ts-node index.ts -f=orange
# {foo: 'orange'}
```

### Mandatory Options

Options can be marked as `required`.  
If user did not specify the option via command line, an error will be thrown.

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.string({ required: true }))
  .option('bar', o.number({ required: true }))
  .option('baz', o.boolean({ required: true }))
  .handle(({ args }) => console.log(args)); // type of `args`: {foo:string, bar:string, baz:boolean}
```

(TODO: auto prompt for missing options if `{required: 'prompt'}`)

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
  .option('foo', o.choice(['apple', 'orange']))
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

### Environment Variables

An option can fallback to an environment variable if not specified via command line

(See "Option Value Flow" section for the order of execution)

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

### Custom Fallback Value

An option can be configured have a fallback.

(See "Option Value Flow" section for the order of execution)

```ts
import { command, option as o } from '@why-ts/cli';
command()
  .option('foo', o.string({ fallback: () => 'orange' }))
  .option('bar', o.number({ fallbaack: () => 42 }))
  .handle(({ args }) => console.log(args));
```

### Custom Validation

While this library provides basic validations on user input (e.g. make sure a number value is provided to a number option),
custom validations can be added over that.

(See "Option Value Flow" section for the order of execution)

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

### Option Value Flow

Here is the order of how an option value is parsed and validated:

1. Parse value from command line
1. If `undefined`, read value from environment variable if `env` name is defined
1. If still `undefined`, invoke `fallback` if defined
1. If still `undefined` and `required`, throw an error
1. Run built-in validation
1. Run custom validation if defined

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

- Represented by the `Parser` interface.
- Controls how shell arguments (string array) are parsed into typed values
- The default implementation is based on the `minimist` package.

### Environment Variable Handling

- Represented by the `Env` interface.
- Controls how environment variables are retrieved and interpreted.
- The default implementation reads values from `process.env`. Then the value is transformed with `parseFloat` for numbers and splitting at comma(`,`) for array values.

### Logging

- Represented by the `Logger` interface.
- Controls how output is logged to screen.
- The default implementation is `console.log` and `console.error`

### Prompt for User Input

- Represented by the `Prompter` interface.
- Controls how input is captured from user.
- The default implementation is based on Node.js `readline` module.

### Help Formatter

Controls how the help text is formatted.

## TODO

- More data types (e.g. Date)
- `--` handling
- Shell completion
- Locale
- Option relationships (is it possible to represent them at type level?)
  - dependencies (y is required if x is defined)
  - validation (takes y into account when validating x)
  - exclusivity (x and y cannot be specified together)
