-- Owner (2026-09-01): "I added compliance packs. Wipe and seed them in
-- clean-slate." Real, blocking gap found while wiring seedCompliancePacks.ts:
-- validatePackSeed checks every Pack's own `code` against
-- `${category.toLowerCase()}-name` (CR-079) — for these 33, `compliance-name`
-- — but that concept type had only 2 rows, both about the unrelated SDLC
-- Phase 4 "security-privacy-compliance" pack, not one of the 33 real
-- regulatory Compliance Packs. None of the 33 would have published at all
-- without this.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('compliance-name', 'compliance-accessibility-ada-508', 'Digital Accessibility Compliance (ADA Title III / Sec 508 / EAA)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-aml-kyc', 'AML / KYC & OFAC Sanctions Screening Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-automotive-wp29', 'Automotive Cybersecurity & Software Update (UNECE R155 / R156)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-bipa', 'Biometric Information Privacy Compliance (BIPA / CUBI)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-coppa', 'COPPA Children''s Privacy Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-data-residency-localization', 'Global Sovereign Data Residency & Localization Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-do178c-aviation', 'DO-178C Airborne Systems Software Certification', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-e-commerce-consumer-protection', 'E-Commerce & Consumer Protection Compliance (FTC / EU / India)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-eu-ai-act', 'EU AI Act & Algorithmic Impact Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-eu-dora-nis2', 'EU DORA & NIS2 Digital Operational Resilience Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-eu-dsa-dma', 'EU Digital Services & Digital Markets Act (DSA / DMA / Data Act)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-eu-financial-reporting', 'EU Financial Markets & Corporate Sustainability (CSRD / MiFID II)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-eu-mdr', 'EU Medical Device Regulation (MDR 2017/745 / IVDR)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-fcpa', 'FCPA & UK Bribery Act Corporate Integrity Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-fda-21cfr11', 'FDA 21 CFR Part 11 & SaMD Medical Software Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-fedramp', 'FedRAMP High & Moderate Baseline Cloud Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-fisma', 'FISMA & Executive Order 14028 Federal Cybersecurity Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-gdpr', 'GDPR Data Privacy & Protection Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-glba', 'GLBA Financial Privacy & FTC Safeguards Rule Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-hipaa', 'HIPAA Health Data Privacy & Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-india-dpdp', 'India Digital Personal Data Protection (DPDP Act 2023 / CERT-In)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-india-rbi-pmla', 'RBI Financial Cybersecurity & PMLA AML Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-iso-27001', 'ISO/IEC 27001:2022 ISMS Information Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-itar-ear', 'ITAR & EAR Defense Export & CMMC 2.0 Supply Chain Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-nist-800-53', 'NIST SP 800-53 Rev. 5 Security & Privacy Controls Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-nydfs', 'NYDFS 23 NYCRR 500 Financial Cybersecurity Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-pci-dss', 'PCI-DSS v4.0 Cardholder Data Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-psd2-psd3', 'EU PSD2 / PSD3 Payment Services & Open Banking Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-sebi-companies', 'India Companies Act & SEBI Regulatory Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-soc2', 'SOC 2 Type II Trust Services Criteria Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-sox', 'SOX Financial IT General Controls (ITGC) Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-uk-gdpr-dpa', 'UK Data Protection & Online Safety Compliance (UK GDPR / OSA)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'compliance-us-state-privacy', 'US Multi-State Privacy Compliance (CCPA/CPRA, VCDPA, CPA)', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
