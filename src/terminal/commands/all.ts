// يجمع كل مجموعات الأوامر في جدول واحد (ترتيبها هنا هو ترتيبها في help)

import type { Command } from '../types';
import { COMMANDS as FILE_COMMANDS } from './fileCommands';
import { TEXT_COMMANDS } from './textCommands';
import { NET_COMMANDS } from './netCommands';
import { NODE_COMMANDS } from './nodeCommands';

export const ALL_COMMANDS: Record<string, Command> = { ...FILE_COMMANDS, ...TEXT_COMMANDS, ...NET_COMMANDS, ...NODE_COMMANDS };