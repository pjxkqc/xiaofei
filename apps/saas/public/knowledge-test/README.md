# Knowledge P0 test fixtures

This directory contains a fully fictitious Chinese product set for validating
Xiaofei's knowledge-ingestion and governance flow. It contains no production
customer data, real brand commitments, or working contact details.

| File                                   | Ingestion path            | Primary acceptance anchor                                                                |
| -------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `qingfeng-presales-guide.docx`         | Firecrawl file upload     | A 40㎡ meeting room needing Wi-Fi under ¥4,000 should use C-Air Pro at ¥3,999 with CF-70 |
| `qingfeng-aftersales-manual.pdf`       | Firecrawl file upload     | E07 requires immediate power-off, no restart, and human handoff                          |
| `qingfeng-product-service-matrix.xlsx` | Firecrawl file upload     | Model, filter, price, compatibility, service-rule, and expected-Q&A tables               |
| `qingfeng-faq.md`                      | Local UTF-8 parsing       | FAQ sections become independently governed knowledge units                               |
| `qingfeng-campaign-notes.txt`          | Local UTF-8 parsing       | Editing or deleting the “青桔计划” source invalidates its old answer                     |
| `qingfeng-subscription.html`           | Firecrawl single-page URL | Pro CF-70 subscription is ¥1,258/year and never auto-renews                              |

All uploaded files are below the P0 4 MB limit. The HTML fixture is exposed by
the SaaS deployment at `/knowledge-test/qingfeng-subscription.html`; use the
exact Preview deployment URL when testing Firecrawl so Preview evidence stays
self-contained.

Suggested flow:

1. add all six sources on `/knowledge/entries`, plus one manual Q&A;
2. verify content, metadata, source type, and lineage;
3. generate, review, and publish units on `/knowledge/units`;
4. review, Eval, and admit capabilities on `/knowledge/capabilities`;
5. ask the acceptance-anchor questions on `/chatbot`;
6. edit or delete `qingfeng-campaign-notes.txt` and confirm its previously
   admitted answer is no longer eligible.
