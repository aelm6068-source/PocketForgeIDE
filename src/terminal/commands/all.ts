// يجمع كل مجموعات الأوامر في جدول واحد (ترتيبها هنا هو ترتيبها في help)

import type { Command } from '../types';
import { COMMANDS as FILE_COMMANDS } from './fileCommands';
import { TEXT_COMMANDS } from './textCommands';

export const ALL_COMMANDS: Record<string, Command> = { ...FILE_COMMANDS, ...TEXT_COMMANDS };