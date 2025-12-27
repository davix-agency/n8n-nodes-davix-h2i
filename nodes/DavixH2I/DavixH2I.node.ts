	import type {
		IExecuteFunctions,
		INodeExecutionData,
		INodeType,
		INodeTypeDescription,
		IHttpRequestOptions,
		IDataObject,
	} from 'n8n-workflow';

import { davixRequest, downloadToBinary } from './GenericFunctions';

	type Resource = 'h2i' | 'image' | 'pdf' | 'tools';
	type PdfAction =
		| 'to-images'
		| 'merge'
		| 'split'
		| 'compress'
		| 'extract-images'
		| 'watermark'
		| 'rotate'
		| 'metadata'
		| 'reorder'
		| 'delete-pages'
		| 'extract'
		| 'flatten'
		| 'encrypt'
		| 'decrypt';
	type ImageAction =
		| 'format'
		| 'resize'
		| 'crop'
		| 'transform'
		| 'compress'
		| 'enhance'
		| 'padding'
		| 'frame'
		| 'background'
		| 'watermark'
		| 'pdf'
		| 'metadata'
		| 'multitask';
	type H2iAction = 'image' | 'pdf';
	type ToolsAction = 'single' | 'multitask';

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
					description: 'Choose which PixLab endpoint to call (H2I, Image, PDF, or Tools). Sends action-specific parameters to that resource.',
					options: [
						{ name: 'H2I (HTML → Image)', value: 'h2i' },
						{ name: 'Image (Transform / Export PDF)', value: 'image' },
						{ name: 'PDF (Merge/Split/Compress/Convert)', value: 'pdf' },
						{ name: 'Tools (Analyze Images)', value: 'tools' },
					],
				},

				// H2I actions
				{
					displayName: 'Operation',
					name: 'operation',
					type: 'options',
					default: 'image',
					displayOptions: { show: { resource: ['h2i'] } },
					description: 'Select the PixLab H2I action. The node sends action=image or action=pdf accordingly.',
					options: [
						{ name: 'Render HTML to Image', value: 'image' },
						{ name: 'Render HTML to PDF', value: 'pdf' },
					],
				},

				// Image actions
				{
					displayName: 'Operation',
					name: 'operation',
					type: 'options',
					default: 'format',
					displayOptions: { show: { resource: ['image'] } },
					description: 'Select the PixLab Image action to run (sent as action=<value>).',
					options: [
						{ name: 'Format', value: 'format' },
						{ name: 'Resize', value: 'resize' },
						{ name: 'Crop', value: 'crop' },
						{ name: 'Transform', value: 'transform' },
						{ name: 'Compress', value: 'compress' },
						{ name: 'Enhance', value: 'enhance' },
						{ name: 'Padding', value: 'padding' },
						{ name: 'Frame', value: 'frame' },
						{ name: 'Background', value: 'background' },
						{ name: 'Watermark', value: 'watermark' },
						{ name: 'PDF Export', value: 'pdf' },
						{ name: 'Metadata (JSON only)', value: 'metadata' },
						{ name: 'Multitask', value: 'multitask' },
					],
				},

				// PDF actions
				{
					displayName: 'Operation',
					name: 'operation',
					type: 'options',
					default: 'merge',
					displayOptions: { show: { resource: ['pdf'] } },
					description: 'Select the PixLab PDF action to run (sent as action=<value>).',
					options: [
						{ name: 'To Images', value: 'to-images' },
						{ name: 'Merge', value: 'merge' },
						{ name: 'Split', value: 'split' },
						{ name: 'Compress', value: 'compress' },
						{ name: 'Extract Images', value: 'extract-images' },
						{ name: 'Watermark', value: 'watermark' },
						{ name: 'Rotate', value: 'rotate' },
						{ name: 'Metadata', value: 'metadata' },
						{ name: 'Reorder', value: 'reorder' },
						{ name: 'Delete Pages', value: 'delete-pages' },
						{ name: 'Extract Pages', value: 'extract' },
						{ name: 'Flatten', value: 'flatten' },
						{ name: 'Encrypt', value: 'encrypt' },
						{ name: 'Decrypt', value: 'decrypt' },
					],
				},

				// Tools actions
				{
					displayName: 'Operation',
					name: 'operation',
					type: 'options',
					default: 'single',
					displayOptions: { show: { resource: ['tools'] } },
					description: 'Select whether to run one tool or multiple tools in a single PixLab Tools request.',
					options: [
						{ name: 'Single Tool', value: 'single' },
						{ name: 'Multitask', value: 'multitask' },
					],
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
					placeholder: '<div>Hello</div>',
					description: 'HTML markup to render via PixLab H2I.',
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'CSS',
					name: 'css',
					type: 'string',
					default: '',
					typeOptions: { rows: 4 },
					placeholder: 'body { background: #fff; }',
					description: 'Optional CSS styles applied to the HTML before rendering.',
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Width',
					name: 'width',
					type: 'number',
					default: 1000,
					description: 'Output width in pixels.',
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Height',
					name: 'height',
					type: 'number',
					default: 1500,
					description: 'Output height in pixels.',
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Format',
					name: 'format',
					type: 'options',
					default: 'png',
					description: 'Image format when rendering HTML to an image.',
					options: [
						{ name: 'PNG', value: 'png' },
						{ name: 'JPEG', value: 'jpeg' },
					],
					displayOptions: { show: { resource: ['h2i'], operation: ['image'] } },
				},
				{
					displayName: 'PDF Page Size',
					name: 'h2iPdfPageSize',
					type: 'options',
					default: 'auto',
					description: 'Page size when rendering HTML to PDF.',
					options: [
						{ name: 'Auto', value: 'auto' },
						{ name: 'A4', value: 'a4' },
						{ name: 'Letter', value: 'letter' },
					],
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF Orientation',
					name: 'h2iPdfOrientation',
					type: 'options',
					default: 'portrait',
					description: 'PDF orientation for H2I PDF output.',
					options: [
						{ name: 'Portrait', value: 'portrait' },
						{ name: 'Landscape', value: 'landscape' },
					],
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF Margin',
					name: 'h2iPdfMargin',
					type: 'number',
					default: 0,
					description: 'Page margin in pixels for H2I PDF.',
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF Embed Format',
					name: 'h2iPdfEmbedFormat',
					type: 'options',
					default: 'png',
					description: 'Image format embedded inside the generated PDF.',
					options: [
						{ name: 'PNG', value: 'png' },
						{ name: 'JPEG', value: 'jpeg' },
					],
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF JPEG Quality',
					name: 'h2iPdfJpegQuality',
					type: 'number',
					default: 85,
					description: 'JPEG quality used when embedding images into the PDF.',
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'Download Result as Binary',
					name: 'downloadBinary',
					type: 'boolean',
					default: false,
					description: 'If enabled, downloads the first result URL into a binary property.',
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Output Binary Property',
					name: 'outputBinaryProperty',
					type: 'string',
					default: 'data',
					description: 'Name of the binary property to store the downloaded file.',
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'], downloadBinary: [true] } },
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
						'Comma-separated binary properties containing images to upload (e.g. data,image1). Each entry is sent as an images file.',
						displayOptions: { show: { resource: ['image'] } },
					},
				{
					displayName: 'Format',
					name: 'imageFormat',
					type: 'options',
					default: 'webp',
					description: 'Output image format for non-multitask actions.',
					options: [
						{ name: 'JPEG', value: 'jpeg' },
						{ name: 'PNG', value: 'png' },
						{ name: 'WebP', value: 'webp' },
						{ name: 'AVIF', value: 'avif' },
						{ name: 'GIF', value: 'gif' },
						{ name: 'SVG', value: 'svg' },
						{ name: 'PDF', value: 'pdf' },
					],
					displayOptions: { show: { resource: ['image'] }, hide: { operation: ['multitask'] } },
				},
				{ displayName: 'Width', name: 'imageWidth', type: 'number', default: 0, description: 'Resize width in pixels (0 to auto).', displayOptions: { show: { resource: ['image'], operation: ['resize', 'format'] } } },
				{ displayName: 'Height', name: 'imageHeight', type: 'number', default: 0, description: 'Resize height in pixels (0 to auto).', displayOptions: { show: { resource: ['image'], operation: ['resize', 'format'] } } },
				{ displayName: 'Enlarge', name: 'enlarge', type: 'boolean', default: false, description: 'Allow upscaling when resizing.', displayOptions: { show: { resource: ['image'], operation: ['resize'] } } },
				{ displayName: 'Normalize Orientation', name: 'normalizeOrientation', type: 'boolean', default: false, description: 'Auto-rotate based on EXIF orientation.', displayOptions: { show: { resource: ['image'], operation: ['resize', 'crop', 'enhance', 'metadata'] } } },
				{ displayName: 'Crop X', name: 'cropX', type: 'number', default: 0, description: 'Left offset for crop (requires crop width/height).', displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Crop Y', name: 'cropY', type: 'number', default: 0, description: 'Top offset for crop (requires crop width/height).', displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Crop Width', name: 'cropWidth', type: 'number', default: 0, description: 'Crop width in pixels.', displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Crop Height', name: 'cropHeight', type: 'number', default: 0, description: 'Crop height in pixels.', displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Background Color', name: 'backgroundColor', type: 'string', default: '', description: 'Background color to use for some actions (e.g. crop fill, compress, background).', displayOptions: { show: { resource: ['image'], operation: ['crop', 'compress', 'background'] } } },
				{ displayName: 'Rotate (degrees)', name: 'rotate', type: 'number', default: 0, description: 'Rotate image by degrees.', displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
				{ displayName: 'Flip Horizontal', name: 'flipH', type: 'boolean', default: false, description: 'Flip image horizontally.', displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
				{ displayName: 'Flip Vertical', name: 'flipV', type: 'boolean', default: false, description: 'Flip image vertically.', displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
				{ displayName: 'Color Space', name: 'colorSpace', type: 'options', default: 'srgb', description: 'Color space to use for transforms/compress.', options: [{ name: 'sRGB', value: 'srgb' }, { name: 'Display P3', value: 'display-p3' }], displayOptions: { show: { resource: ['image'], operation: ['transform', 'compress'] } } },
				{ displayName: 'Target Size (KB)', name: 'targetSizeKB', type: 'number', default: 0, description: 'Target output size in KB for compression (optional).', displayOptions: { show: { resource: ['image'], operation: ['compress'] } } },
				{ displayName: 'Quality', name: 'quality', type: 'number', default: 82, description: 'Compression quality (1-100).', displayOptions: { show: { resource: ['image'], operation: ['compress'] } } },
				{
					displayName: 'Keep Metadata',
					name: 'keepMetadata',
					type: 'boolean',
					default: false,
					description: 'Preserve EXIF/metadata when possible.',
					displayOptions: {
						show: {
							resource: ['image'],
							operation: ['format', 'resize', 'crop', 'transform', 'compress', 'enhance', 'padding', 'frame', 'background', 'watermark', 'pdf', 'metadata'],
						},
					},
				},
				{ displayName: 'Blur', name: 'blur', type: 'number', default: 0, description: 'Apply blur radius (0 to skip).', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Sharpen', name: 'sharpen', type: 'number', default: 0, description: 'Sharpen amount (0 to skip).', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Grayscale', name: 'grayscale', type: 'boolean', default: false, description: 'Convert image to grayscale.', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Sepia', name: 'sepia', type: 'boolean', default: false, description: 'Apply sepia tone.', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Brightness', name: 'brightness', type: 'number', default: 0, description: 'Adjust brightness (-100 to 100).', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Contrast', name: 'contrast', type: 'number', default: 0, description: 'Adjust contrast (-100 to 100).', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Saturation', name: 'saturation', type: 'number', default: 0, description: 'Adjust saturation (-100 to 100).', displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Pad', name: 'pad', type: 'number', default: 0, description: 'Uniform padding size.', displayOptions: { show: { resource: ['image'], operation: ['padding', 'frame'] } } },
				{ displayName: 'Pad Top', name: 'padTop', type: 'number', default: 0, description: 'Top padding (overrides uniform pad).', displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Right', name: 'padRight', type: 'number', default: 0, description: 'Right padding (overrides uniform pad).', displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Bottom', name: 'padBottom', type: 'number', default: 0, description: 'Bottom padding (overrides uniform pad).', displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Left', name: 'padLeft', type: 'number', default: 0, description: 'Left padding (overrides uniform pad).', displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Color', name: 'padColor', type: 'string', default: '', description: 'Padding color (e.g. #ffffff).', displayOptions: { show: { resource: ['image'], operation: ['padding', 'frame', 'background'] } } },
				{ displayName: 'Border', name: 'border', type: 'number', default: 0, description: 'Border thickness in pixels.', displayOptions: { show: { resource: ['image'], operation: ['frame'] } } },
				{ displayName: 'Border Color', name: 'borderColor', type: 'string', default: '', description: 'Border color (e.g. #000000).', displayOptions: { show: { resource: ['image'], operation: ['frame'] } } },
				{ displayName: 'Border Radius', name: 'borderRadius', type: 'number', default: 0, description: 'Rounded corner radius.', displayOptions: { show: { resource: ['image'], operation: ['padding', 'background'] } } },
				{ displayName: 'Background Blur', name: 'backgroundBlur', type: 'number', default: 0, description: 'Blur background by this radius.', displayOptions: { show: { resource: ['image'], operation: ['background'] } } },
				{ displayName: 'Watermark Text', name: 'watermarkText', type: 'string', default: '', description: 'Text watermark to overlay.', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Font Size', name: 'watermarkFontSize', type: 'number', default: 24, description: 'Font size for text watermark.', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Color', name: 'watermarkColor', type: 'string', default: '#000000', description: 'Text watermark color.', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Opacity', name: 'watermarkOpacity', type: 'number', default: 0.35, description: 'Watermark opacity between 0 and 1.', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{
					displayName: 'Watermark Position',
					name: 'watermarkPosition',
					type: 'options',
					default: 'center',
						options: [
							{ name: 'Center', value: 'center' },
							{ name: 'Top Left', value: 'top-left' },
							{ name: 'Top Right', value: 'top-right' },
							{ name: 'Bottom Left', value: 'bottom-left' },
							{ name: 'Bottom Right', value: 'bottom-right' },
						],
						description: 'Position for text/image watermark.',
						displayOptions: { show: { resource: ['image'], operation: ['watermark'] } },
					},
				{ displayName: 'Watermark Margin', name: 'watermarkMargin', type: 'number', default: 8, description: 'Margin/padding around watermark.', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Scale', name: 'watermarkScale', type: 'number', default: 1, description: 'Scale factor for watermark size.', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{
					displayName: 'Watermark Image Binary Property',
					name: 'watermarkImageBinaryProp',
					type: 'string',
					default: '',
					placeholder: 'watermarkImage',
					description: 'Binary property containing an image watermark (optional).',
					displayOptions: { show: { resource: ['image'], operation: ['watermark'] } },
				},
				{
					displayName: 'PDF Mode',
					name: 'pdfMode',
					type: 'options',
					default: 'single',
					options: [
						{ name: 'Single', value: 'single' },
						{ name: 'Multi', value: 'multi' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
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
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
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
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF Margin',
					name: 'pdfMargin',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
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
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF JPEG Quality',
					name: 'pdfJpegQuality',
					type: 'number',
					default: 85,
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
				},
					{ displayName: 'Include Raw EXIF', name: 'includeRawExif', type: 'boolean', default: false, description: 'Include raw EXIF data when available.', displayOptions: { show: { resource: ['image'], operation: ['metadata'] } } },
					{
						displayName: 'Options',
						name: 'options',
						type: 'collection',
						default: {},
						placeholder: 'Add option',
						description: 'Optional PixLab multitask parameters. Only selected options are sent.',
						displayOptions: { show: { resource: ['image'], operation: ['multitask'] } },
						options: [
							{
								displayName: 'Format',
								name: 'format',
								type: 'options',
								default: 'webp',
								description: 'Output format for the multitask result.',
								options: [
									{ name: 'JPEG', value: 'jpeg' },
									{ name: 'PNG', value: 'png' },
									{ name: 'WebP', value: 'webp' },
									{ name: 'AVIF', value: 'avif' },
									{ name: 'GIF', value: 'gif' },
									{ name: 'SVG', value: 'svg' },
									{ name: 'PDF', value: 'pdf' },
								],
							},
							{ displayName: 'Width', name: 'width', type: 'number', default: 0, description: 'Resize width in pixels.' },
							{ displayName: 'Height', name: 'height', type: 'number', default: 0, description: 'Resize height in pixels.' },
							{ displayName: 'Enlarge', name: 'enlarge', type: 'boolean', default: false, description: 'Allow upscaling when resizing.' },
							{
								displayName: 'Normalize Orientation',
								name: 'normalizeOrientation',
								type: 'boolean',
								default: false,
								description: 'Auto-rotate based on EXIF orientation.',
							},
							{ displayName: 'Crop X', name: 'cropX', type: 'number', default: 0, description: 'Left offset for crop.' },
							{ displayName: 'Crop Y', name: 'cropY', type: 'number', default: 0, description: 'Top offset for crop.' },
							{ displayName: 'Crop Width', name: 'cropWidth', type: 'number', default: 0, description: 'Crop width in pixels.' },
							{ displayName: 'Crop Height', name: 'cropHeight', type: 'number', default: 0, description: 'Crop height in pixels.' },
							{ displayName: 'Background Color', name: 'backgroundColor', type: 'string', default: '', description: 'Background color used for fills or padding.' },
							{ displayName: 'Rotate (degrees)', name: 'rotate', type: 'number', default: 0, description: 'Rotate image by degrees.' },
							{ displayName: 'Flip Horizontal', name: 'flipH', type: 'boolean', default: false, description: 'Flip image horizontally.' },
							{ displayName: 'Flip Vertical', name: 'flipV', type: 'boolean', default: false, description: 'Flip image vertically.' },
							{
								displayName: 'Color Space',
								name: 'colorSpace',
								type: 'options',
								default: 'srgb',
								description: 'Color space for processing.',
								options: [
									{ name: 'sRGB', value: 'srgb' },
									{ name: 'Display P3', value: 'display-p3' },
								],
							},
							{ displayName: 'Target Size (KB)', name: 'targetSizeKB', type: 'number', default: 0, description: 'Target compressed size in KB.' },
							{ displayName: 'Quality', name: 'quality', type: 'number', default: 82, description: 'Output quality (1-100).' },
							{ displayName: 'Keep Metadata', name: 'keepMetadata', type: 'boolean', default: false, description: 'Keep EXIF/metadata when possible.' },
							{ displayName: 'Blur', name: 'blur', type: 'number', default: 0, description: 'Blur radius.' },
							{ displayName: 'Sharpen', name: 'sharpen', type: 'number', default: 0, description: 'Sharpen amount.' },
							{ displayName: 'Grayscale', name: 'grayscale', type: 'boolean', default: false, description: 'Convert to grayscale.' },
							{ displayName: 'Sepia', name: 'sepia', type: 'boolean', default: false, description: 'Apply sepia tone.' },
							{ displayName: 'Brightness', name: 'brightness', type: 'number', default: 0, description: 'Brightness adjustment (-100 to 100).' },
							{ displayName: 'Contrast', name: 'contrast', type: 'number', default: 0, description: 'Contrast adjustment (-100 to 100).' },
							{ displayName: 'Saturation', name: 'saturation', type: 'number', default: 0, description: 'Saturation adjustment (-100 to 100).' },
							{ displayName: 'Pad', name: 'pad', type: 'number', default: 0, description: 'Uniform padding size.' },
							{ displayName: 'Pad Color', name: 'padColor', type: 'string', default: '', description: 'Padding color (e.g. #ffffff).' },
							{ displayName: 'Pad Top', name: 'padTop', type: 'number', default: 0, description: 'Top padding override.' },
							{ displayName: 'Pad Right', name: 'padRight', type: 'number', default: 0, description: 'Right padding override.' },
							{ displayName: 'Pad Bottom', name: 'padBottom', type: 'number', default: 0, description: 'Bottom padding override.' },
							{ displayName: 'Pad Left', name: 'padLeft', type: 'number', default: 0, description: 'Left padding override.' },
							{ displayName: 'Border Radius', name: 'borderRadius', type: 'number', default: 0, description: 'Rounded corner radius.' },
							{ displayName: 'Border', name: 'border', type: 'number', default: 0, description: 'Border thickness in pixels.' },
							{ displayName: 'Border Color', name: 'borderColor', type: 'string', default: '', description: 'Border color (e.g. #000000).' },
							{ displayName: 'Background Blur', name: 'backgroundBlur', type: 'number', default: 0, description: 'Background blur radius.' },
							{ displayName: 'Watermark Text', name: 'watermarkText', type: 'string', default: '', description: 'Text watermark content.' },
							{ displayName: 'Watermark Font Size', name: 'watermarkFontSize', type: 'number', default: 24, description: 'Font size for text watermark.' },
							{ displayName: 'Watermark Color', name: 'watermarkColor', type: 'string', default: '#000000', description: 'Color for text watermark.' },
							{ displayName: 'Watermark Opacity', name: 'watermarkOpacity', type: 'number', default: 0.35, description: 'Watermark opacity (0-1).' },
							{
								displayName: 'Watermark Position',
								name: 'watermarkPosition',
								type: 'options',
								default: 'center',
								description: 'Placement for watermark.',
								options: [
									{ name: 'Center', value: 'center' },
									{ name: 'Top Left', value: 'top-left' },
									{ name: 'Top Right', value: 'top-right' },
									{ name: 'Bottom Left', value: 'bottom-left' },
									{ name: 'Bottom Right', value: 'bottom-right' },
								],
							},
							{ displayName: 'Watermark Margin', name: 'watermarkMargin', type: 'number', default: 8, description: 'Margin/padding around watermark.' },
							{ displayName: 'Watermark Scale', name: 'watermarkScale', type: 'number', default: 1, description: 'Scale factor for watermark.' },
							{
								displayName: 'PDF Mode',
								name: 'pdfMode',
								type: 'options',
								default: 'single',
								description: 'Single or multi-page PDF export.',
								options: [
									{ name: 'Single', value: 'single' },
									{ name: 'Multi', value: 'multi' },
								],
							},
							{
								displayName: 'PDF Page Size',
								name: 'pdfPageSize',
								type: 'options',
								default: 'auto',
								description: 'Page size for PDF output.',
								options: [
									{ name: 'Auto', value: 'auto' },
									{ name: 'A4', value: 'a4' },
									{ name: 'Letter', value: 'letter' },
								],
							},
							{
								displayName: 'PDF Orientation',
								name: 'pdfOrientation',
								type: 'options',
								default: 'portrait',
								description: 'Orientation for PDF pages.',
								options: [
									{ name: 'Portrait', value: 'portrait' },
									{ name: 'Landscape', value: 'landscape' },
								],
							},
							{ displayName: 'PDF Margin', name: 'pdfMargin', type: 'number', default: 0, description: 'Page margin for PDF output.' },
							{
								displayName: 'PDF Embed Format',
								name: 'pdfEmbedFormat',
								type: 'options',
								default: 'png',
								description: 'Image format embedded in the PDF.',
								options: [
									{ name: 'PNG', value: 'png' },
									{ name: 'JPEG', value: 'jpeg' },
								],
							},
							{ displayName: 'PDF JPEG Quality', name: 'pdfJpegQuality', type: 'number', default: 85, description: 'JPEG quality for PDF embedding.' },
							{ displayName: 'Include Raw EXIF', name: 'includeRawExif', type: 'boolean', default: false, description: 'Include raw EXIF data when available.' },
						],
					},
					{
						displayName: 'Watermark Image Binary Property',
						name: 'watermarkBinaryProperty',
						type: 'string',
						default: '',
						placeholder: 'watermarkImage',
						description: 'Binary property containing an image watermark (used if watermark options are set).',
						displayOptions: { show: { resource: ['image'], operation: ['multitask'] } },
					},

				{
					displayName: 'Download Result(s) as Binary',
					name: 'imageDownloadBinary',
					type: 'boolean',
					default: false,
					description: 'Download the first returned URL into binary data (results remain in JSON).',
					displayOptions: {
						show: {
							resource: ['image'],
							operation: ['format', 'resize', 'crop', 'transform', 'compress', 'enhance', 'padding', 'frame', 'background', 'watermark', 'pdf', 'multitask'],
						},
					},
				},
				{
					displayName: 'Output Binary Property',
					name: 'imageOutputBinaryProperty',
					type: 'string',
					default: 'data',
					description: 'Binary property name to store the downloaded file.',
					displayOptions: {
						show: {
							resource: ['image'],
							operation: ['format', 'resize', 'crop', 'transform', 'compress', 'enhance', 'padding', 'frame', 'background', 'watermark', 'pdf', 'multitask'],
							imageDownloadBinary: [true],
						},
					},
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
					description: 'When merging, sort uploaded PDFs by filename before merging.',
					displayOptions: { show: { resource: ['pdf'], operation: ['merge'] } },
				},
				{
					displayName: 'Ranges',
					name: 'ranges',
					type: 'string',
					default: '',
					placeholder: '1-3,4-5',
					description: 'Page ranges to keep when splitting (e.g. 1-3,5).',
					displayOptions: { show: { resource: ['pdf'], operation: ['split'] } },
				},
				{
					displayName: 'Prefix',
					name: 'prefix',
					type: 'string',
					default: 'split_',
					description: 'Prefix for split output files.',
					displayOptions: { show: { resource: ['pdf'], operation: ['split', 'extract'] } },
				},
				{
					displayName: 'Pages',
					name: 'pages',
					type: 'string',
					default: 'all',
					placeholder: 'all OR 1-3,5,7',
					description: 'Page selection, e.g. all or 1-3,5.',
					displayOptions: {
						show: { resource: ['pdf'], operation: ['to-images', 'extract-images', 'watermark', 'rotate', 'delete-pages', 'extract'] },
					},
				},
				{
					displayName: 'To Format',
					name: 'toFormat',
					type: 'options',
					default: 'png',
					description: 'Image format when converting PDF pages.',
					options: [
						{ name: 'PNG', value: 'png' },
						{ name: 'JPEG', value: 'jpeg' },
						{ name: 'WebP', value: 'webp' },
					],
					displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } },
				},
				{ displayName: 'Width', name: 'pdfWidth', type: 'number', default: 0, description: 'Resize width for PDF to images (optional).', displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } } },
				{ displayName: 'Height', name: 'pdfHeight', type: 'number', default: 0, description: 'Resize height for PDF to images (optional).', displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } } },
				{ displayName: 'DPI', name: 'dpi', type: 'number', default: 150, description: 'Rendering DPI for PDF to images.', displayOptions: { show: { resource: ['pdf'], operation: ['to-images'] } } },

				{
					displayName: 'Extract Image Format',
					name: 'extractImageFormat',
					type: 'options',
					default: 'png',
					description: 'Image format for extracted images.',
					options: [
						{ name: 'PNG', value: 'png' },
						{ name: 'JPEG', value: 'jpeg' },
						{ name: 'WebP', value: 'webp' },
					],
					displayOptions: { show: { resource: ['pdf'], operation: ['extract-images'] } },
				},
				{ displayName: 'Watermark Text', name: 'watermarkText', type: 'string', default: '', description: 'Optional text watermark to apply.', displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Opacity', name: 'watermarkOpacity', type: 'number', default: 0.35, description: 'Watermark opacity (0-1).', displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{
					displayName: 'Watermark Position',
					name: 'watermarkPosition',
					type: 'options',
					default: 'center',
					options: [
						{ name: 'Center', value: 'center' },
						{ name: 'Top Left', value: 'top-left' },
						{ name: 'Top Right', value: 'top-right' },
						{ name: 'Bottom Left', value: 'bottom-left' },
						{ name: 'Bottom Right', value: 'bottom-right' },
					],
					displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } },
				},
				{ displayName: 'Watermark Margin', name: 'watermarkMargin', type: 'number', default: 8, displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Font Size', name: 'watermarkFontSize', type: 'number', default: 24, displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Color', name: 'watermarkColor', type: 'string', default: '#000000', displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Scale', name: 'watermarkScale', type: 'number', default: 1, description: 'Scale factor for watermark.', displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{
					displayName: 'Watermark Image Binary Property',
					name: 'watermarkImageBinaryProp',
					type: 'string',
					default: '',
					description: 'Binary property containing an image watermark (optional).',
					displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } },
				},
				{ displayName: 'Degrees', name: 'degrees', type: 'number', default: 0, description: 'Rotation angle in degrees.', displayOptions: { show: { resource: ['pdf'], operation: ['rotate'] } } },
				{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Set PDF title metadata.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Author', name: 'author', type: 'string', default: '', description: 'Set PDF author metadata.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Subject', name: 'subject', type: 'string', default: '', description: 'Set PDF subject metadata.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Keywords', name: 'keywords', type: 'string', default: '', description: 'Set PDF keywords metadata.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Creator', name: 'creator', type: 'string', default: '', description: 'Set PDF creator metadata.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Producer', name: 'producer', type: 'string', default: '', description: 'Set PDF producer metadata.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Clean All Metadata', name: 'cleanAllMetadata', type: 'boolean', default: false, description: 'Remove existing metadata before applying new fields.', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Order (JSON array)', name: 'order', type: 'string', default: '', description: 'JSON array describing new page order (e.g. [2,1,3]).', displayOptions: { show: { resource: ['pdf'], operation: ['reorder'] } } },
				{ displayName: 'Mode', name: 'mode', type: 'string', default: 'range', description: 'Extraction mode (e.g. range).', displayOptions: { show: { resource: ['pdf'], operation: ['extract'] } } },
				{ displayName: 'Flatten Forms', name: 'flattenForms', type: 'boolean', default: false, description: 'Flatten form fields into static content.', displayOptions: { show: { resource: ['pdf'], operation: ['flatten'] } } },
				{ displayName: 'User Password', name: 'userPassword', type: 'string', default: '', description: 'User password for encryption.', displayOptions: { show: { resource: ['pdf'], operation: ['encrypt'] } } },
				{ displayName: 'Owner Password', name: 'ownerPassword', type: 'string', default: '', description: 'Owner password for encryption.', displayOptions: { show: { resource: ['pdf'], operation: ['encrypt'] } } },
				{ displayName: 'Password', name: 'password', type: 'string', default: '', description: 'Password to decrypt PDF.', displayOptions: { show: { resource: ['pdf'], operation: ['decrypt'] } } },

				{
					displayName: 'Download Result(s) as Binary',
					name: 'pdfDownloadBinary',
					type: 'boolean',
					default: false,
					description: 'If enabled, download the first URL result into a binary property.',
					displayOptions: { show: { resource: ['pdf'] } },
				},
				{
					displayName: 'Output Binary Property',
					name: 'pdfOutputBinaryProperty',
					type: 'string',
					default: 'data',
					description: 'Binary property name to store downloaded PDF/image results.',
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
					description: 'Comma-separated binary properties containing images to analyze (sent as images files).',
					displayOptions: { show: { resource: ['tools'] } },
				},
				{
					displayName: 'Tool',
					name: 'tool',
					type: 'options',
					default: 'metadata',
					description: 'Single PixLab tool to run in action=single.',
					options: [
						{ name: 'Metadata', value: 'metadata' },
						{ name: 'Colors', value: 'colors' },
						{ name: 'Detect Format', value: 'detect-format' },
						{ name: 'Orientation', value: 'orientation' },
						{ name: 'Hash', value: 'hash' },
						{ name: 'Similarity', value: 'similarity' },
						{ name: 'Dimensions', value: 'dimensions' },
						{ name: 'Palette', value: 'palette' },
						{ name: 'Transparency', value: 'transparency' },
						{ name: 'Quality', value: 'quality' },
						{ name: 'Efficiency', value: 'efficiency' },
					],
					displayOptions: { show: { resource: ['tools'], operation: ['single'] } },
				},
				{
					displayName: 'Tools',
					name: 'tools',
					type: 'multiOptions',
					default: ['metadata'],
					description: 'Multiple PixLab tools to run together in action=multitask.',
					options: [
						{ name: 'Metadata', value: 'metadata' },
						{ name: 'Colors', value: 'colors' },
						{ name: 'Detect Format', value: 'detect-format' },
						{ name: 'Orientation', value: 'orientation' },
						{ name: 'Hash', value: 'hash' },
						{ name: 'Similarity', value: 'similarity' },
						{ name: 'Dimensions', value: 'dimensions' },
						{ name: 'Palette', value: 'palette' },
						{ name: 'Transparency', value: 'transparency' },
						{ name: 'Quality', value: 'quality' },
						{ name: 'Efficiency', value: 'efficiency' },
					],
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'] } },
				},
				{
					displayName: 'Options',
					name: 'options',
					type: 'collection',
					default: {},
					placeholder: 'Add option',
					description: 'Optional tool parameters (only applied when the selected tool supports them).',
					displayOptions: { show: { resource: ['tools'], operation: ['single'] } },
					options: [
						{ displayName: 'Include Raw EXIF', name: 'includeRawExif', type: 'boolean', default: false, description: 'Include raw EXIF data (metadata tool only).' },
						{ displayName: 'Palette Size', name: 'paletteSize', type: 'number', default: 5, description: 'Number of colors to extract (palette tool).' },
						{
							displayName: 'Hash Type',
							name: 'hashType',
							type: 'options',
							default: 'phash',
							description: 'Hash algorithm to compute (hash tool).',
							options: [
								{ name: 'pHash', value: 'phash' },
								{ name: 'MD5', value: 'md5' },
								{ name: 'SHA1', value: 'sha1' },
							],
						},
						{ displayName: 'Similarity Mode', name: 'similarityMode', type: 'string', default: '', description: 'Similarity mode (similarity tool).' },
						{ displayName: 'Similarity Threshold', name: 'similarityThreshold', type: 'number', default: 0, description: 'Similarity threshold (similarity tool).' },
						{ displayName: 'Quality Sample', name: 'qualitySample', type: 'number', default: 0, description: 'Sample size for quality analysis (quality tool).' },
						{ displayName: 'Transparency Sample', name: 'transparencySample', type: 'number', default: 0, description: 'Sample size for transparency analysis (transparency tool).' },
						{ displayName: 'Efficiency Format', name: 'efficiencyFormat', type: 'string', default: '', description: 'Output format for efficiency tool.' },
						{ displayName: 'Efficiency Quality', name: 'efficiencyQuality', type: 'number', default: 0, description: 'Quality setting for efficiency tool.' },
					],
				},
				{
					displayName: 'Options',
					name: 'options',
					type: 'collection',
					default: {},
					placeholder: 'Add option',
					description: 'Optional tool parameters (applied per selected tool).',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'] } },
					options: [
						{ displayName: 'Include Raw EXIF', name: 'includeRawExif', type: 'boolean', default: false, description: 'Include raw EXIF data (metadata tool).' },
						{ displayName: 'Palette Size', name: 'paletteSize', type: 'number', default: 5, description: 'Number of colors to extract (palette tool).' },
						{
							displayName: 'Hash Type',
							name: 'hashType',
							type: 'options',
							default: 'phash',
							description: 'Hash algorithm to compute (hash tool).',
							options: [
								{ name: 'pHash', value: 'phash' },
								{ name: 'MD5', value: 'md5' },
								{ name: 'SHA1', value: 'sha1' },
							],
						},
						{ displayName: 'Similarity Mode', name: 'similarityMode', type: 'string', default: '', description: 'Similarity mode (similarity tool).' },
						{ displayName: 'Similarity Threshold', name: 'similarityThreshold', type: 'number', default: 0, description: 'Similarity threshold (similarity tool).' },
						{ displayName: 'Quality Sample', name: 'qualitySample', type: 'number', default: 0, description: 'Sample size for quality analysis (quality tool).' },
						{ displayName: 'Transparency Sample', name: 'transparencySample', type: 'number', default: 0, description: 'Sample size for transparency analysis (transparency tool).' },
						{ displayName: 'Efficiency Format', name: 'efficiencyFormat', type: 'string', default: '', description: 'Output format for efficiency tool.' },
						{ displayName: 'Efficiency Quality', name: 'efficiencyQuality', type: 'number', default: 0, description: 'Quality setting for efficiency tool.' },
					],
				},
			],
		};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				const resource = this.getNodeParameter('resource', itemIndex) as Resource;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				const gatherFirstUrl = (response: any): string | undefined => {
					if (typeof response?.url === 'string') return String(response.url);
					if (Array.isArray(response?.results)) {
						for (const r of response.results) {
							if (r?.url) return String(r.url);
							if (typeof r === 'string') return r;
						}
					}
					return undefined;
				};

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

				const attachSingleFile = async (fieldName: string, propName: string, formData: Record<string, any>) => {
					if (!propName) return;
					const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, propName);
					const meta = items[itemIndex].binary?.[propName];
					const fileName = meta?.fileName ?? fieldName;
					const mimeType = meta?.mimeType;
					formData[fieldName] = {
						value: buffer,
						options: { filename: fileName, contentType: mimeType },
					};
				};

				// ---- H2I (JSON)
				if (resource === 'h2i') {
					const action = operation as H2iAction;
					const body: Record<string, any> = {
						action,
						html: this.getNodeParameter('html', itemIndex) as string,
						css: this.getNodeParameter('css', itemIndex) as string,
						width: this.getNodeParameter('width', itemIndex) as number,
						height: this.getNodeParameter('height', itemIndex) as number,
					};

					if (action === 'image') {
						body.format = this.getNodeParameter('format', itemIndex) as string;
					} else {
						body.pdfPageSize = this.getNodeParameter('h2iPdfPageSize', itemIndex) as string;
						body.pdfOrientation = this.getNodeParameter('h2iPdfOrientation', itemIndex) as string;
						body.pdfMargin = this.getNodeParameter('h2iPdfMargin', itemIndex) as number;
						body.pdfEmbedFormat = this.getNodeParameter('h2iPdfEmbedFormat', itemIndex) as string;
						body.pdfJpegQuality = this.getNodeParameter('h2iPdfJpegQuality', itemIndex) as number;
					}

					const response = await davixRequest.call(this, {
						method: 'POST',
						url: '/v1/h2i',
						json: true,
						body,
					});

					const downloadBinary = this.getNodeParameter('downloadBinary', itemIndex) as boolean;
					if (downloadBinary) {
						const firstUrl = gatherFirstUrl(response);
						if (!firstUrl) throw new Error('No URL returned to download.');
						const binName = this.getNodeParameter('outputBinaryProperty', itemIndex) as string;
						const dl = await downloadToBinary.call(
							this,
							firstUrl,
							action === 'pdf' ? 'h2i.pdf' : `h2i.${(body.format as string) === 'jpeg' ? 'jpg' : body.format ?? 'png'}`,
						);
						const binary = await this.helpers.prepareBinaryData(dl.data, dl.fileName, dl.mimeType);
						out.push({ json: response as any, binary: { [binName]: binary } });
					} else {
						out.push({ json: response as any });
					}
					continue;
				}

				// ---- IMAGE (multipart)
				if (resource === 'image') {
					const action = operation as ImageAction;
					const imageBinaryProps = this.getNodeParameter('imageBinaryProps', itemIndex) as string;
					const format = this.getNodeParameter('imageFormat', itemIndex) as string;
					const formData: Record<string, any> = { action };

					await attachFiles('images', imageBinaryProps, formData);

					const setNumber = (name: string, value: number) => {
						if (value !== undefined && value !== null && value !== 0) formData[name] = String(value);
					};
					const setString = (name: string, value: string) => {
						if (value !== undefined && value !== null && value !== '') formData[name] = value;
					};
					const setBool = (name: string, value: boolean) => {
						formData[name] = toBoolString(value);
					};

					const includePdfFields = () => {
						formData.pdfMode = this.getNodeParameter('pdfMode', itemIndex) as string;
						formData.pdfPageSize = this.getNodeParameter('pdfPageSize', itemIndex) as string;
						formData.pdfOrientation = this.getNodeParameter('pdfOrientation', itemIndex) as string;
						setNumber('pdfMargin', this.getNodeParameter('pdfMargin', itemIndex) as number);
						formData.pdfEmbedFormat = this.getNodeParameter('pdfEmbedFormat', itemIndex) as string;
						setNumber('pdfJpegQuality', this.getNodeParameter('pdfJpegQuality', itemIndex) as number);
					};

					const includeWatermarkFile = async (propName: string) => {
						if (propName) await attachSingleFile('watermarkImage', propName, formData);
					};

					switch (action) {
						case 'format':
							formData.format = format;
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							setNumber('width', this.getNodeParameter('imageWidth', itemIndex) as number);
							setNumber('height', this.getNodeParameter('imageHeight', itemIndex) as number);
							break;
						case 'resize':
							formData.format = format;
							setNumber('width', this.getNodeParameter('imageWidth', itemIndex) as number);
							setNumber('height', this.getNodeParameter('imageHeight', itemIndex) as number);
							setBool('enlarge', this.getNodeParameter('enlarge', itemIndex) as boolean);
							setBool('normalizeOrientation', this.getNodeParameter('normalizeOrientation', itemIndex) as boolean);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'crop':
							formData.format = format;
							setNumber('cropX', this.getNodeParameter('cropX', itemIndex) as number);
							setNumber('cropY', this.getNodeParameter('cropY', itemIndex) as number);
							setNumber('cropWidth', this.getNodeParameter('cropWidth', itemIndex) as number);
							setNumber('cropHeight', this.getNodeParameter('cropHeight', itemIndex) as number);
							setBool('normalizeOrientation', this.getNodeParameter('normalizeOrientation', itemIndex) as boolean);
							setString('backgroundColor', this.getNodeParameter('backgroundColor', itemIndex) as string);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'transform':
							formData.format = format;
							setNumber('rotate', this.getNodeParameter('rotate', itemIndex) as number);
							setBool('flipH', this.getNodeParameter('flipH', itemIndex) as boolean);
							setBool('flipV', this.getNodeParameter('flipV', itemIndex) as boolean);
							formData.colorSpace = this.getNodeParameter('colorSpace', itemIndex) as string;
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'compress':
							formData.format = format;
							setNumber('targetSizeKB', this.getNodeParameter('targetSizeKB', itemIndex) as number);
							setNumber('quality', this.getNodeParameter('quality', itemIndex) as number);
							formData.colorSpace = this.getNodeParameter('colorSpace', itemIndex) as string;
							setString('backgroundColor', this.getNodeParameter('backgroundColor', itemIndex) as string);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'enhance':
							formData.format = format;
							setNumber('blur', this.getNodeParameter('blur', itemIndex) as number);
							setNumber('sharpen', this.getNodeParameter('sharpen', itemIndex) as number);
							setBool('grayscale', this.getNodeParameter('grayscale', itemIndex) as boolean);
							setBool('sepia', this.getNodeParameter('sepia', itemIndex) as boolean);
							setNumber('brightness', this.getNodeParameter('brightness', itemIndex) as number);
							setNumber('contrast', this.getNodeParameter('contrast', itemIndex) as number);
							setNumber('saturation', this.getNodeParameter('saturation', itemIndex) as number);
							setBool('normalizeOrientation', this.getNodeParameter('normalizeOrientation', itemIndex) as boolean);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'padding':
							formData.format = format;
							setNumber('pad', this.getNodeParameter('pad', itemIndex) as number);
							if (this.getNodeParameter('padTop', itemIndex) || this.getNodeParameter('padRight', itemIndex) || this.getNodeParameter('padBottom', itemIndex) || this.getNodeParameter('padLeft', itemIndex)) {
								setNumber('padTop', this.getNodeParameter('padTop', itemIndex) as number);
								setNumber('padRight', this.getNodeParameter('padRight', itemIndex) as number);
								setNumber('padBottom', this.getNodeParameter('padBottom', itemIndex) as number);
								setNumber('padLeft', this.getNodeParameter('padLeft', itemIndex) as number);
							}
							setString('padColor', this.getNodeParameter('padColor', itemIndex) as string);
							setNumber('borderRadius', this.getNodeParameter('borderRadius', itemIndex) as number);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'frame':
							formData.format = format;
							setNumber('border', this.getNodeParameter('border', itemIndex) as number);
							setString('borderColor', this.getNodeParameter('borderColor', itemIndex) as string);
							setNumber('pad', this.getNodeParameter('pad', itemIndex) as number);
							setString('padColor', this.getNodeParameter('padColor', itemIndex) as string);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'background':
							formData.format = format;
							setString('backgroundColor', this.getNodeParameter('backgroundColor', itemIndex) as string);
							setNumber('backgroundBlur', this.getNodeParameter('backgroundBlur', itemIndex) as number);
							setNumber('borderRadius', this.getNodeParameter('borderRadius', itemIndex) as number);
							setString('padColor', this.getNodeParameter('padColor', itemIndex) as string);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'watermark':
							formData.format = format;
							setString('watermarkText', this.getNodeParameter('watermarkText', itemIndex) as string);
							setNumber('watermarkFontSize', this.getNodeParameter('watermarkFontSize', itemIndex) as number);
							setString('watermarkColor', this.getNodeParameter('watermarkColor', itemIndex) as string);
							setNumber('watermarkOpacity', this.getNodeParameter('watermarkOpacity', itemIndex) as number);
							formData.watermarkPosition = this.getNodeParameter('watermarkPosition', itemIndex) as string;
							setNumber('watermarkMargin', this.getNodeParameter('watermarkMargin', itemIndex) as number);
							setNumber('watermarkScale', this.getNodeParameter('watermarkScale', itemIndex) as number);
							await includeWatermarkFile(this.getNodeParameter('watermarkImageBinaryProp', itemIndex) as string);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'pdf':
							formData.format = 'pdf';
							includePdfFields();
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							break;
						case 'metadata':
							setBool('normalizeOrientation', this.getNodeParameter('normalizeOrientation', itemIndex) as boolean);
							setBool('keepMetadata', this.getNodeParameter('keepMetadata', itemIndex) as boolean);
							setBool('includeRawExif', this.getNodeParameter('includeRawExif', itemIndex) as boolean);
							break;
						case 'multitask': {
							const options = (this.getNodeParameter('options', itemIndex, {}) as IDataObject) || {};
							const hasVal = (key: string) => Object.prototype.hasOwnProperty.call(options, key);
							const getOpt = (key: string) => options[key];

							if (hasVal('format')) setString('format', getOpt('format') as string);
							if (hasVal('width')) setNumber('width', Number(getOpt('width')));
							if (hasVal('height')) setNumber('height', Number(getOpt('height')));
							if (hasVal('enlarge')) setBool('enlarge', Boolean(getOpt('enlarge')));
							if (hasVal('normalizeOrientation')) setBool('normalizeOrientation', Boolean(getOpt('normalizeOrientation')));
							if (hasVal('cropX')) setNumber('cropX', Number(getOpt('cropX')));
							if (hasVal('cropY')) setNumber('cropY', Number(getOpt('cropY')));
							if (hasVal('cropWidth')) setNumber('cropWidth', Number(getOpt('cropWidth')));
							if (hasVal('cropHeight')) setNumber('cropHeight', Number(getOpt('cropHeight')));
							if (hasVal('backgroundColor')) setString('backgroundColor', String(getOpt('backgroundColor')));
							if (hasVal('rotate')) setNumber('rotate', Number(getOpt('rotate')));
							if (hasVal('flipH')) setBool('flipH', Boolean(getOpt('flipH')));
							if (hasVal('flipV')) setBool('flipV', Boolean(getOpt('flipV')));
							if (hasVal('colorSpace')) formData.colorSpace = String(getOpt('colorSpace'));
							if (hasVal('targetSizeKB')) setNumber('targetSizeKB', Number(getOpt('targetSizeKB')));
							if (hasVal('quality')) setNumber('quality', Number(getOpt('quality')));
							if (hasVal('keepMetadata')) setBool('keepMetadata', Boolean(getOpt('keepMetadata')));
							if (hasVal('blur')) setNumber('blur', Number(getOpt('blur')));
							if (hasVal('sharpen')) setNumber('sharpen', Number(getOpt('sharpen')));
							if (hasVal('grayscale')) setBool('grayscale', Boolean(getOpt('grayscale')));
							if (hasVal('sepia')) setBool('sepia', Boolean(getOpt('sepia')));
							if (hasVal('brightness')) setNumber('brightness', Number(getOpt('brightness')));
							if (hasVal('contrast')) setNumber('contrast', Number(getOpt('contrast')));
							if (hasVal('saturation')) setNumber('saturation', Number(getOpt('saturation')));
							if (hasVal('pad')) setNumber('pad', Number(getOpt('pad')));
							if (hasVal('padTop')) setNumber('padTop', Number(getOpt('padTop')));
							if (hasVal('padRight')) setNumber('padRight', Number(getOpt('padRight')));
							if (hasVal('padBottom')) setNumber('padBottom', Number(getOpt('padBottom')));
							if (hasVal('padLeft')) setNumber('padLeft', Number(getOpt('padLeft')));
							if (hasVal('padColor')) setString('padColor', String(getOpt('padColor')));
							if (hasVal('borderRadius')) setNumber('borderRadius', Number(getOpt('borderRadius')));
							if (hasVal('border')) setNumber('border', Number(getOpt('border')));
							if (hasVal('borderColor')) setString('borderColor', String(getOpt('borderColor')));
							if (hasVal('backgroundBlur')) setNumber('backgroundBlur', Number(getOpt('backgroundBlur')));
							if (hasVal('watermarkText')) setString('watermarkText', String(getOpt('watermarkText')));
							if (hasVal('watermarkFontSize')) setNumber('watermarkFontSize', Number(getOpt('watermarkFontSize')));
							if (hasVal('watermarkColor')) setString('watermarkColor', String(getOpt('watermarkColor')));
							if (hasVal('watermarkOpacity')) setNumber('watermarkOpacity', Number(getOpt('watermarkOpacity')));
							if (hasVal('watermarkPosition')) formData.watermarkPosition = String(getOpt('watermarkPosition'));
							if (hasVal('watermarkMargin')) setNumber('watermarkMargin', Number(getOpt('watermarkMargin')));
							if (hasVal('watermarkScale')) setNumber('watermarkScale', Number(getOpt('watermarkScale')));
							if (hasVal('pdfMode')) formData.pdfMode = String(getOpt('pdfMode'));
							if (hasVal('pdfPageSize')) formData.pdfPageSize = String(getOpt('pdfPageSize'));
							if (hasVal('pdfOrientation')) formData.pdfOrientation = String(getOpt('pdfOrientation'));
							if (hasVal('pdfMargin')) setNumber('pdfMargin', Number(getOpt('pdfMargin')));
							if (hasVal('pdfEmbedFormat')) formData.pdfEmbedFormat = String(getOpt('pdfEmbedFormat'));
							if (hasVal('pdfJpegQuality')) setNumber('pdfJpegQuality', Number(getOpt('pdfJpegQuality')));
							if (hasVal('includeRawExif')) setBool('includeRawExif', Boolean(getOpt('includeRawExif')));

							const watermarkProp = this.getNodeParameter('watermarkBinaryProperty', itemIndex, '') as string;
							if (watermarkProp) await includeWatermarkFile(watermarkProp);
							break;
						}
					}

					const response = await davixRequest.call(this, {
						method: 'POST',
						url: '/v1/image',
						formData,
						json: true,
					} as IHttpRequestOptions);

					const downloadBinary = ['metadata'].includes(action) ? false : (this.getNodeParameter('imageDownloadBinary', itemIndex) as boolean);
					if (downloadBinary) {
						const firstUrl = gatherFirstUrl(response);
						if (!firstUrl) throw new Error('No URL returned to download.');
						const binName = this.getNodeParameter('imageOutputBinaryProperty', itemIndex) as string;
						const ext = format === 'jpeg' ? 'jpg' : format;
						const dl = await downloadToBinary.call(this, firstUrl, `pixlab-image.${ext}`);
						const binary = await this.helpers.prepareBinaryData(dl.data, dl.fileName, dl.mimeType);
						out.push({ json: response as any, binary: { [binName]: binary } });
					} else {
						out.push({ json: response as any });
					}

					continue;
				}

				// ---- PDF (multipart)
				if (resource === 'pdf') {
					const action = operation as PdfAction;

					const pdfBinaryProps = this.getNodeParameter('pdfBinaryProps', itemIndex) as string;
					const formData: Record<string, any> = { action };
					await attachFiles('files', pdfBinaryProps, formData);

					const setNumber = (name: string, value: number) => {
						if (value !== undefined && value !== null && value !== 0) formData[name] = String(value);
					};
					const setString = (name: string, value: string) => {
						if (value) formData[name] = value;
					};
					const setBool = (name: string, value: boolean) => {
						formData[name] = toBoolString(value);
					};

					if (action === 'merge') {
						setBool('sortByName', this.getNodeParameter('sortByName', itemIndex) as boolean);
					}

					if (action === 'split') {
						setString('ranges', this.getNodeParameter('ranges', itemIndex) as string);
						setString('prefix', this.getNodeParameter('prefix', itemIndex) as string);
					}

					if (action === 'to-images') {
						setString('pages', this.getNodeParameter('pages', itemIndex) as string);
						setString('toFormat', this.getNodeParameter('toFormat', itemIndex) as string);
						setNumber('width', this.getNodeParameter('pdfWidth', itemIndex) as number);
						setNumber('height', this.getNodeParameter('pdfHeight', itemIndex) as number);
						setNumber('dpi', this.getNodeParameter('dpi', itemIndex) as number);
					}

					if (action === 'extract-images') {
						setString('pages', this.getNodeParameter('pages', itemIndex) as string);
						setString('imageFormat', this.getNodeParameter('extractImageFormat', itemIndex) as string);
					}

					if (action === 'watermark') {
						setString('pages', this.getNodeParameter('pages', itemIndex) as string);
						setString('watermarkText', this.getNodeParameter('watermarkText', itemIndex) as string);
						setNumber('watermarkOpacity', this.getNodeParameter('watermarkOpacity', itemIndex) as number);
						setString('watermarkPosition', this.getNodeParameter('watermarkPosition', itemIndex) as string);
						setNumber('watermarkMargin', this.getNodeParameter('watermarkMargin', itemIndex) as number);
						setNumber('watermarkFontSize', this.getNodeParameter('watermarkFontSize', itemIndex) as number);
						setString('watermarkColor', this.getNodeParameter('watermarkColor', itemIndex) as string);
						setNumber('watermarkScale', this.getNodeParameter('watermarkScale', itemIndex) as number);
						await attachSingleFile('watermarkImage', this.getNodeParameter('watermarkImageBinaryProp', itemIndex) as string, formData);
					}

					if (action === 'rotate') {
						setNumber('degrees', this.getNodeParameter('degrees', itemIndex) as number);
						setString('pages', this.getNodeParameter('pages', itemIndex) as string);
					}

					if (action === 'metadata') {
						setString('title', this.getNodeParameter('title', itemIndex) as string);
						setString('author', this.getNodeParameter('author', itemIndex) as string);
						setString('subject', this.getNodeParameter('subject', itemIndex) as string);
						setString('keywords', this.getNodeParameter('keywords', itemIndex) as string);
						setString('creator', this.getNodeParameter('creator', itemIndex) as string);
						setString('producer', this.getNodeParameter('producer', itemIndex) as string);
						setBool('cleanAllMetadata', this.getNodeParameter('cleanAllMetadata', itemIndex) as boolean);
					}

					if (action === 'reorder') {
						setString('order', this.getNodeParameter('order', itemIndex) as string);
					}

					if (action === 'delete-pages') {
						setString('pages', this.getNodeParameter('pages', itemIndex) as string);
					}

					if (action === 'extract') {
						setString('pages', this.getNodeParameter('pages', itemIndex) as string);
						setString('mode', this.getNodeParameter('mode', itemIndex) as string);
						setString('prefix', this.getNodeParameter('prefix', itemIndex) as string);
					}

					if (action === 'flatten') {
						setBool('flattenForms', this.getNodeParameter('flattenForms', itemIndex) as boolean);
					}

					if (action === 'encrypt') {
						setString('userPassword', this.getNodeParameter('userPassword', itemIndex) as string);
						setString('ownerPassword', this.getNodeParameter('ownerPassword', itemIndex) as string);
					}

					if (action === 'decrypt') {
						setString('password', this.getNodeParameter('password', itemIndex) as string);
					}

					const response = await davixRequest.call(this, {
						method: 'POST',
						url: '/v1/pdf',
						formData,
						json: true,
					} as IHttpRequestOptions);

					const downloadBinary = this.getNodeParameter('pdfDownloadBinary', itemIndex) as boolean;
					if (downloadBinary) {
						const firstUrl = gatherFirstUrl(response);
						if (!firstUrl) throw new Error('No URL returned to download.');
						const binName = this.getNodeParameter('pdfOutputBinaryProperty', itemIndex) as string;
						const dl = await downloadToBinary.call(this, firstUrl, `pixlab-pdf-result.bin`);
						const binary = await this.helpers.prepareBinaryData(dl.data, dl.fileName, dl.mimeType);
						out.push({ json: response as any, binary: { [binName]: binary } });
					} else {
						out.push({ json: response as any });
					}

					continue;
				}

				// ---- TOOLS (multipart)
					if (resource === 'tools') {
					const action = operation as ToolsAction;
					const toolsBinaryProps = this.getNodeParameter('toolsBinaryProps', itemIndex) as string;
					const formData: Record<string, any> = { action };
					await attachFiles('images', toolsBinaryProps, formData);

					const setString = (name: string, value: string) => {
						if (value) formData[name] = value;
					};
					const setNumber = (name: string, value: number) => {
						if (value !== undefined && value !== null && value !== 0) formData[name] = String(value);
					};
					const setBool = (name: string, value: boolean) => {
						formData[name] = toBoolString(value);
					};

					let selectedTools: string[] = [];
					if (action === 'single') {
						const tool = this.getNodeParameter('tool', itemIndex) as string;
						if (!tool) throw new Error('Select one tool for single action.');
						selectedTools = [tool];
						formData.tools = tool;
					} else {
						const tools = this.getNodeParameter('tools', itemIndex) as string[];
						selectedTools = tools;
						formData.tools = tools.join(',');
					}

					const toolOptions = (this.getNodeParameter('options', itemIndex, {}) as IDataObject) || {};
					const hasOpt = (key: string) => Object.prototype.hasOwnProperty.call(toolOptions, key);
					const getOpt = (key: string) => toolOptions[key];
					const hasTool = (toolName: string) => selectedTools.includes(toolName);

					if (hasTool('metadata')) {
						if (hasOpt('includeRawExif')) setBool('includeRawExif', Boolean(getOpt('includeRawExif')));
					}

					if (hasTool('palette')) {
						if (hasOpt('paletteSize')) setNumber('paletteSize', Number(getOpt('paletteSize')));
					}

					if (hasTool('hash')) {
						if (hasOpt('hashType')) setString('hashType', String(getOpt('hashType')));
					}

					if (hasTool('quality')) {
						if (hasOpt('qualitySample')) setNumber('qualitySample', Number(getOpt('qualitySample')));
					}

					if (hasTool('transparency')) {
						if (hasOpt('transparencySample')) setNumber('transparencySample', Number(getOpt('transparencySample')));
					}

					if (hasTool('similarity')) {
						if (hasOpt('similarityMode')) setString('similarityMode', String(getOpt('similarityMode')));
						if (hasOpt('similarityThreshold')) setNumber('similarityThreshold', Number(getOpt('similarityThreshold')));
					}

					if (hasTool('efficiency')) {
						if (hasOpt('efficiencyFormat')) setString('efficiencyFormat', String(getOpt('efficiencyFormat')));
						if (hasOpt('efficiencyQuality')) setNumber('efficiencyQuality', Number(getOpt('efficiencyQuality')));
					}

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
