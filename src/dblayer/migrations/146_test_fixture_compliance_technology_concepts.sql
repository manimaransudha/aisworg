-- Owner (2026-09-01): "yes, build the test fixtures also" — test-fixture
-- Pack twins for the 33 real Compliance Packs and the technology Packs added
-- alongside them (24 new + technologyc/technologycpp, which never got twins
-- either — technology-tmp.pack.json excluded, it's not wired into any
-- active seed loader). Same discipline as migrations 134-139: each twin's
-- own `test-{code}` needs a real, permanent concept — createAuthoringDraft's
-- web-authoring path would auto-propose one (ConceptCreated), but
-- seedTestFixturePacks.ts publishes directly via publishPack, which
-- (like every other seed script) requires the code to already resolve.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
('compliance-name', 'test-compliance-accessibility-ada-508', 'Test: Digital Accessibility Compliance (ADA Title III / Sec 508 / EAA)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-aml-kyc', 'Test: AML / KYC & OFAC Sanctions Screening Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-automotive-wp29', 'Test: Automotive Cybersecurity & Software Update (UNECE R155 / R156)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-bipa', 'Test: Biometric Information Privacy Compliance (BIPA / CUBI)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-coppa', 'Test: COPPA Children''s Privacy Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-data-residency-localization', 'Test: Global Sovereign Data Residency & Localization Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-do178c-aviation', 'Test: DO-178C Airborne Systems Software Certification', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-e-commerce-consumer-protection', 'Test: E-Commerce & Consumer Protection Compliance (FTC / EU / India)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-eu-ai-act', 'Test: EU AI Act & Algorithmic Impact Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-eu-dora-nis2', 'Test: EU DORA & NIS2 Digital Operational Resilience Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-eu-dsa-dma', 'Test: EU Digital Services & Digital Markets Act (DSA / DMA / Data Act)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-eu-financial-reporting', 'Test: EU Financial Markets & Corporate Sustainability (CSRD / MiFID II)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-eu-mdr', 'Test: EU Medical Device Regulation (MDR 2017/745 / IVDR)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-fcpa', 'Test: FCPA & UK Bribery Act Corporate Integrity Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-fda-21cfr11', 'Test: FDA 21 CFR Part 11 & SaMD Medical Software Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-fedramp', 'Test: FedRAMP High & Moderate Baseline Cloud Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-fisma', 'Test: FISMA & Executive Order 14028 Federal Cybersecurity Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-gdpr', 'Test: GDPR Data Privacy & Protection Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-glba', 'Test: GLBA Financial Privacy & FTC Safeguards Rule Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-hipaa', 'Test: HIPAA Health Data Privacy & Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-india-dpdp', 'Test: India Digital Personal Data Protection (DPDP Act 2023 / CERT-In)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-india-rbi-pmla', 'Test: RBI Financial Cybersecurity & PMLA AML Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-iso-27001', 'Test: ISO/IEC 27001:2022 ISMS Information Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-itar-ear', 'Test: ITAR & EAR Defense Export & CMMC 2.0 Supply Chain Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-nist-800-53', 'Test: NIST SP 800-53 Rev. 5 Security & Privacy Controls Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-nydfs', 'Test: NYDFS 23 NYCRR 500 Financial Cybersecurity Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-pci-dss', 'Test: PCI-DSS v4.0 Cardholder Data Security Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-psd2-psd3', 'Test: EU PSD2 / PSD3 Payment Services & Open Banking Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-sebi-companies', 'Test: India Companies Act & SEBI Regulatory Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-soc2', 'Test: SOC 2 Type II Trust Services Criteria Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-sox', 'Test: SOX Financial IT General Controls (ITGC) Compliance', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-uk-gdpr-dpa', 'Test: UK Data Protection & Online Safety Compliance (UK GDPR / OSA)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-compliance-us-state-privacy', 'Test: US Multi-State Privacy Compliance (CCPA/CPRA, VCDPA, CPA)', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
('technology-name', 'test-technology-cobol', 'Test: COBOL Mainframe Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-csharp', 'Test: C# .NET Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-css', 'Test: Cascading Style Sheet Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-db2', 'Test: IBM DB2 Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-docker', 'Test: Docker Containerization Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-git', 'Test: Git Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-go', 'Test: Go Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-html', 'Test: HTML Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-java', 'Test: Java Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-js', 'Test: Javascript Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-kotlin', 'Test: Kotlin Android Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-kubernetes', 'Test: Kubernetes Cloud-Native Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-nodejs', 'Test: Node.js Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-oracle', 'Test: Oracle Database Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-php', 'Test: PHP Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-python', 'Test: Python Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-rails', 'Test: Ruby on Rails Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-react-native', 'Test: React Native Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-react', 'Test: React Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-rust', 'Test: Rust Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-sass', 'Test: SASS Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-sql', 'Test: SQL Database Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-swift', 'Test: Swift iOS Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-c', 'Test: C Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-cpp', 'Test: C++ Engineering Practices', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
