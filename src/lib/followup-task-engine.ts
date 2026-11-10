/**
 * AVANI LOAN SERVICES — Advisor-Controlled Follow-up & Task Engine (CP-26.2)
 * 
 * Generates and manages structured follow-up schedules:
 * D0  — Initial enquiry review & contact
 * D1  — Qualification follow-up
 * D3  — Requirement clarification
 * D7  — Application & document follow-up
 * D10 — Document status review
 * D15 — Application progress update
 * D30 — Long-term relationship review
 * 
 * IMPORTANT: Tasks are internal CRM operational reminders for human advisors.
 * No automated WhatsApp messages are dispatched.
 */

export interface FollowUpScheduleDef {
  code: 'D0' | 'D1' | 'D3' | 'D7' | 'D10' | 'D15' | 'D30';
  title: string;
  offsetDays: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export const STANDARD_FOLLOWUP_SEQUENCE: FollowUpScheduleDef[] = [
  { code: 'D0', title: 'Initial enquiry review and contact', offsetDays: 0, priority: 'HIGH' },
  { code: 'D1', title: 'Qualification follow-up & requirement review', offsetDays: 1, priority: 'HIGH' },
  { code: 'D3', title: 'Requirement & eligibility clarification', offsetDays: 3, priority: 'MEDIUM' },
  { code: 'D7', title: 'Application & document collection follow-up', offsetDays: 7, priority: 'MEDIUM' },
  { code: 'D10', title: 'Document verification & bank matching review', offsetDays: 10, priority: 'MEDIUM' },
  { code: 'D15', title: 'Lender application progress update', offsetDays: 15, priority: 'LOW' },
  { code: 'D30', title: 'Long-term loan requirement & advisory review', offsetDays: 30, priority: 'LOW' },
];

export class FollowUpTaskEngine {
  /**
   * Initializes standard follow-up tasks for a newly created or contacted lead
   */
  public static generateInitialTasks(leadId: string, advisorName: string = 'Sachin Shinde', startDate: Date = new Date()) {
    return STANDARD_FOLLOWUP_SEQUENCE.map((seq, idx) => {
      const dueDate = new Date(startDate.getTime() + seq.offsetDays * 86400000);
      return {
        taskId: `TSK-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
        title: seq.title,
        timingStage: seq.code,
        dueDate,
        priority: seq.priority,
        status: seq.offsetDays === 0 ? 'PENDING' : 'PENDING',
        assignedTo: advisorName,
        notes: `Scheduled ${seq.code} milestone for lead ${leadId}`
      };
    });
  }

  /**
   * Evaluates task status against current wall-clock date (identifies overdue tasks)
   */
  public static evaluateTaskStatuses(tasks: any[]): any[] {
    const now = new Date();
    return (tasks || []).map(task => {
      if (task.status === 'PENDING' && new Date(task.dueDate) < now) {
        return { ...task, status: 'OVERDUE' };
      }
      return task;
    });
  }
}
