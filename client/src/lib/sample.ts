// A realistic SaaS vendor data processing addendum with DELIBERATE GDPR and CCPA
// violations. Used both for the "Load sample" button and as the deterministic
// demo dataset when no Claude API key is provided.

import type { Audit, Clause, Remediation } from "./types";

export const SAMPLE_CONTRACT = `MASTER SERVICES AGREEMENT — VENDOR DATA ADDENDUM

1. Data Collection. Customer hereby grants Vendor the right to collect any and all personal information from end users including but not limited to names, email addresses, IP addresses, device identifiers, geolocation, browsing history, and any other data Vendor deems useful, without further notice to or consent from such end users.

2. Retention. Vendor shall retain all customer and end-user personal data indefinitely for internal business purposes, even after termination of this Agreement. No deletion timelines are specified or required.

3. Data Sharing. Vendor may share, sell, license, or otherwise transfer personal data to any third-party partners, advertisers, or affiliates of Vendor's choosing, at Vendor's sole discretion, without notice to Customer or end users. End users shall have no right to opt out of such sharing.

4. Security. Vendor will use commercially reasonable efforts to secure data. No specific encryption, access control, breach notification timeline, or audit procedure is specified. Breach notification, if any, will occur "in a reasonable time."

5. User Rights. End users may submit requests regarding their data to Vendor's support email. Vendor reserves the right to refuse, delay, or charge a fee for any such request at its discretion, and is not bound to any statutory response timeline.

6. Sub-Processors. Vendor may engage any sub-processors at any time without notice to or approval from Customer. Sub-processors are not required to be bound by data protection obligations equivalent to those in this Agreement.

7. International Transfers. Personal data may be transferred to and stored in any country worldwide, including jurisdictions without adequate data protection laws. No Standard Contractual Clauses, adequacy decisions, or transfer impact assessments are required.

8. Liability. Vendor's total aggregate liability for any data-related claim, including breaches, regulatory fines, and end-user damages, is capped at one hundred United States dollars ($100), regardless of cause or severity. Customer waives all consequential damages.

9. Audit Rights. Customer shall have no right to audit Vendor's security or privacy practices. Vendor will not provide SOC 2 or equivalent third-party attestations.

10. Governing Law. This Agreement is governed by the laws of a jurisdiction to be selected by Vendor after any dispute arises.`;

// Pre-computed clause ranges so highlights line up exactly with the source text.
// Each entry: [clause_id, find-anchor (first 40 chars of clause body)]
const CLAUSE_ANCHORS: { id: string; type: Clause["clause_type"]; anchor: string }[] = [
  { id: "C1", type: "Data Collection", anchor: "1. Data Collection." },
  { id: "C2", type: "Retention", anchor: "2. Retention." },
  { id: "C3", type: "Sharing", anchor: "3. Data Sharing." },
  { id: "C4", type: "Security", anchor: "4. Security." },
  { id: "C5", type: "User Rights", anchor: "5. User Rights." },
  { id: "C6", type: "Sharing", anchor: "6. Sub-Processors." },
  { id: "C7", type: "Sharing", anchor: "7. International Transfers." },
  { id: "C8", type: "Liability", anchor: "8. Liability." },
  { id: "C9", type: "Security", anchor: "9. Audit Rights." },
  { id: "C10", type: "Other", anchor: "10. Governing Law." },
];

export function buildSampleClauses(contract: string = SAMPLE_CONTRACT): Clause[] {
  const clauses: Clause[] = [];
  for (let i = 0; i < CLAUSE_ANCHORS.length; i++) {
    const a = CLAUSE_ANCHORS[i];
    const start = contract.indexOf(a.anchor);
    if (start === -1) continue;
    const nextStart =
      i + 1 < CLAUSE_ANCHORS.length
        ? contract.indexOf(CLAUSE_ANCHORS[i + 1].anchor, start + 1)
        : contract.length;
    const end = nextStart === -1 ? contract.length : nextStart;
    const text = contract.slice(start, end).trim();
    clauses.push({
      clause_id: a.id,
      clause_text: text,
      clause_type: a.type,
      range: [start, start + text.length],
    });
  }
  return clauses;
}

export const SAMPLE_AUDITS: Audit[] = [
  {
    clause_id: "C1",
    verdict: "non-compliant",
    violated_rules: ["GDPR Art. 6 (lawful basis)", "GDPR Art. 7 (consent)", "CCPA §1798.100 (notice at collection)"],
    risk_level: "High",
    explanation:
      "Blanket, open-ended collection without lawful basis, purpose limitation, or end-user notice. GDPR requires a specified lawful basis (typically consent or legitimate interest with LIA) and a notice-at-collection. CCPA requires categories of PI and purposes disclosed at or before collection.",
    confidence_score: 96,
    framework_triggered: "GDPR",
  },
  {
    clause_id: "C2",
    verdict: "non-compliant",
    violated_rules: ["GDPR Art. 5(1)(e) (storage limitation)", "CCPA §1798.100(a)(3) (retention disclosure)"],
    risk_level: "High",
    explanation:
      "Indefinite retention violates the storage-limitation principle under GDPR and CCPA's requirement to disclose the retention period (or criteria used to determine it). A documented retention schedule tied to processing purpose is required.",
    confidence_score: 94,
    framework_triggered: "GDPR",
  },
  {
    clause_id: "C3",
    verdict: "non-compliant",
    violated_rules: ["CCPA §1798.120 (right to opt out of sale/share)", "GDPR Art. 28 (processor restrictions)"],
    risk_level: "High",
    explanation:
      "Unfettered sale/sharing without an opt-out mechanism breaches CCPA's right to opt out and the 'Do Not Sell or Share' obligation. Under GDPR a processor cannot independently re-purpose or onward-transfer personal data beyond the controller's documented instructions.",
    confidence_score: 95,
    framework_triggered: "CCPA",
  },
  {
    clause_id: "C4",
    verdict: "needs-review",
    violated_rules: ["GDPR Art. 32 (security of processing)", "SOC2 CC6 (logical access)", "HIPAA §164.308 (administrative safeguards)"],
    risk_level: "Med",
    explanation:
      "'Commercially reasonable' is undefined and below the bar GDPR Art. 32 sets for appropriate technical and organizational measures. No encryption-in-transit/at-rest, MFA, or breach notification SLA is specified. SOC2 CC6 and HIPAA Security Rule both require documented controls.",
    confidence_score: 88,
    framework_triggered: "GDPR",
  },
  {
    clause_id: "C5",
    verdict: "non-compliant",
    violated_rules: ["GDPR Arts. 12-22 (data subject rights)", "CCPA §1798.130 (response timelines)"],
    risk_level: "High",
    explanation:
      "Discretionary refusal and fees breach GDPR's free, timely (one-month) DSR response and CCPA's 45-day response window. Verifiable consumer requests cannot be charged absent manifestly unfounded or excessive criteria.",
    confidence_score: 93,
    framework_triggered: "GDPR",
  },
  {
    clause_id: "C6",
    verdict: "non-compliant",
    violated_rules: ["GDPR Art. 28(2)-(4) (sub-processor authorization & flow-down)"],
    risk_level: "High",
    explanation:
      "Article 28 requires prior specific or general written authorization for sub-processors, advance notice of changes with a right to object, and flow-down of equivalent data protection obligations. None of these are present.",
    confidence_score: 92,
    framework_triggered: "GDPR",
  },
  {
    clause_id: "C7",
    verdict: "non-compliant",
    violated_rules: ["GDPR Chapter V (international transfers)", "Schrems II transfer impact assessment"],
    risk_level: "High",
    explanation:
      "Transfers outside the EEA require a valid mechanism (2021 SCCs, adequacy decision, or BCRs) plus a transfer impact assessment with supplementary measures where required. Open-ended worldwide transfer is non-compliant.",
    confidence_score: 91,
    framework_triggered: "GDPR",
  },
  {
    clause_id: "C8",
    verdict: "non-compliant",
    violated_rules: ["GDPR Art. 82 (right to compensation)", "CCPA §1798.150 (private right of action)"],
    risk_level: "High",
    explanation:
      "A $100 aggregate cap is not enforceable against statutory damages under CCPA's private right of action or GDPR Art. 82 compensation rights, and is commercially unreasonable. Most enterprise customers require a multiple-of-fees floor for data-breach liability.",
    confidence_score: 90,
    framework_triggered: "CCPA",
  },
  {
    clause_id: "C9",
    verdict: "non-compliant",
    violated_rules: ["GDPR Art. 28(3)(h) (audits & inspections)", "SOC2 trust services criteria"],
    risk_level: "Med",
    explanation:
      "Article 28 requires the processor to make available all information necessary to demonstrate compliance and allow for audits. SOC2 alone is acceptable as a substitute only when paired with an audit-on-cause right.",
    confidence_score: 87,
    framework_triggered: "SOC2",
  },
  {
    clause_id: "C10",
    verdict: "needs-review",
    violated_rules: ["Contract certainty"],
    risk_level: "Low",
    explanation:
      "Choice-of-law selected after a dispute arises is unenforceable and creates jurisdictional risk. Pin a neutral, predictable jurisdiction (e.g., Delaware or Ireland for EU data) at signature.",
    confidence_score: 80,
    framework_triggered: "GDPR",
  },
];

export const SAMPLE_REMEDIATIONS: Remediation[] = [
  {
    clause_id: "C1",
    compliant_alternative:
      "Vendor will collect only personal data strictly necessary to deliver the Services, on the documented instructions of Customer. Categories and purposes of processing will be disclosed in the Notice at Collection. Vendor will not collect special-category data without an Article 9 GDPR lawful basis. Customer is the controller; Vendor is the processor.",
    change_summary:
      "Replaces blanket collection with purpose-limited, controller-instructed processing and adds a Notice at Collection reference.",
    what_was_wrong:
      "Open-ended collection without lawful basis, purpose limitation, or end-user notice.",
  },
  {
    clause_id: "C2",
    compliant_alternative:
      "Vendor will retain personal data only for the duration necessary to provide the Services, in accordance with Customer's documented retention schedule. On termination, Vendor will delete or return all personal data within 30 days, except where retention is required by law, in which case the data will be isolated and protected against further processing.",
    change_summary:
      "Introduces a defined retention schedule and a 30-day deletion-or-return obligation on termination.",
    what_was_wrong: "Indefinite retention with no deletion timeline.",
  },
  {
    clause_id: "C3",
    compliant_alternative:
      "Vendor will not sell or share personal data as defined under CCPA/CPRA. Onward transfers are limited to authorized sub-processors strictly for the purposes set out in this Agreement. Vendor will honor Global Privacy Control signals and any verified opt-out request within 15 business days.",
    change_summary:
      "Adds a no-sale/no-share commitment, restricts onward transfers, and respects GPC + opt-out within 15 business days.",
    what_was_wrong: "Unfettered sale/sharing of personal data with no opt-out.",
  },
  {
    clause_id: "C4",
    compliant_alternative:
      "Vendor will implement technical and organizational measures appropriate to the risk under GDPR Art. 32, including encryption in transit (TLS 1.2+) and at rest (AES-256), MFA on production access, least-privilege role-based access, quarterly access reviews, and a documented incident response plan. Vendor will notify Customer of any personal data breach without undue delay and in any event within 48 hours of becoming aware.",
    change_summary:
      "Specifies concrete TOMs, encryption standards, MFA, access reviews, and a 48-hour breach notification SLA.",
    what_was_wrong:
      "'Commercially reasonable' security with no specifics and no breach notification timeline.",
  },
  {
    clause_id: "C5",
    compliant_alternative:
      "Vendor will assist Customer in responding to data subject and consumer requests free of charge, within the statutory timelines: 30 days under GDPR (extendable by 60 days for complex requests) and 45 days under CCPA. Vendor will provide a self-service tooling endpoint for access, deletion, correction, and opt-out requests.",
    change_summary:
      "Aligns DSR/CCPA response with statutory timelines and removes discretionary fees.",
    what_was_wrong:
      "Discretionary refusal/delay/fees for data subject and consumer requests.",
  },
  {
    clause_id: "C6",
    compliant_alternative:
      "Customer grants general written authorization for Vendor to engage sub-processors listed at a maintained URL. Vendor will give Customer at least 30 days' prior notice of any addition or replacement, during which Customer may object on reasonable data-protection grounds. Vendor will impose data protection obligations on each sub-processor that are no less protective than those in this Agreement and remains fully liable for sub-processor acts and omissions.",
    change_summary:
      "Adds the Article 28(2)-(4) framework: authorization, 30-day notice, right to object, flow-down, and processor liability.",
    what_was_wrong:
      "No authorization, notice, right to object, or flow-down for sub-processors.",
  },
  {
    clause_id: "C7",
    compliant_alternative:
      "Where personal data of EU/UK data subjects is transferred outside the EEA/UK, the parties will rely on the 2021 EU Standard Contractual Clauses (and UK IDTA where applicable) with the appropriate module. Vendor will complete a Transfer Impact Assessment for each non-adequacy jurisdiction and implement supplementary measures (encryption, pseudonymization, government-access reporting) where required.",
    change_summary:
      "Adds 2021 SCCs + UK IDTA, TIA, and supplementary measures for non-adequacy transfers.",
    what_was_wrong:
      "Unrestricted worldwide transfers with no transfer mechanism.",
  },
  {
    clause_id: "C8",
    compliant_alternative:
      "Vendor's liability for breach of its data protection or security obligations, or for any regulatory fine or third-party claim arising from a personal data breach caused by Vendor, will be uncapped to the extent permitted by law, and in any event no less than two times (2x) the fees paid in the preceding 12 months. Statutory rights under GDPR Art. 82 and CCPA §1798.150 are preserved.",
    change_summary:
      "Replaces the $100 cap with an uncapped/super-cap structure tied to fees and preserves statutory rights.",
    what_was_wrong: "$100 aggregate cap on all data-related liability.",
  },
  {
    clause_id: "C9",
    compliant_alternative:
      "Vendor will provide an annual SOC 2 Type II report (or equivalent) and respond to Customer security questionnaires. Customer (or its independent auditor under NDA) may audit Vendor's data protection practices on reasonable notice up to once per year, or more often following a personal data breach or material change in processing.",
    change_summary:
      "Adds SOC 2 Type II delivery, security questionnaire support, and an audit-on-cause right.",
    what_was_wrong: "No audit rights and refusal to provide third-party attestations.",
  },
  {
    clause_id: "C10",
    compliant_alternative:
      "This Agreement is governed by the laws of the State of Delaware, United States, without regard to its conflict-of-laws principles. For EU/UK data, the parties additionally agree that the SCCs/IDTA referenced above are governed by the law specified within them. Any dispute will be brought in the state or federal courts located in Wilmington, Delaware.",
    change_summary:
      "Pins Delaware governing law at signature and aligns transfer mechanisms with their native governing law.",
    what_was_wrong: "Governing law selected by one party after a dispute arises.",
  },
];
