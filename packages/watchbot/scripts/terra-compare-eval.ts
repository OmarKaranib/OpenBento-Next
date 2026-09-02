/**
 * Operator CLI for the offline Terra compare eval harness.
 *
 *   OPENAI_API_KEY=… pnpm --filter @openbento/watchbot eval:terra-compare
 *
 * Optional: OPENAI_TERRA_EVAL_MODEL or OPENAI_MEANINGFULNESS_MODEL
 * (default gpt-5.6-terra). Never run live OpenAI from CI.
 */

import { runTerraCompareEvalCli } from "../src/terra-compare-eval";

const exitCode = await runTerraCompareEvalCli();
process.exit(exitCode);
