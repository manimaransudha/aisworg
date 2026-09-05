# CR-084 — Data seed files Overhaul

**Raised:** 2026-09-01 · **Origin:** Update and enrich the data seed files   **Status:** ✅ **Built 2026-09-01.**

Updated and enriched all 37 *.pack.json seed files in src/dblayer/seed/data/ (excluding test-fixtures) with comprehensive, production-grade process capabilities, deliverable services with explicit SLAs, authority rules, policy constraints, multi-point verification checklists, review gates, and quality gates.

## 🗺️ Compliance Pack Inventory Mapping (`design/fragments/compliance.md`)

| Regulatory Domain | New Compliance Pack File | Regulatory Acts & Statutes Covered |
| :--- | :--- | :--- |
| **Corporate & Financial** | [`compliance-fcpa.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-fcpa.pack.json) | Foreign Corrupt Practices Act (FCPA), Anti-Bribery, UK Bribery Act 2010. |
| | [`compliance-sebi-companies.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-sebi-companies.pack.json) | India Companies Act 2013, SEBI LODR/PIT Regulations, IBC. |
| | [`compliance-eu-financial-reporting.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-eu-financial-reporting.pack.json) | EU Market Abuse Regulation (MAR), MiFID II/MiFIR, CSRD, SFDR. |
| **US Privacy** | [`compliance-glba.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-glba.pack.json) | Gramm-Leach-Bliley Act (GLBA) Safeguards Rule & Financial Privacy. |
| | [`compliance-coppa.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-coppa.pack.json) | Children's Online Privacy Protection Act (COPPA), Verifiable Parental Consent. |
| | [`compliance-us-state-privacy.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-us-state-privacy.pack.json) | California CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA, Oregon, Texas Privacy Acts. |
| | [`compliance-bipa.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-bipa.pack.json) | Illinois Biometric Information Privacy Act (BIPA), Texas & CA Biometric Laws. |
| **EU Digital** | [`compliance-eu-dora-nis2.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-eu-dora-nis2.pack.json) | Digital Operational Resilience Act (DORA), NIS2 Directive, Cyber Resilience Act. |
| | [`compliance-eu-dsa-dma.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-eu-dsa-dma.pack.json) | Digital Services Act (DSA), Digital Markets Act (DMA), EU Data Act. |
| **United Kingdom** | [`compliance-uk-gdpr-dpa.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-uk-gdpr-dpa.pack.json) | UK GDPR, Data Protection Act 2018, PECR, Online Safety Act 2023. |
| **India Tech & Financial** | [`compliance-india-dpdp.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-india-dpdp.pack.json) | Digital Personal Data Protection Act (DPDP) 2023, IT Act 2000, CERT-In. |
| | [`compliance-india-rbi-pmla.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-india-rbi-pmla.pack.json) | RBI Cybersecurity & Master Directions, PMLA Anti-Money Laundering, FEMA. |
| **Healthcare & Pharma** | [`compliance-fda-21cfr11.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-fda-21cfr11.pack.json) | FDA 21 CFR Part 11 Electronic Records/Signatures, SaMD Software. |
| | [`compliance-eu-mdr.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-eu-mdr.pack.json) | EU Medical Device Regulation (MDR 2017/745) & IVDR. |
| **Payments & AML** | [`compliance-psd2-psd3.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-psd2-psd3.pack.json) | EU PSD2 / PSD3, Payment Services Regulations, Strong Customer Auth (SCA). |
| | [`compliance-aml-kyc.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-aml-kyc.pack.json) | Bank Secrecy Act (BSA), USA PATRIOT Act, FinCEN, OFAC Sanctions. |
| **Cybersecurity** | [`compliance-fisma.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-fisma.pack.json) | Federal Information Security Modernization Act (FISMA) & EO 14028. |
| | [`compliance-nydfs.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-nydfs.pack.json) | NYDFS 23 NYCRR 500 Cybersecurity Regulation. |
| **Artificial Intelligence** | [`compliance-eu-ai-act.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-eu-ai-act.pack.json) | EU AI Act, NYC AEDT (Local Law 144), Colorado AI Act, Algorithmic Impact. |
| **Accessibility** | [`compliance-accessibility-ada-508.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-accessibility-ada-508.pack.json) | ADA Title III, Rehabilitation Act Section 508, European Accessibility Act (EAA). |
| **E-Commerce** | [`compliance-e-commerce-consumer-protection.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-e-commerce-consumer-protection.pack.json) | FTC Act Sec. 5, EU Consumer Rights Directive, India E-Commerce Rules 2020. |
| **Embedded / Industry** | [`compliance-automotive-wp29.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-automotive-wp29.pack.json) | UNECE WP.29 R155 Cybersecurity & R156 Software Updates, ISO 26262. |
| | [`compliance-do178c-aviation.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-do178c-aviation.pack.json) | FAA / EASA DO-178C Airborne Systems Software Certification. |
| **Defense & Export** | [`compliance-itar-ear.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-itar-ear.pack.json) | ITAR, EAR, CMMC 2.0 Defense Supply Chain Cyber Standards. |
| **Data Localization** | [`compliance-data-residency-localization.pack.json`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seed/data/compliance-data-residency-localization.pack.json) | China PIPL/DSL Data Localization, Russia Federal Law No. 242-FZ, RBI. |

---

## 📋 Content Specification per Pack

Each pack will include:
1. **Capabilities**: Domain-specific capability definitions if applicable
2. **Services**: SLAs, quality bars, and turnaround targets if applicable
3. **Authority Rules**: Approval roles and transition governance if applicable
4. **Policies**: Severity-graded compliance rules and constraints if applicable
5. **Checklists**: Comprehensive compliance obligations, evidence requirements, audit items, and quality constraints if applicable
6. **Review Gates**: Formal attestation checkpoints and prompts.
