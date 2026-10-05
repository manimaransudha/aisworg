**This file should not be loaded into the context** 

This is my notes. Not to be used for any implementation source of truth. Anything that needs an implementation will be specifically a CR.
Claude agents should not update this.


# To be implemented

## Cross-cutting

~~- Create a UI to show the EventBus (events table) filterable by SEU id~~
- Packs can contribute to Ontology
- UI similar to marketplace extensions
- Show behavior trees 
- Build capability packs (ecosystem-specific patterns for asynchronous operations, module structure, and error handling)
- After an event is published, there should be no more logic unless there is a governed transition

## Chapter 1 - Objective
  
- Objective lifecycle: An Active Objective may instead transition to **Superseded** (replaced by a revised Objective) or **Retired** (abandoned without replacement) *[Remarks: This transition has not been implemented. Check if there is a CR]*

- Engineering Knowledge Graph *[Remarks: Create a CR - Show the Engineering Knowledge Graph visually from an Objective]*

- Multi-tenancy should define a client contract and strategic objectives should be scoped to a client contract. Move should scope to a contract.

- Active to Retire: SEU_id does not exist. Disable commissioning against the parent. Allow commissioning against the retired objective. 
- Active to Supersede: SEU_id exists: Carry forward the parent SEU_id to the new one. Supersede should be an Engineering decision. Include this payload to the superseded objective. 
 

- Objective registry. *[Remarks: the registry is not named as such, but objectives are listed and can be navigated through. At a tenant level this should become an engineering capital asset]*

Objective page - Buttons in a single column - layout is clumsy

## Chapter 5 - Pack

1. a re-published Pack version can mutate a shared contributed object in place - this should also bump up the version as this is a definition change for the pack. why are we not doing this?

3. Implementation of installation classification - where does this fall?

4. Check composition

Capability:
Is just a bare slot (similar to  a phase with no definition; definition is in the packs)

Reach for packs: Platform packs will be available to all users of the platform"
- This should be a tenant configuration. address it in multi-tenancy

Classification applies to the contributions that are *checked*. The rest inform or provide, and are not classified.

| Contribution (§9) | Typical classification |
|---|---|
| Checklists | per item; span all three |
| Quality Gates | mostly machine-verifiable |
| Review Gates | judgment (AI-assessed, human-ratified) by nature |
| Obligation Definitions | machine-verifiable (evidence present) or human-attested (approval obtained) |
| Policies / Standards / Decision Rules | machine-verifiable where objective, judgment where interpretive |
| Ontology, Knowledge Assets, Templates, UI Components, Services, Metrics | not classified — inputs and assets, not checks |

By Pack taxonomy (§6), the weight differs:

- **Technology packs** — mostly machine-verifiable (conventions, build, test).
- **Compliance packs** — a mix of machine-verifiable (evidence present) and human-attested (approvals, sign-offs).
- **Domain and architecture concerns** — largely judgment.
- **Integration packs** — external-evidence (machine-verifiable via connectors).
- **Platform and Organisation packs** — spread across all three.

Engineering Behaviour, Engineering Templates, Engineering Metrics, Reusable Components, 

## Chapter 6 - Template

- **List the packs available based on what is in the objectives**

## Chapter 11 - Service

- Check service lifecycle thoroughly. Only one service can be active. When one is activated, the previous version has to be deprecated. this is not done. 
- User service registry to also add a new capability code that feeds into ontology. 
- Service versioning. 

when a capability is chosen, the corresponding services have to be chosen in the services tab. What is editable is only the service levels and that has to be stored as part of the contributionServices[] array. I am supposing this array is a jsonb within the pack row. 

## Chapter 38 

- Pack recomposition updates active EBM - Not implemented
Pack retiring should notify EBM owners and recomposition updates should be materialised. 
- Lifecycle testing
- Pack dependency graph (dependency declaration is present) and 
- Pack compatibility not implemented. Compatibility to be checked before activation
- Export as json & schema validator. Take existing templates and convert them

## Chapter 28

- Instead of being monolithic, break the runtime kernel separately

egacy requireRole (from auth.js, gating on users.role rank: general/power/tenant_super/super) is used at these call sites:



routes/web/public.js — / ('general'), /settings GET+POST ('super'), /quickview ('general'), quickview work-item complete ('general'), quickview SEU obligations ('general')

routes/web/auth.js — /users GET, /users/create, /users/role, /users/toggle, /users/resend (all 'super')

routes/seu/web/tenantAdmin.ts — /tenant-admin/users, /tenant-admin/grants, /tenant-admin/grants/:id/revoke (all 'tenant_super')
routes/seu/web/events.ts:18 — /events, 'super'

No — /aisworg/seu/identity/users is not tenant-scoped. getIdentityDashboardView (its own comment at identity.ts:242 confirms this) loads SELECT id, email, ... FROM users with no tenant filter — every user across every tenant. It's gated by requirePlatformBadge("root") only, which is Platform-wide root authority, not a tenant scope.

There is a tenant-scoped counterpart: listUsersForTenant(tenantId) (identity.ts:256), filtered WHERE tenant_id = $1 — that's used by the separate tenant_super-gated tenant-admin page (tenantAdmin.ts), not by /identity/users.



---------
## Add this to Packs chapter


### Platform Packs

Provide default platform behaviour.

Examples:

- Engineering Practices
- Default Authority
- Default Policies
- Default Quality Gates

### Organisation Packs

Represent organisational engineering practices.

Examples:

- TCS Engineering Practices
- Accenture Engineering Practices
- Infosys Engineering Practices


### Customer Packs

Represent customer-specific requirements.

Examples:

- Cigna Engineering Requirements
- HSBC Delivery Standards


### Domain Packs

Represent domain knowledge.

Examples:

- HIPAA
- Banking
- Insurance
- Telecom
- Automotive


### Technology Packs

Represent technology ecosystems.

Examples:

- Java
- .NET
- Node.js
- Kubernetes
- React


-----------

Vishnu Kanchipuram Temples list
- Sri Varadaraja Perumal Temple
- Ashta Bhuja Perumal Temple
- Deepa Prakasar Temple
- Sri Alagiya Singa Perumal Temple
- Pandava Dootha Perumal Temple
- Thiru Neeragam
- Nilathingal Thundathu Perumal (Chandragupta Perumal)
- Ulagalanda Perumal Temple (Tri Vikrama)
- Thiru Uragam or Uragatan
- Thiru Karvanam
- Thiru Karagatu Perumal
- Yathoktakari Temple (Sonna Vannam Saida Perumal)
- Thirukalvanur Kalvar Perumal
- Sri Pavalavannar Temple
- Pacchaivannar Temple
- Sri Vaikunta Perumal Temple
- Sri Vijayaragahava Perumal Temple
- Urugumulla Perumal
- Sri Kuratalvan Temple
- Sri Adikesava Perumal Temple
- Lakshmi Narasimha Perumal Temple

Shiva Kanchipuram Temples List
- Sri Ekambareswarar Temple
- Kanchi Mayaneswara Temple
- Vallakkambar
- Kallakambar
- Nallakkambar
- Agasteeswara Temple
- Asttotarasata Linga
- Markandeswara Temple
- Mattala Madhaveswara
- Ashtottarasata Linga (II) (108 small Lingas in one) is found in the south-west corner of the First prakara of Ekambaranatha Temple
- Sahasra (1000) Linga found in the north-west corner of the second prakara in Ekambaranatha Temple
- Valleesvara is located to the east of Smasanesvara Shrine in the third prakara of Ekambaranatha Temple
- Vishnuvesvara is found on the south side of the third prakara of the Ekambaranatha temple.
- Vinduveesa temple is situated opposite the entrance (gopura) of the thousand-pillared mandapa in Ekambaranatha Temple.
- Ramanathesvara is found in a small temple near the junction of Ekambaranatha Temple Sannıdhı street and Salaı street.
- Jwaraharesvara, a temple of architectural beauty with a vimana of Pranava (Om) shape, is under the Protection and Preservation of Ancient Monuments Act and is situated in the eastern half of the Ekambaranatha Sannidhi Street
- Tantonreesvara or Upamanyesvarar temple – situated in the eastern half of the Ekambaranatha Sannidhi street
- Anantapadmanabhesvara found in Lingappier street
- Seetesvara found on the south bank of Sarvateertham Tank
- Lakshmanesvara on the bank of Sarvateetham Tank.
- Mallikarajunesvar found on the south bank of Sarvateertham Tank
- Teerthavara on the west bank of Sarvateertham Tank
- Manmuttsevara found on the south bank of Sarvatteertham Tank
- Hiranyesvar (Linga with 16 stripes) found on the west bank of Sarveteertham Tank
- Kasi Visvanatha found on the west bank of Sarvateertham Tank (There is a Muktı Mandapa insıde)
- Davalesvara on the west bank of Sarvateertham Tank
- Gangadharesvara found on the west bank of Sarvateetham Tank
- Javanteesvara found ınsıde Agrıcultural Farm near Pancupettai
- Kankanesvar ın Chinna Kammala street
- Katakesvara found ın Kammala street
- Iravattanesvar ın Kammala street
- Piravattanesvara (also known as Apunarabhavesvara) ıs sıtuated west of Vellaikulam (Tank)
- Muktesvara(I) found in Kammala Street,
- Edir Veerattanesvara in Kammala street,
- Mahalingesvar found in Appa Rao Street,
- Arunacalesvar on the south bank of Vellaikulam (tank)
- Veerattanesvara on the east bank of Vellaikulam (tank) – associated with Chakkiya Nayanar
- Rudrakoteesvara (I) is situated on the road to Konerikuppam off Railway level crossing
- Bhutanathesvara is near Pukkadi Choultry
Macchesvarar in East Rajaveethi
- Mukesvara (II) was founded in East Rajaveethi, and built during the Pallava period.
- Onesvara
- Kantesvara
- Jalandresvara Three separate Lingas, in three shrines inside the temple, known
in Tevaram hymns as Onakantan Tali, situated north of the Sarvateertham Tank. There is also a shrine of Omkara Vinayaka inside the temple.
- Anekapechura celebrated in Tevaram as Kacchi Anekatankavatam situated near
Kailasanatha Temple, west of Putteri street,
- Pascimesvara inside the temple Tirumerrali as noted in Sambandar’s Tevaram hymns, situated on Tırumerrali Street west of Pilliaıyarpalayam Street, Otteesvara also inside the temple ” Tirumerrali” as noted in Sambandar’s Tevaram hymns,
sıtuated in Tirumerrali Street west of Pillaiyarpalayam Street,
- Tirukkaleesvara (also known as Satyavratesvara) shrine inside a temple celebrated as Tirunerikkadu in Sambandar’s Tevaram near Kanchıpuram Railway Station
- Abhiramesvara on the road from the bus stand to Kamakshi temple.
- Nagaresvara located behind the bus stand
- Matangesvara to the north of Hospital Road.
- Harisapa- Bhayaharesvar ın Nellukaran Street,
- Kacchapesvara is the temple at the junction of Nellukaran Street and West Rajaveethi -associated with the legend of the suppression of Vishnu’s pride in having borne the Mandara Mountain, used as a churning rod when the celestials and demons churned the ocean for obtaining nectar.
- Ishtasiddheesvara in a separate shrine facing west, inside the temple of Srı Kacchapesvar
- Amaresvara is found in a lane off West Rajaveethi, a temple of the Pallava period.
- Iravatesvara is a small temple of Pallava times, in West Rajaveethi.
- Mahasastesvar in West Rajaveethi- near Vanniyar Choultry
Agasteesvar (II) is associated with the pilgrimage of Sage Agastya to the south (inside Upanishad Brahmendra Math), Kailasanathar Temple Road.
Kailasanatha is enshrined in a large temple built mainly by Rajasimha Pallava and completed by his son. Noted for its sculptures, stuccos, and paintings.
Kalahasteesvara in Tirumerrali street, Pillaiyarpalayam
Anadi – Rudresvara in Nadu street, Pillaiyarpalayam.
Dakshesvara in Kacchiyappan street, Pilliyarpalayam.
Cholesvara (Vairavesvara) ın Chales’ varan Street, Pıllayarpalayam
Maha Rudresvar in Madanampalayam Street, Pillayarpalayam
Visvaksenesvara ın Ekamban street, Pıllayarpalayam.
Ananda – Rudresvara in Chairman Swamınatha Mudalı Street, Pıllaiyarpalayam.
Kayarohanesvara on the west bank of Vegavatı River ın Pillayarpalayam.
Chidambaresvara to the east of Okkapirandian Tank, Pıllayarpalayam
Rudrakoteesvara (II) in Pıllayarpalayam
Mandakanessvara to the east of Okkapirandan tank, Pillayarpalayam
Vanneesvara
Saunuakesvara (also Kancheesvara) in Danappa naicken Street
Senapateesvar linga is enshrined in a separate shrine, ınsıde Kumarakottam, ın West Rajaveethi
Kausikesvara is enshrined in a temple constructed with granite stones, situated to the north-east of Kamakshi temple
Maha Kalesvara near Kah Temple, west of Srı Kamakshı Temple
Kannesvara ın Sengazhaneer Odai Street
Mohineesvara
Rudrakoteesvar (III) in Sengazhaneer Odai street
Trikala Jnanesvara inside bus stand compound
Siddhesvara in Kamarajar street
Virupakshesvara at the back of Keeraimandapam ın Valatheesvaran koil street
Valatheesvar near Kavalan gate – in Valatheesvaran Koil street
Kanikandesvar in Karukkınil Amarandaval Koıl street
Nagaresvara II in Mettu Street
Indresvara Linga with 16 stripes- behind Kailasanatha temple.
Mandalesvar (Mandanesvara) sıtuated in a garden in front of Narayana Ashram, near
Kachapesvara Mada Veethi – (formally known as Mandana Mıshra Agraharam. This temple does not exist now).
Jayantesvara Linga with 32 stripes, in the palm grove behind Kailsanatha temple
Mallikarjunesvara (II) in the garden behind the church in Konerikuppam
Mallikavanesvara in a flower garden, Konerikuppam
Pancamukhesvara is situated on a mound by the side of Vellaikulam (Tank)
Visvesvara in the outer prakara (Precinct) of Kamakshi temple.
Adipateesvara is situated in a small shrine opposite Deepa-Prakas’a temple in Kanchipuram-1
Phanadharesvara in Aladı Pıllayar Koıl Street, Kanchıpuram – 1
Parasareavara inside a small temple at the end of Chetty Street, Gandhi Road, Kanchipuram-1
Vazhakkarautteesvara inside a small temple at the end of Chetty Street, Gandhı Road, Kanchıpuram
Mukteesvara III on Gandhı Road, Kanchipuram – 1. associated with the eternal bliss of Tirukkurippu Tona Nayanar.
Garudesvara, Gandhı Road, Kanchipuram – 1.
Vyasasantaleesvara in a small street opposite Tirukacchı Nambı Street, Little Kanchipuram
associated with sage Vyasa having got freed from Nandikesvara’s curse, by worshipping Lord
Siva at Kanchi; stucco images of Vyasa – one with two hands stretched above the head and the other hands got down.
Vasishtesvara
Manikantesvara inside a small temple in Tırukkacchı Nambi Street, Vıshnu Kanchıpuram.
Vishakantesvara insıde a small temple ın Tırukkacchı Nambi Street, Vishnu Kanchıpuram.
Punyakoteesvara in a temple southeast of Chetty Street, Vishnu Kanchipuram.
Phanamaneevara in Ayyangapalayam, Vishnu Kanchipuram.
Varadarajesvara situated west of Vegavati River on the road to Tenampakkam Village from Vıshnu Kanchıpuram.
Kasyapesvara on the way to Pachayappas Women’s College, Vishnu Kanchipuram.
Ateesvara inside the compound of Pachayappa’s Women’s College, Vishnu Kanchipuram.
Tantonressvara (II) stands under an Asvatha tree in front of Vyasasantaleesvara temple in Vıshnu Kanchıpuram.
Brahmapureesvara: This linga is enshrined in a small temple, on the road leading from Vıshnu Kanchi to the village of Tenampakkam (south of Vishnu Kanchi). The Vimana of the temple is of the apsidal type (Gajaprashta – in the shape of a lying elephant) of the early Chola period. On the inside surface of the back wall of the sanctum, (behind the Siva-linga), a sculptural panel with the figures of Srı Paramesvara, Parvati, and Ganapati (in between the two) and Sri Adi Sankara paying obeisance to the deities are seen.