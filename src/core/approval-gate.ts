import type { ApprovalRequest, ApprovalToken } from "../domain/contracts.js";

export class ApprovalGate {
  createRequest(request: Omit<ApprovalRequest, "id">): ApprovalRequest {
    return {
      ...request,
      id: `approval-${Date.now()}`,
    };
  }

  approve(request: ApprovalRequest, approvedBy: string): ApprovalToken {
    return {
      requestId: request.id,
      action: request.action,
      scope: [...request.scope],
      approvedBy,
      approvedAt: new Date().toISOString(),
    };
  }

  assertAuthorized(
    token: ApprovalToken,
    action: ApprovalRequest["action"],
    requestedPath: string,
  ): void {
    if (token.action !== action) {
      throw new Error(`Approval does not authorize action: ${action}`);
    }

    const allowed = token.scope.some(
      (scope) => requestedPath === scope || requestedPath.startsWith(`${scope}/`),
    );

    if (!allowed) {
      throw new Error(`Path is outside approved scope: ${requestedPath}`);
    }
  }
}
