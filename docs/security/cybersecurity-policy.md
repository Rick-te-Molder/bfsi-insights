# Cybersecurity Policy

---

**Version**: 1.0.0  
**Last updated**: 2026-01-07  
**Owner**: Technical Leadership  
**Review cadence**: Annual (or after security incidents)  
**Classification**: Internal

---

## 1. Purpose

This policy establishes cybersecurity requirements for the BFSI Insights platform to protect:

- Customer data and content
- System integrity and availability
- Intellectual property (prompts, algorithms, business logic)
- Third-party integrations and credentials

## 2. Scope

This policy applies to:

- All source code, infrastructure, and configuration in this repository
- All environments: development, staging, production
- All contributors: human developers, contractors, and AI coding assistants
- All third-party services: Supabase, Vercel, OpenAI, GitHub

## 3. Governance

### 3.1 Roles and Responsibilities

| Role               | Responsibility                                              |
| ------------------ | ----------------------------------------------------------- |
| **Technical Lead** | Policy owner, security architecture decisions               |
| **Developers**     | Secure coding practices, vulnerability remediation          |
| **DevOps**         | Infrastructure security, access control, monitoring         |
| **AI Assistants**  | Follow secure coding rules, flag security-sensitive changes |

### 3.2 Policy Hierarchy

```
Cybersecurity Policy (this document)
    ├── Threat Analysis (STRIDE)
    ├── Security Design
    └── Secure Coding Guidelines
```

## 4. Security Principles

### 4.1 Defense in Depth

Multiple layers of security controls:

1. **Perimeter**: Vercel edge, Supabase RLS
2. **Application**: Input validation, output encoding, authentication
3. **Data**: Encryption at rest and in transit, access controls
4. **Operational**: Monitoring, logging, incident response

### 4.2 Least Privilege

- Users get minimum access required for their role
- Service accounts have scoped permissions
- API keys are environment-specific and rotated

### 4.3 Secure by Default

- New features must include security controls from design
- Security requirements are explicit, not assumed
- AI-generated code requires security review for sensitive areas

### 4.4 Fail Secure

- Authentication failures deny access
- Authorization failures deny access
- System errors do not expose sensitive information

## 5. Access Control

### 5.1 Authentication Requirements

| System              | Method               | MFA Required     |
| ------------------- | -------------------- | ---------------- |
| GitHub              | SSO/OAuth            | Yes              |
| Supabase Dashboard  | Email/Password       | Yes              |
| Vercel Dashboard    | GitHub SSO           | Yes (via GitHub) |
| Production Database | Service account only | N/A              |

### 5.2 Authorization Model

- **Supabase RLS**: Row-level security enforced at database layer
- **API Routes**: Authentication middleware on all protected endpoints
- **Admin UI**: Role-based access (viewer, editor, admin)

### 5.3 Secrets Management

| Secret Type             | Storage                      | Rotation  |
| ----------------------- | ---------------------------- | --------- |
| API Keys (OpenAI, etc.) | Vercel Environment Variables | 90 days   |
| Database Credentials    | Supabase managed             | Automatic |
| GitHub Tokens           | GitHub Secrets               | 90 days   |
| Service Account Keys    | Environment-specific         | 90 days   |

**Prohibited**:

- Hardcoded secrets in source code
- Secrets in git history
- Shared credentials across environments
- Secrets in logs or error messages

## 6. Data Protection

### 6.1 Data Classification

| Classification   | Examples                     | Handling                          |
| ---------------- | ---------------------------- | --------------------------------- |
| **Public**       | Published content, summaries | No restrictions                   |
| **Internal**     | Prompts, scoring logic       | Access controlled                 |
| **Confidential** | API keys, user data          | Encrypted, audited                |
| **Restricted**   | N/A currently                | Would require additional controls |

### 6.2 Encryption

- **In Transit**: TLS 1.2+ for all connections
- **At Rest**: Supabase encryption (AES-256)
- **Backups**: Encrypted by Supabase

### 6.3 Data Retention

| Data Type          | Retention  | Deletion  |
| ------------------ | ---------- | --------- |
| Published content  | Indefinite | Manual    |
| Pipeline artifacts | 90 days    | Automatic |
| Logs               | 30 days    | Automatic |
| User sessions      | 24 hours   | Automatic |

## 7. Secure Development

### 7.1 Secure Coding Requirements

All code must follow `docs/engineering/secure-coding.md`:

- Input validation on all external data
- Output encoding for all rendered content
- Parameterized queries (no SQL injection)
- Authentication/authorization checks on protected routes

### 7.2 Code Review Requirements

| Change Type                  | Review Requirement                    |
| ---------------------------- | ------------------------------------- |
| Authentication/Authorization | Senior developer + security checklist |
| Cryptography                 | Senior developer + security checklist |
| Data access patterns         | Standard review + RLS verification    |
| Third-party integrations     | API security review                   |
| AI-generated code            | Standard review + security checklist  |

### 7.3 Dependency Management

- Dependencies scanned for vulnerabilities (npm audit)
- Critical/High vulnerabilities blocked in CI
- New dependencies require justification
- License compliance verified

### 7.4 Static Analysis

- SonarCloud scans on all PRs
- Security hotspots require explicit review
- No new Critical/Blocker issues allowed

## 8. Infrastructure Security

### 8.1 Environment Isolation

| Environment | Access         | Data                         |
| ----------- | -------------- | ---------------------------- |
| Development | All developers | Synthetic/test data          |
| Staging     | All developers | Anonymized production subset |
| Production  | Restricted     | Real data                    |

### 8.2 Network Security

- Supabase: Managed firewall, connection pooling
- Vercel: Edge network, DDoS protection
- No direct database access from public internet

### 8.3 Monitoring and Logging

- Application logs: Vercel (30 days)
- Database logs: Supabase (7 days)
- Security events: Aggregated for review

## 9. Third-Party Security

### 9.1 AI Provider Data Flow

See `docs/security/third-party-data-flow.md` for detailed analysis of:

- What data is sent to OpenAI/Anthropic
- Data retention by providers
- Compliance implications

### 9.2 Vendor Assessment

Third-party services must meet:

- SOC 2 Type II or equivalent
- GDPR compliance (where applicable)
- Acceptable data processing terms

| Vendor   | Compliance    | Last Reviewed |
| -------- | ------------- | ------------- |
| Supabase | SOC 2 Type II | 2026-01       |
| Vercel   | SOC 2 Type II | 2026-01       |
| OpenAI   | SOC 2 Type II | 2026-01       |
| GitHub   | SOC 2 Type II | 2026-01       |

## 10. Incident Response

### 10.1 Incident Classification

| Severity     | Definition                               | Response Time |
| ------------ | ---------------------------------------- | ------------- |
| **Critical** | Data breach, system compromise           | Immediate     |
| **High**     | Security vulnerability exploited         | 4 hours       |
| **Medium**   | Vulnerability discovered (not exploited) | 24 hours      |
| **Low**      | Security improvement opportunity         | Next sprint   |

### 10.2 Response Process

1. **Detect**: Monitoring alerts, user reports, security scans
2. **Contain**: Isolate affected systems, revoke compromised credentials
3. **Investigate**: Determine scope, root cause, impact
4. **Remediate**: Fix vulnerability, restore service
5. **Review**: Post-mortem, update controls

### 10.3 Communication

- Internal: Slack channel, email to stakeholders
- External: As required by regulations or contracts
- Documentation: `docs/operations/incidents/`

## 11. Compliance

### 11.1 Applicable Standards

- **OWASP Top 10**: Web application security baseline
- **OWASP ASVS**: Application security verification
- **CWE Top 25**: Common weakness enumeration
- **NIST SSDF**: Secure software development framework

### 11.2 Audit Trail

Security-relevant actions are logged:

- Authentication events
- Authorization decisions
- Data access (sensitive tables)
- Configuration changes

## 12. Training and Awareness

### 12.1 Developer Training

- Secure coding guidelines review (onboarding)
- OWASP Top 10 awareness
- Security tooling (SonarCloud, npm audit)

### 12.2 AI Assistant Configuration

AI coding assistants are configured with:

- Security-aware rules in `.windsurfrules`
- Explicit triggers for security review
- Prohibited actions (direct secret access, etc.)

## 13. Policy Review

This policy is reviewed:

- Annually (minimum)
- After security incidents
- When significant changes occur (new vendors, new data types)

---

## Appendix A: Related Documents

- `docs/security/threat-analysis.md` - STRIDE-based threat model
- `docs/security/security-design.md` - Security architecture
- `docs/engineering/secure-coding.md` - Developer guidelines
- `docs/security/third-party-data-flow.md` - AI provider data flow

## Appendix B: Change History

| Version | Date       | Author      | Changes         |
| ------- | ---------- | ----------- | --------------- |
| 1.0.0   | 2026-01-07 | AI-assisted | Initial version |
