/**
 * مفتاح الجهاز الذي يوقّع سجل «إنتاج المشاهد» (HMAC). يُولَّد مرة واحدة في `.env` (`ensureLocalSecrets`)،
 * ولا يوجد في Git ولا في المتصفح ولا في السجل نفسه. نُقل كما هو من src/workflow/trust.ts (D120).
 */
export const workflowSigningKey = (): Buffer => {
  const value = process.env.BAL_WORKFLOW_HMAC_KEY;
  if (!value || Buffer.byteLength(value, "utf8") < 32)
    throw new Error("Workflow signing key is not configured (minimum 32 bytes).");
  return Buffer.from(value, "utf8");
};
