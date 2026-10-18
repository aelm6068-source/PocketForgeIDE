// صفحة HTML المخفية اللي بتشغّل ملفات node على الجهاز (داخل WebView معزول)
import { RUNNER_PART_1 } from './jsRunnerPart1';
import { RUNNER_PART_2 } from './jsRunnerPart2';
import { RUNNER_PART_3 } from './jsRunnerPart3';

export const JS_RUNNER_HTML =
  '<!doctype html><html><head><meta charset="utf-8"></head><body><script>(function(){\'use strict\';\n' +
  RUNNER_PART_1 +
  '\n' +
  RUNNER_PART_2 +
  '\n' +
  RUNNER_PART_3 +
  '\n})();</script></body></html>';