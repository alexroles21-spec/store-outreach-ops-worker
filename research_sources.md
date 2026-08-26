# Public discovery source research

- Common Crawl CDXJ Index: https://commoncrawl.org/cdxj-index — official documentation confirms the public index is served from `index.commoncrawl.org`, supports wildcard URL queries, returns JSON capture records including URL and HTTP status, and uses crawl collections listed through `collinfo.json`.
- urlscan.io API documentation: https://urlscan.io/docs/api/ — official documentation says its public APIs support searching existing historical scans. Search reference: https://urlscan.io/docs/search/.

Implementation constraint: only use public search/read endpoints, respect provider terms and rate limits, do not submit scans or contact forms automatically, and keep verification against the live storefront before a lead is qualified.
