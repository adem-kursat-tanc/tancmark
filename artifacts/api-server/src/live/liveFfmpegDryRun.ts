import {
  buildLiveFfmpegDryRunCommand,
  getLiveFfmpegCommandKinds,
  type LiveFfmpegCommandBuilderInput,
  type LiveFfmpegDryRunCommand,
} from "./liveFfmpegCommandBuilder";
import { getLiveFfmpegExternalCliPolicy } from "./liveFfmpegExternalCliPolicy";

export const LIVE_FFMPEG_DRY_RUN_DECISION_ROLE =
  "live_ffmpeg_dry_run_preview_no_execution_no_vault_no_confirmed" as const;

export interface LiveFfmpegDryRunPreview {
  commands: LiveFfmpegDryRunCommand[];
  policySummary: ReturnType<typeof getLiveFfmpegExternalCliPolicy>;
  allCommandsDryRunOnly: true;
  willExecuteAnyCommand: false;
  realFfmpegExecuted: false;
  realMediaProcessed: false;
  realNetworkPull: false;
  realNetworkPush: false;
  secretValuesLogged: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_FFMPEG_DRY_RUN_DECISION_ROLE;
}

export function buildLiveFfmpegDryRunPreview(input: LiveFfmpegCommandBuilderInput = {}): LiveFfmpegDryRunPreview {
  const kinds = input.commandKind ? [input.commandKind] : getLiveFfmpegCommandKinds();
  const commands = kinds.map((commandKind) => buildLiveFfmpegDryRunCommand({ ...input, commandKind }));

  return {
    commands,
    policySummary: getLiveFfmpegExternalCliPolicy(),
    allCommandsDryRunOnly: true,
    willExecuteAnyCommand: false,
    realFfmpegExecuted: false,
    realMediaProcessed: false,
    realNetworkPull: false,
    realNetworkPush: false,
    secretValuesLogged: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_FFMPEG_DRY_RUN_DECISION_ROLE,
  };
}
