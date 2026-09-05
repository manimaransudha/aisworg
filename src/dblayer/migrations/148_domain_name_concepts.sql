-- Owner (2026-09-01): "I added domain packs. These have to be seeded using
-- cleanSlate." Same gap as compliance-name (migration 144): domain-name had
-- only domain-ebook-library/test-domain-ebook-library — none of the 24 new
-- domain-*.pack.json codes registered, so validatePackSeed's Track B check
-- (CR-079 — a Pack's own top-level code, validated against
-- ${category.toLowerCase()}-name) would reject all 24 on first publish.
-- Unlike the compliance batch, these 24 declare no capabilities/services at
-- all (confirmed directly) — no Track A gap here.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('domain-name', 'domain-accounting-finance', 'Accounting & Corporate Finance Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-banking-payments-markets', 'Banking, Payments & Capital Markets Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-customer-service', 'Customer Support & Incident Service Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-energy-utilities-mining', 'Energy, Utilities & Mining Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-enterprise-workflows', 'Cross-Domain Enterprise Workflows & E2E Value Chains', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-facilities-itsm', 'Facilities, Fleet & IT Service Management (ITSM) Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-government-public-services', 'Government & Public Sector Services Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-healthcare-pharma', 'Healthcare Clinical & Pharmaceutical R&D Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-hospitality-travel-aviation', 'Hospitality, Travel & Aviation Operations Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-hr-payroll', 'Human Resources & Payroll Lifecycle Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-insurance-claims', 'Insurance Underwriting & Claims Adjudication Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-legal-compliance-risk', 'Legal Practice, Enterprise Risk & Audit Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-manufacturing-quality', 'Manufacturing & Quality Control Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-marketing-advertising', 'Marketing Automation & Advertising Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-order-management', 'Order Management & Fulfillment Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-procurement-sourcing', 'Procurement & Strategic Sourcing Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-product-management', 'Product Strategy & Lifecycle Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-project-portfolio', 'Project & Portfolio Management (PPM) Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-real-estate-construction', 'Real Estate, PropTech & Construction Management Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-research-lifesciences', 'Research & Development & Life Sciences LIMS Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-retail-ecommerce', 'Retail & E-Commerce Commerce Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-sales-crm', 'Sales & CRM Customer Lifecycle Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-supply-chain-wms', 'Supply Chain, Inventory & Warehouse Management Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-telecom-media-publishing', 'Telecom BSS, Media & Publishing Domain Practices', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
