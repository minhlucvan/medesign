/**
 * Channel events for the Story Charters system.
 *
 * Communication flows:
 * - preview → manager: EVT_CHARTER_RESULT (charter evaluation results)
 * - manager → preview: EVT_CHARTER_RUN (request re-evaluation)
 */

/** Preview → Manager: a charter evaluation result is ready. */
export const EVT_CHARTER_RESULT = 'emdesign/charter-result';

/** Manager → Preview: request a fresh charter evaluation. */
export const EVT_CHARTER_RUN = 'emdesign/charter-run';

/**
 * Data sent with EVT_CHARTER_RESULT.
 * Mirrors StoryCharterResult from @emdesign/dsr.
 */
export interface CharterResultPayload {
  component: string;
  story: string;
  findings: Array<{
    id: string;
    component: string;
    story: string;
    charterName: string;
    severity: 'P0' | 'P1' | 'P2';
    pass: boolean;
    message: string;
    target?: string;
    fix?: string;
  }>;
  passed: number;
  failed: number;
  allPass: boolean;
}
