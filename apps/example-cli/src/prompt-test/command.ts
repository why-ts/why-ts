import { command, option as o } from '@why-ts/cli';
import handler, { TYPES } from './handler';

export default command().option('type', o.choice(TYPES)).handle(handler);
