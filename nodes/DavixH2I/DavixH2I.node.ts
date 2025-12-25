import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { davixRequest, downloadToBinary } from './GenericFunctions';

type Resource = 'h2i' | 'image' | 'pdf' | 'tools';
type PdfAction = 'merge' | 'split' | 'compress' | 'to-images' | 'extract-images';

function toBoolString(v: unknown): string {
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (typeof v === 'number') return v === 1 ? 'true' : 'false';
	if (typeof v === 'string') return v;
	return 'false';
}

export class DavixH2I implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Davix H2I',
		name: 'davixH2I',
		icon: 'file:davixH2I.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + " • " + ($parameter["operation"] || "")}}',
		description: 'Use Davix PixLab public API endpoints (H2I, Image, PDF, Tools).',
		defaults: {
			name: 'Davix H2I',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'davixH2IApi', required: true }],
		properties: [
			// -------------------------
			// Resource + Operation
			// -------------------------
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'h2i',
				options: [
					{ name: 'H2I (HTML → Image)', value: 'h2i' },
					{ name: 'Image (Transform / Export PDF)', value: 'image' },
					{ name: 'PDF (Merge/Split/Compress/Convert)', value: 'pdf' },
					{ name: 'Tools (Analyze Images)', value: 'tools' },
				],
			},

			// H2I operation
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'render',
				displayOptions: { show: { resource: ['h2i'] } },
				options: [{ name: 'Render HTML → Image', value: 'render' }],
			},

			// Image operation
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'transform',
				displayOptions: { show: { resource: ['image'] } },
				options: [{ name: 'Transform / Convert', value: 'transform' }],
			},

			// PDF operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'merge',
				displayOptions: { show: { resource: ['pdf'] } },
				options: [
					{ name: 'Merge', value: 'merge' },
					{ name: 'Split', value: 'split' },
					{ name: 'Compress', value: 'compress' },
					{ name: 'To Images', value: 'to-images' },
					{ name: 'Extract Images', value: 'extract-images' },
				],
			},

			// Tools operation
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'analyze',
				displayOptions: { show: { resource: ['tools'] } },
				options: [{ name: 'Analyze Images', value: 'analyze' }],
			},

			// -------------------------
			// H2I
			// -------------------------
			{
				displayName: 'HTML',
				name: 'html',
				type: 'string',
				default: '',
				required: true,
				typeOptions: { rows: 6 },
				displayOptions: { show: { resource: ['h2i'], operation: ['render'] } },
			},
			{
				displayName: 'CSS',
				name: 'css',
				type: 'string',
				default: '',
				typeOptions: { rows: 4 },
				displayOptions: { show: { resource: ['h2i'], operation: ['render'] } },
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				default: 1000,
				displayOptions: { show: { resource: ['h2i'], operation: ['render'] } },
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				default: 1500,
				displayOptions: { show: { resource: ['h2i'], operation: ['render'] } },
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				default: 'png',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'JPEG', value: 'jpeg' },
				],
				displayOptions: { show: { resource: ['h2i'], operation: ['render'] } },
			},
			{
				displayName: 'Download Result as Binary',
				name: 'downloadBinary',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['h2i'], operation: ['render'] } },
			},
			{
				displayName: 'Output Binary Property',
				name: 'outputBinaryProperty',
				type: 'string',
				default: 'data',
				displayOptions: { show: { resource: ['h2i'], operation: ['render'], downloadBinary: [true] } },
			},

			// -------------------------
			// Image
			// -------------------------
			{
				displayName: 'Input Binary Properties',
				name: 'imageBinaryProps',
				type: 'string',
				default: 'data',
				placeholder: 'data OR image1,image2',
				description:
					'Comma-separated binary property names from previous nodes (each will be sent as an `images` file).',
				displayOptions: { show: { resource: ['image'], operation: ['transform'] } },
			},
			{
				displayName: 'Format',
				name: 'imageFormat',
				type: 'options',
				default: 'webp',
				options: [
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'PNG', value: 'png' },
					{ name: 'WebP', value: 'webp' },
					{ name: 'AVIF', value: 'avif' },
					{ name: 'GIF', value: 'gif' },
					{ name: 'SVG', value: 'svg' },
					{ name: 'PDF', value: 'pdf' },
				],
				displayOptions: { show: { resource: ['image'], operation: ['transform'] } },
			},
			{
				displayName: 'Width',
				name: 'imageWidth',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['image'], operation: ['transform'] } },
			},
			{
				displayName: 'Height',
				name: 'imageHeight',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['image'], operation: ['transform'] } },
			},
			{
				displayName: 'Enlarge',
				name: 'enlarge',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['image'], operation: ['transform'] } },
			},

			{ displayName: 'Crop X', name: 'cropX', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Crop Y', name: 'cropY', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Crop Width', name: 'cropWidth', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Crop Height', name: 'cropHeight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },

			{ displayName: 'Rotate (degrees)', name: 'rotate', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Flip Horizontal', name: 'flipH', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Flip Vertical', name: 'flipV', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },

			{ displayName: 'Target Size (KB)', name: 'targetSizeKB', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Quality', name: 'quality', type: 'number', default: 82, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
			{ displayName: 'Keep Metadata', name: 'keepMetadata', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },

			// PDF-only options for Image endpoint (format=pdf)
			{
				displayName: 'PDF Mode',
				name: 'pdfMode',
				type: 'options',
				default: 'single',
				options: [
					{ name: 'Single', value: 'single' },
					{ name: 'Multi', value: 'multi' },
				],
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageFormat: ['pdf'] } },
			},
			{
				displayName: 'PDF Page Size',
				name: 'pdfPageSize',
				type: 'options',
				default: 'auto',
				options: [
					{ name: 'Auto', value: 'auto' },
					{ name: 'A4', value: 'a4' },
					{ name: 'Letter', value: 'letter' },
				],
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageFormat: ['pdf'] } },
			},
			{
				displayName: 'PDF Orientation',
				name: 'pdfOrientation',
				type: 'options',
				default: 'portrait',
				options: [
					{ name: 'Portrait', value: 'portrait' },
					{ name: 'Landscape', value: 'landscape' },
				],
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageFormat: ['pdf'] } },
			},
			{
				displayName: 'PDF Margin',
				name: 'pdfMargin',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageFormat: ['pdf'] } },
			},
			{
				displayName: 'PDF Embed Format',
				name: 'pdfEmbedFormat',
				type: 'options',
				default: 'png',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'JPEG', value: 'jpeg' },
				],
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageFormat: ['pdf'] } },
			},
			{
				displayName: 'PDF JPEG Quality',
				name: 'pdfJpegQuality',
				type: 'number',
				default: 85,
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageFormat: ['pdf'] } },
			},

			{
				displayName: 'Download Result(s) as Binary',
				name: 'imageDownloadBinary',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['image'], operation: ['transform'] } },
			},
			{
				displayName: 'Output Binary Property',
				name: 'imageOutputBinaryProperty',
				type: 'string',
				default: 'data',
				displayOptions: { show: { resource: ['image'], operation: ['transform'], imageDownloadBinary: [true] } },
			},

			// -------------------------
			// PDF
			// -------------------------
			{
				displayName: 'Input Binary Properties',
				name: 'pdfBinaryProps',
				type: 'string',
				default: 'data',
				placeholder: 'data OR pdf1,pdf2',
				description:
					'Comma-separated binary property names (each will be sent as a `files` PDF). For merge, provide multiple.',
				displayOptions: { show: { resource: ['pdf'] } },
			},
			{
				displayName: 'Sort By Name',
				name: 'sortByName',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['pdf'], operation: ['merge'] } },
			},
			{
				displayName: 'Ranges',
				name: 'ranges',
				type: 'string',
				default: '',
				placeholder: '1-3,4-5',
				displayOptions: { show: { resource: ['pdf'], operation: ['split'] } },
			},
			{
				displayName: 'Prefix',
				name: 'prefix',
				type: 'string',
				default: 'split_',
				displayOptions: { show: { resource: ['pdf'], operation: ['split'] } },
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'string',
				default: 'all',
				placeholder: 'all OR 1-3,5,7',
				displayOptions: { show: { resource: ['pdf'], operation: ['to-images', 'extract-images'] } },
			},
			{
				displayName: 'To Format',
				name: 'toFormat',
				type: 'options',
				default: 'png',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'WebP', value: 'webp' },
				],
				displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } },
			},
			{ displayName: 'Width', name: 'pdfWidth', type: 'number', default: 0, displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } } },
			{ displayName: 'Height', name: 'pdfHeight', type: 'number', default: 0, displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } } },
			{ displayName: 'DPI', name: 'dpi', type: 'number', default: 150, displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } } },

			{
				displayName: 'Extract Image Format',
				name: 'extractImageFormat',
				type: 'options',
				default: 'png',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'JPEG', value: 'jpeg' },
					{ name: 'WebP', value: 'webp' },
				],
				displayOptions: { show: { resource: ['pdf'], operation: ['extract-images'] } },
			},

			{
				displayName: 'Download Result(s) as Binary',
				name: 'pdfDownloadBinary',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['pdf'] } },
			},
			{
				displayName: 'Output Binary Property',
				name: 'pdfOutputBinaryProperty',
				type: 'string',
				default: 'data',
				displayOptions: { show: { resource: ['pdf'], pdfDownloadBinary: [true] } },
			},

			// -------------------------
			// Tools
			// -------------------------
			{
				displayName: 'Input Binary Properties',
				name: 'toolsBinaryProps',
				type: 'string',
				default: 'data',
				placeholder: 'data OR img1,img2',
				description: 'Comma-separated binary property names (each will be sent as an `images` file).',
				displayOptions: { show: { resource: ['tools'], operation: ['analyze'] } },
			},
			{
				displayName: 'Tools',
				name: 'tools',
				type: 'multiOptions',
				default: ['metadata'],
				options: [
					{ name: 'Metadata', value: 'metadata' },
					{ name: 'Colors', value: 'colors' },
					{ name: 'Detect Format', value: 'detect-format' },
					{ name: 'Orientation', value: 'orientation' },
					{ name: 'Hash', value: 'hash' },
				],
				displayOptions: { show: { resource: ['tools'], operation: ['analyze'] } },
			},
			{
				displayName: 'Include Raw EXIF',
				name: 'includeRawExif',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['tools'], operation: ['analyze'] } },
			},
			{
				displayName: 'Palette Size',
				name: 'paletteSize',
				type: 'number',
				default: 5,
				displayOptions: { show: { resource: ['tools'], operation: ['analyze'] } },
			},
			{
				displayName: 'Hash Type',
				name: 'hashType',
				type: 'options',
				default: 'phash',
				options: [
					{ name: 'pHash', value: 'phash' },
					{ name: 'MD5', value: 'md5' },
					{ name: 'SHA1', value: 'sha1' },
				],
				displayOptions: { show: { resource: ['tools'], operation: ['analyze'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const resource = this.getNodeParameter('resource', itemIndex) as Resource;
			const operation = this.getNodeParameter('operation', itemIndex) as string;

			// ---- H2I (JSON)
			if (resource === 'h2i') {
				if (operation !== 'render') throw new Error(`Unsupported H2I operation: ${operation}`);

				const body = {
					html: this.getNodeParameter('html', itemIndex) as string,
					css: this.getNodeParameter('css', itemIndex) as string,
					width: this.getNodeParameter('width', itemIndex) as number,
					height: this.getNodeParameter('height', itemIndex) as number,
					format: this.getNodeParameter('format', itemIndex) as string,
				};

				const response = await davixRequest.call(this, {
					method: 'POST',
					url: '/v1/h2i',
					json: true,
					body,
				});

				const downloadBinary = this.getNodeParameter('downloadBinary', itemIndex) as boolean;
				if (downloadBinary && typeof (response as any).url === 'string') {
					const binName = this.getNodeParameter('outputBinaryProperty', itemIndex) as string;
					const dl = await downloadToBinary.call(
						this,
						String((response as any).url),
						`h2i.${body.format === 'jpeg' ? 'jpg' : 'png'}`,
					);

					const binary = await this.helpers.prepareBinaryData(dl.data, dl.fileName, dl.mimeType);
					out.push({ json: response as any, binary: { [binName]: binary } });
				} else {
					out.push({ json: response as any });
				}
				continue;
			}

			// Helper to attach multiple binaries as files
			const attachFiles = async (
				fieldName: 'images' | 'files',
				propList: string,
				formData: Record<string, any>,
			) => {
				const names = propList
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean);

				if (names.length === 0) throw new Error('No binary property names provided.');

				for (const name of names) {
					const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, name);
					const meta = items[itemIndex].binary?.[name];
					const fileName = meta?.fileName ?? `${fieldName}-${name}`;
					const mimeType = meta?.mimeType;

					formData[fieldName] = formData[fieldName] || [];
					formData[fieldName].push({
						value: buffer,
						options: {
							filename: fileName,
							contentType: mimeType,
						},
					});
				}
			};

			// ---- IMAGE (multipart)
			if (resource === 'image') {
				if (operation !== 'transform') throw new Error(`Unsupported Image operation: ${operation}`);

				const imageBinaryProps = this.getNodeParameter('imageBinaryProps', itemIndex) as string;
				const format = this.getNodeParameter('imageFormat', itemIndex) as string;

				const formData: Record<string, any> = {};
				await attachFiles('images', imageBinaryProps, formData);

				// core params
				formData.format = format;

				const w = this.getNodeParameter('imageWidth', itemIndex) as number;
				const h = this.getNodeParameter('imageHeight', itemIndex) as number;
				if (w) formData.width = String(w);
				if (h) formData.height = String(h);

				formData.enlarge = toBoolString(this.getNodeParameter('enlarge', itemIndex));
				formData.rotate = String(this.getNodeParameter('rotate', itemIndex) as number);
				formData.flipH = toBoolString(this.getNodeParameter('flipH', itemIndex));
				formData.flipV = toBoolString(this.getNodeParameter('flipV', itemIndex));

				const cropX = this.getNodeParameter('cropX', itemIndex) as number;
				const cropY = this.getNodeParameter('cropY', itemIndex) as number;
				const cropWidth = this.getNodeParameter('cropWidth', itemIndex) as number;
				const cropHeight = this.getNodeParameter('cropHeight', itemIndex) as number;
				if (cropWidth && cropHeight) {
					formData.cropX = String(cropX);
					formData.cropY = String(cropY);
					formData.cropWidth = String(cropWidth);
					formData.cropHeight = String(cropHeight);
				}

				const targetSizeKB = this.getNodeParameter('targetSizeKB', itemIndex) as number;
				if (targetSizeKB) formData.targetSizeKB = String(targetSizeKB);

				formData.quality = String(this.getNodeParameter('quality', itemIndex) as number);
				formData.keepMetadata = toBoolString(this.getNodeParameter('keepMetadata', itemIndex));

				// pdf-only params
				if (format === 'pdf') {
					formData.pdfMode = this.getNodeParameter('pdfMode', itemIndex) as string;
					formData.pdfPageSize = this.getNodeParameter('pdfPageSize', itemIndex) as string;
					formData.pdfOrientation = this.getNodeParameter('pdfOrientation', itemIndex) as string;
					formData.pdfMargin = String(this.getNodeParameter('pdfMargin', itemIndex) as number);
					formData.pdfEmbedFormat = this.getNodeParameter('pdfEmbedFormat', itemIndex) as string;
					formData.pdfJpegQuality = String(this.getNodeParameter('pdfJpegQuality', itemIndex) as number);
				}

				const response = await davixRequest.call(this, {
					method: 'POST',
					url: '/v1/image',
					formData,
					json: true,
				} as IHttpRequestOptions);

				// optional download
				const downloadBinary = this.getNodeParameter('imageDownloadBinary', itemIndex) as boolean;
				if (downloadBinary) {
					const binName = this.getNodeParameter('imageOutputBinaryProperty', itemIndex) as string;

					const urls: string[] = [];
					if (typeof (response as any).url === 'string') urls.push(String((response as any).url));
					if (Array.isArray((response as any).results)) {
						for (const r of (response as any).results) {
							if (r?.url) urls.push(String(r.url));
						}
					}

					if (urls.length) {
						const firstUrl = urls[0];
						const ext = format === 'jpeg' ? 'jpg' : format;
						const dl = await downloadToBinary.call(this, firstUrl, `pixlab-image.${ext}`);
						const binary = await this.helpers.prepareBinaryData(dl.data, dl.fileName, dl.mimeType);
						out.push({ json: response as any, binary: { [binName]: binary } });
					} else {
						out.push({ json: response as any });
					}
				} else {
					out.push({ json: response as any });
				}

				continue;
			}

			// ---- PDF (multipart)
			if (resource === 'pdf') {
				const action = operation as PdfAction;

				const pdfBinaryProps = this.getNodeParameter('pdfBinaryProps', itemIndex) as string;
				const formData: Record<string, any> = {};
				await attachFiles('files', pdfBinaryProps, formData);

				formData.action = action;

				if (action === 'merge') {
					formData.sortByName = toBoolString(this.getNodeParameter('sortByName', itemIndex));
				}

				if (action === 'split') {
					formData.ranges = this.getNodeParameter('ranges', itemIndex) as string;
					formData.prefix = this.getNodeParameter('prefix', itemIndex) as string;
				}

				if (action === 'to-images') {
					formData.pages = this.getNodeParameter('pages', itemIndex) as string;
					formData.toFormat = this.getNodeParameter('toFormat', itemIndex) as string;

					const w = this.getNodeParameter('pdfWidth', itemIndex) as number;
					const h = this.getNodeParameter('pdfHeight', itemIndex) as number;
					if (w) formData.width = String(w);
					if (h) formData.height = String(h);

					formData.dpi = String(this.getNodeParameter('dpi', itemIndex) as number);
				}

				if (action === 'extract-images') {
					formData.pages = this.getNodeParameter('pages', itemIndex) as string;
					formData.imageFormat = this.getNodeParameter('extractImageFormat', itemIndex) as string;
				}

				const response = await davixRequest.call(this, {
					method: 'POST',
					url: '/v1/pdf',
					formData,
					json: true,
				} as IHttpRequestOptions);

				const downloadBinary = this.getNodeParameter('pdfDownloadBinary', itemIndex) as boolean;
				if (downloadBinary) {
					const binName = this.getNodeParameter('pdfOutputBinaryProperty', itemIndex) as string;

					const urls: string[] = [];
					if (typeof (response as any).url === 'string') urls.push(String((response as any).url));
					if (Array.isArray((response as any).results)) {
						for (const r of (response as any).results) {
							if (r?.url) urls.push(String(r.url));
						}
					}

					if (urls.length) {
						const firstUrl = urls[0];
						const dl = await downloadToBinary.call(this, firstUrl, `pixlab-pdf-result.bin`);
						const binary = await this.helpers.prepareBinaryData(dl.data, dl.fileName, dl.mimeType);
						out.push({ json: response as any, binary: { [binName]: binary } });
					} else {
						out.push({ json: response as any });
					}
				} else {
					out.push({ json: response as any });
				}

				continue;
			}

			// ---- TOOLS (multipart)
			if (resource === 'tools') {
				if (operation !== 'analyze') throw new Error(`Unsupported Tools operation: ${operation}`);

				const toolsBinaryProps = this.getNodeParameter('toolsBinaryProps', itemIndex) as string;
				const formData: Record<string, any> = {};
				await attachFiles('images', toolsBinaryProps, formData);

				const tools = this.getNodeParameter('tools', itemIndex) as string[];
				formData.tools = tools.join(',');

				formData.includeRawExif = toBoolString(this.getNodeParameter('includeRawExif', itemIndex));
				formData.paletteSize = String(this.getNodeParameter('paletteSize', itemIndex) as number);
				formData.hashType = this.getNodeParameter('hashType', itemIndex) as string;

				const response = await davixRequest.call(this, {
					method: 'POST',
					url: '/v1/tools',
					formData,
					json: true,
				} as IHttpRequestOptions);

				out.push({ json: response as any });
				continue;
			}
		}

		return [out];
	}
}
