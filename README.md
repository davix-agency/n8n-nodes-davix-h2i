# Davix H2I (PixLab) — n8n Community Node

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Package](https://img.shields.io/badge/package-n8n--nodes--davix--h2i-green.svg)](https://h2i.davix.dev)
[![n8n](https://img.shields.io/badge/integrates-n8n-orange.svg)](https://n8n.io)

Package: `n8n-nodes-davix-h2i`  
Homepage: https://h2i.davix.dev

Use the Davix H2I (PixLab) API directly inside n8n workflows — render HTML to images, transform images, run PDF operations, and run image analysis tools without writing manual HTTP requests.

Table of contents
- Features
- Requirements
- Quick start
  - Install via n8n UI (recommended)
  - Install via npm (self-hosted)
- Credentials
- Supported resources & operations
- Inputs & outputs
- Example workflows
- Development
- Troubleshooting
- Contributing
- Security
- License
- Support & Contact

---

## Features

- H2I: Render HTML + CSS to images (PNG, JPEG).
- Image: Resize, crop, rotate, convert, quality control, export to PDF.
- PDF: Merge, split, compress, convert PDFs to images, extract images.
- Tools: Image analysis (metadata, colors, detect format, orientation, hash).
- Accepts binary inputs (images, PDFs) and attaches them as multipart files to the API.
- Optionally downloads API results and exposes them as n8n binary data for subsequent nodes (save to disk, S3, Drive, etc.).
- Minimal configuration: supply Davix API Base URL and API Key credentials.

---

## Requirements

- An n8n instance (self-hosted or compatible environment for community nodes).
- Node: Davix H2I API Key.
- Davix H2I API Base URL — default: `https://pixlab.davix.dev`.
- n8n version that supports community nodes (recommended recent stable n8n).

---

## Quick start

### Install via n8n UI (recommended)
1. Open your n8n instance.
2. Go to Settings → Community Nodes.
3. Click Install and enter:
   ```
   n8n-nodes-davix-h2i
   ```
4. Restart n8n if prompted.

### Install via npm (self-hosted)
Run inside your n8n installation environment:
```bash
npm install n8n-nodes-davix-h2i
# Restart n8n if needed
```

---

## Credentials

In n8n go to Credentials → Create new credential and choose **Davix H2I API**.

Fill the following fields:
- API Key — your Davix API key
- Base URL — default is `https://pixlab.davix.dev`. Use your custom URL if you self-host Davix.

The node will validate that both Base URL and API Key are present before making any requests.

---

## Supported resources & operations

Davix H2I node exposes four resource groups. Each resource has its own operations and parameters.

- Resource: H2I
  - Operation: Render (HTML → Image)
    - Parameters: html, css, width, height, format (png/jpeg)
    - Optional: Download result as binary

- Resource: Image
  - Operation: Transform / Convert
    - Parameters: input binary properties, format (jpeg/png/webp/avif/gif/svg/pdf), width, height, crop, rotate, flip, quality, keepMetadata, targetSizeKB, enlarge
    - PDF-specific options when format=pdf: pdfMode, pdfPageSize, pdfOrientation, pdfMargin, pdfEmbedFormat, pdfJpegQuality
    - Optional: Download result(s) as binary

- Resource: PDF
  - Operations: merge, split, compress, to-images, extract-images
    - Parameters: input binary properties (pdf files), sortByName, ranges, prefix, pages, toFormat, width, height, dpi, extractImageFormat
    - Optional: Download result(s) as binary

- Resource: Tools
  - Operation: Analyze
    - Parameters: input binary properties (images), tools (metadata, colors, detect-format, orientation, hash), includeRawExif, paletteSize, hashType
    - Returns JSON analysis results

---

## Inputs & outputs

Inputs:
- JSON fields (e.g., HTML string for H2I render).
- URLs (where applicable).
- Binary input: pass file bytes from nodes like HTTP Request, Google Drive, S3, or file-read nodes. Provide the binary property name(s) as comma-separated values for multi-file operations.

Outputs:
- JSON response containing API status and meta information.
- Binary outputs when the node is configured to download returned files — the binary will be prepared on the configured output binary property (default `data`).

Notes about binary fields:
- When sending multiple binary files, provide a comma-separated list of binary property names (e.g. `pdf1,pdf2` or `image1,image2`).
- The node names file fields in multipart requests as `files` (for PDFs) or `images` (for images), matching the API's expected fields.

---

## Example usage

Below are common example workflows and minimal parameter values to get you started.

Example 1 — HTML → Image
1. Create a Set node with an `html` string (or generate HTML dynamically).
2. Add the Davix H2I node:
   - Resource: H2I
   - Operation: Render
   - HTML: use the expression or the `html` field
   - CSS: optional
   - Width: 1000
   - Height: 1500
   - Format: png
   - Download Result as Binary: true
   - Output Binary Property: `imageData`
3. Attach a file-save node (e.g., Write Binary File or Google Drive) to save `imageData`.

Example 2 — Image transform (resize & convert)
1. Download an image via HTTP Request node (set to return binary data).
2. Davix H2I node:
   - Resource: Image
   - Operation: Transform
   - Input Binary Properties: `data`
   - Format: webp
   - Width: 800
   - Height: 600
   - Quality: 85
   - Download Result(s) as Binary: true
   - Output Binary Property: `convertedImage`

Example 3 — Merge PDFs
1. Use multiple HTTP Request or file-read nodes to obtain binary PDF files under different binary properties (e.g., `pdf1`, `pdf2`).
2. Davix H2I node:
   - Resource: PDF
   - Operation: Merge
   - Input Binary Properties: `pdf1,pdf2`
   - Sort By Name: false (or true)
   - Download Result(s) as Binary: true
   - Output Binary Property: `mergedPdf`

Example 4 — Image analysis (palette and metadata)
1. Provide an image as binary via `data` property.
2. Davix H2I node:
   - Resource: Tools
   - Operation: Analyze
   - Input Binary Properties: `data`
   - Tools: Metadata, Colors
   - Include Raw EXIF: true
3. The node returns JSON with metadata and color palette.

---

## API endpoints used by the node

The node issues requests to these paths (appends to the configured Base URL):
- POST /v1/h2i — HTML → Image (JSON body)
- POST /v1/image — Image transforms (multipart formData, files/images)
- POST /v1/pdf — PDF operations (multipart formData, files)
- POST /v1/tools — Tools / analyze (multipart formData, images)

Requests include the `x-api-key` header (the node injects this from credentials).

---

## Development

This package is authored in TypeScript. Standard commands (see `package.json`) are:

- Build:
```bash
npm run build
# runs: n8n-node build && npm run copy:icons
```

- Development mode:
```bash
npm run dev
# runs: n8n-node dev
```

- Lint:
```bash
npm run lint
npm run lint:fix
```

Project layout:
- `nodes/` — TypeScript source for node and helpers.
- `dist/` — compiled output (what n8n loads at runtime).
- `package.json` uses `n8n-node` tooling and declares `dist/` files for distribution.

Icon
- A custom SVG icon is included at `nodes/DavixH2I/davixH2I.svg`. If icon does not appear in n8n, try restarting n8n or reinstalling the package.

---

## Troubleshooting

- Missing credentials error:
  - Ensure the Davix H2I credential is created and has both Base URL and API Key.
- No binary output:
  - Confirm the node is configured to "Download result as binary" or that the API returns a direct file URL in the response.
- Multipart upload errors:
  - Make sure the binary property names you provide match the previous node outputs exactly.
- Unexpected API error:
  - Inspect the node JSON output — the API typically returns a JSON object with `status`, `error`, or `results`. Remove or redact API keys before sharing logs.

When reporting issues, include:
- n8n version
- Node.js version
- The Davix H2I node version
- The operation you used
- Request parameters (with API keys removed)
- Workflow error logs (if any)

---

## Contributing

Contributions, issues and feature requests are welcome! Please follow these steps:
1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Build and test locally with `npm run dev` and `npm run build`.
4. Open a pull request describing your changes.

Please keep changes small and focused. Respect semantic versioning when proposing releases.

---

## Security

- Do not commit API keys or secrets to source control.
- If you discover a security vulnerability, please open an issue or contact the project owner privately with details so it can be addressed promptly.

---

## FAQ

Q: Can I use a self-hosted Davix instance?  
A: Yes — set the Base URL in credentials to your instance's URL (e.g., `https://your-davix.example.com`).

Q: Can the node process multiple files and return multiple binary outputs?  
A: The node can accept multiple input binaries (as comma-separated binary property names). When the API returns multiple result URLs, the node currently downloads the first URL to the configured output binary property. For multi-file responses, check the JSON `results` array and handle additional URLs via subsequent nodes or custom scripts.

Q: How do I send several images in one call?  
A: Use the Input Binary Properties field and provide a comma-separated list of binary property names produced by previous nodes. Each will be attached as an `images` file in the multipart request.

---

## Changelog

See repository releases / tags for version history. This project uses semantic versioning.

---

## License

MIT — see the LICENSE file for details.

---

## Support & Contact

- Website: https://h2i.davix.dev  
- Project: https://github.com/davix-agency/n8n-nodes-davix-h2i  
- For issues, open a GitHub issue with details (remove API keys before posting).

---

Credits
- Davix (PixLab) — API provider
- Authors / contributors — Davix H2I node for n8n
