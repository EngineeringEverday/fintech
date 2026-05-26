// Internal PM methodology doc. Static content — clearly labeled as policy.

export function Methodology() {
  return (
    <div className="prose prose-invert max-w-none text-[14px] leading-[1.7]" data-testid="methodology-doc">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Internal PM Doc · v0.4
        </div>
        <h2 className="text-xl font-semibold tracking-tight mt-1">Methodology &amp; Operating Policy</h2>
        <p className="text-muted-foreground mt-1">
          How ClauseGuard scores compliance, what the model cannot catch, and when a human lawyer
          must take over. Maintained by the AI PM as a living document.
        </p>
      </div>

      <Section title="1. Confidence Scoring">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50">
          <li>
            Each clause receives a <code className="font-mono text-[12.5px]">confidence_score</code> from 0–100 reflecting how confidently
            the auditor agent maps the clause to a known regulatory rule.
          </li>
          <li>
            Confidence is <strong>not</strong> probability of being right; it's
            self-reported certainty. We use it to triage, not to decide.
          </li>
          <li>
            Heuristic: confidence ≥ 90 → safe to surface verdict. 70–89 → show but flag for human spot-check. &lt; 70 → mark <em>needs-review</em> regardless of stated verdict.
          </li>
          <li>
            The Compliance Score (the big ring) is a weighted aggregate:
            High-risk &amp; non-compliant carry 12 penalty points, Medium 6, Low 2.
            Accepted rewrites zero out the penalty for that clause.
          </li>
        </ul>
      </Section>

      <Section title="2. What the AI Cannot Catch">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50">
          <li>
            <strong>Cross-document conflicts.</strong> The auditor sees only the
            submitted contract. Inconsistencies with the privacy policy, DPA, or MSA
            require a multi-doc review pass.
          </li>
          <li>
            <strong>Jurisdiction-specific carve-outs.</strong> State-by-state US
            privacy laws (CO, CT, VA, UT, TX, DE…) and sectoral overlays (FERPA,
            GLBA, COPPA) are out of scope for v0.4.
          </li>
          <li>
            <strong>Negotiating leverage and commercial context.</strong> Whether a
            $100 liability cap is acceptable depends on contract value and customer
            tier — strategic, not legal.
          </li>
          <li>
            <strong>Implicit obligations.</strong> Things <em>not</em> in the contract
            (missing breach-notification SLA, missing sub-processor list) require a
            checklist-driven gap scan in addition to clause-level audit.
          </li>
          <li>
            <strong>Case-law nuance.</strong> Post-Schrems II transfer impact
            assessments, evolving CPRA enforcement, and DPC guidance shift faster
            than model training data.
          </li>
        </ul>
      </Section>

      <Section title="3. When a Human Lawyer is Required">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50">
          <li>Any clause with risk_level = High AND verdict ≠ compliant.</li>
          <li>Contract value &gt; $250k ARR or processing of special-category data (GDPR Art. 9, HIPAA PHI).</li>
          <li>Cross-border transfers to non-adequacy jurisdictions.</li>
          <li>Indemnity, limitation-of-liability, or IP assignment clauses.</li>
          <li>Any clause the reviewer adds a note to — notes are an explicit escalation signal.</li>
        </ul>
      </Section>

      <Section title="4. PII Handling Before Sending Text to LLMs">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50">
          <li>
            The contract input is processed client-side. When a user provides an
            Anthropic API key, the raw text is sent <strong>directly</strong> to
            Anthropic's Messages API from the browser — it does <strong>not</strong>{" "}
            transit a ClauseGuard backend (there is none in this demo).
          </li>
          <li>
            For production, the policy is: <strong>strip identifiers before LLM
            calls.</strong> Replace party names, addresses, contact info, and
            customer-specific IDs with stable placeholders (e.g. <code className="font-mono text-[12.5px]">[VENDOR_NAME]</code>).
            Re-hydrate identifiers in the rendered report only.
          </li>
          <li>
            No special-category data (health, biometrics, minors' data) is ever
            sent to an external LLM without an executed BAA / DPA covering that
            sub-processor. ClauseGuard's roadmap routes those clauses to a
            self-hosted model.
          </li>
          <li>
            Browser-stored sessions (localStorage with in-memory fallback) hold
            only structured audit output and reviewer overrides, never raw PII
            beyond what was in the pasted contract.
          </li>
        </ul>
      </Section>

      <Section title="5. Model and Prompt Discipline">
        <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/50">
          <li>
            Model: <code className="font-mono text-[12.5px]">claude-sonnet-4-20250514</code>.
            All three agents run as separate, scoped calls — never one mega-prompt.
          </li>
          <li>
            Each agent prompt is locked and version-controlled. Prompt changes
            require a regression run against the labeled sample contract.
          </li>
          <li>
            JSON-only outputs with strict schema validation client-side. Malformed
            responses fall back to deterministic demo data so the UI never crashes.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 not-prose">
      <h3 className="text-[13px] uppercase tracking-[0.18em] text-primary font-semibold mb-2.5">
        {title}
      </h3>
      <div className="text-foreground/85">{children}</div>
    </section>
  );
}
