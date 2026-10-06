# Fuel and oil price ticker options

Last researched: 2026-10-05

## Recommended first release

Build two separate dashboard feeds:

1. **MDX rack cost ticker** — authoritative internal prices from each supplier/rack price sheet received by MDX. Upload or ingest the daily sheet, validate it, retain the original privately, normalize prices by supplier, terminal, product, grade, unit, and effective time, and publish the latest accepted values plus day-over-day movement.
2. **Market oil ticker** — public market context from the U.S. Energy Information Administration (EIA): WTI, Brent, RBOB gasoline, ultra-low-sulfur diesel, heating oil, jet fuel, and propane where available.

This avoids presenting a public market benchmark as MDX's actual acquisition cost.

## Cost and source comparison

| Source | Best use | Update level | Published price | MDX fit |
|---|---|---|---:|---|
| Existing supplier/rack price sheets | Actual MDX acquisition prices | Daily or whenever a sheet arrives | No new data-vendor fee; normal Firebase processing/storage usage | Recommended source of truth for the MDX rack ticker, subject to supplier terms |
| EIA Open Data API | WTI, Brent, gasoline, diesel and other public market context | Daily/weekly depending on series; not streaming | Free API key | Recommended initial oil ticker |
| OPIS RackPro / Rack API | Independent supplier, terminal and benchmark rack prices | Real-time/intraday and daily | Custom commercial quote; free trial offered | Best commercial rack-data candidate if MDX needs prices beyond its own sheets |
| DTN FastRacks / Energy API | Supplier/rack comparison and alerts | Real-time/intraday and daily | Custom commercial quote/demo | Strong alternative to OPIS |
| Massive Futures | WTI and other NYMEX/CME futures | 10-minute delay or real time | Individual plans list $29/month delayed and $199/month real time; business use requires business pricing/licensing | Candidate only after commercial display rights are confirmed |
| CME direct market-data APIs | Exchange-authoritative futures | Delayed or real time | Real-time API infrastructure starts at $23/GB/month plus applicable data-license fees; commercial licensing varies | Appropriate only when exchange-grade real-time data is required |
| Twelve Data | Broad commodity API | Plan-dependent | Public individual plans start around $79/month; commercial/internal business rights require confirmation | Secondary option; licensing must be confirmed |

Commercial rack vendors do not publish a reliable standard subscription price. Coverage, terminals, delivery method, API rights, user count, display rights, and history determine the quote.

## Expected platform operating cost

- **EIA plus uploaded supplier sheets:** likely negligible incremental Firebase cost at MDX's current data volume; the data itself is free/already supplied.
- **Commercial rack feed:** vendor quote is the dominant cost; Firebase processing remains small.
- **Real-time futures:** expect at least a paid API subscription plus possible exchange/commercial display licensing. Do not select an individual/non-professional plan for a company dashboard without written commercial-use approval.

## Proposed architecture

- Store provider credentials only in Secret Manager.
- Ingest public market data on a scheduled server-side Function.
- Ingest rack sheets through a private admin upload workflow with preview and explicit acceptance.
- Store raw file metadata separately from normalized price records.
- Reject duplicates by vendor, terminal, product, and effective timestamp.
- Preserve price-sheet audit history and the user who accepted each upload.
- Show source, last updated time, effective time, units, and stale-data warnings on every ticker.
- Restrict upload/correction controls to administrator and superadministrator roles.
- Treat a failed or stale feed as unavailable; never silently reuse an old price as current.

## Decisions needed from Patrick

- Which rack suppliers and terminals MDX purchases from.
- Sample price sheets and their delivery format (Excel, CSV, PDF, or email body).
- Whether the oil ticker can be end-of-day/daily or must be streaming real time.
- Which instruments should appear; recommended start: WTI, Brent, RBOB, ULSD, and propane.
- Whether prices are internal-only or may be shown to customers/the public.
- Whether MDX wants only its contracted rack prices or an independent OPIS/DTN comparison.
- Required refresh time, timezone, and stale-price threshold.

## Source links

- EIA Open Data and API: https://www.eia.gov/opendata/
- EIA daily petroleum spot prices: https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm
- OPIS wholesale rack prices: https://www.opis.com/product/pricing/fuel-rack-prices/
- OPIS RackPro and Rack API: https://www.opis.com/product/pricing/fuel-rack-prices/rackpro/
- DTN FastRacks: https://www.dtn.com/refined-fuels/buyer/fastracks/
- DTN Energy API: https://cp-docs.dtn.com/index.php/apis/energy-api
- Massive Futures pricing: https://massive.com/pricing?product=futures
- CME market-data APIs: https://www.cmegroup.com/market-data/connect-data.html
- Twelve Data commodities: https://twelvedata.com/commodities
