import { OPTION_VALUE_TYPES, command, option as o } from '@why-ts/cli';
import handler from './handler';

export default command({ description: 'Tests the prompt functionality.' })
  .option('type', o.choice(OPTION_VALUE_TYPES))
  .handle(handler);
