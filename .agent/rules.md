# Project Rules: PDF-to-CSV Hybrid SaaS

1. **Monorepo Architecture**:
   - All shared UI components (`Dropzone`, `CsvPreviewGrid`, `ExportSettings` / `ExportToolbar`) MUST live in `packages/ui` and be imported into `apps/web` and `apps/extension`.
   - All API calls from frontend apps MUST go through `packages/api-client`.
2. **Backend Standards (Python / FastAPI)**:
   - Use strict Pydantic v2 schemas for table extraction results (`headers: list[str]`, `rows: list[list[str]]`).
   - CSV export MUST support `utf-8-sig` (UTF-8 with BOM) and `cp1251` encodings so Cyrillic characters open cleanly in Microsoft Excel without broken encoding.
   - Support custom delimiters: comma (`,`), semicolon (`;`), and tab (`\t`).
3. **Extension Standards**:
   - Strictly follow Chrome Extension Manifest V3.
   - Use `@crxjs/vite-plugin` for building the extension with Vite and React.
