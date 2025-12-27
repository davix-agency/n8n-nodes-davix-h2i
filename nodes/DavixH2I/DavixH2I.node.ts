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
					description: 'Page size to use when exporting to PDF.',
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
					description: 'Orientation for pages in the exported PDF.',
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
					description: 'Margin (in pixels) applied to the exported PDF pages.',
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF Embed Format',
					name: 'pdfEmbedFormat',
					type: 'options',
					default: 'png',
					description: 'Image format embedded inside the generated PDF.',
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
					description: 'JPEG quality used when embedding images into the PDF.',
					displayOptions: { show: { resource: ['image'], operation: ['pdf'] } },
				},
					{ displayName: 'Include Raw EXIF', name: 'includeRawExif', type: 'boolean', default: false, description: 'Include raw EXIF data when available.', displayOptions: { show: { resource: ['image'], operation: ['metadata'] } } },
				{
					displayName: 'Actions',
					name: 'actions',
					type: 'multiOptions',
					default: [],
					description: 'Select one or more actions. Each action reveals its own parameter group below.',
					displayOptions: { show: { resource: ['image'], operation: ['multitask'] } },
					options: [
						{ name: 'Format', value: 'format' },
						{ name: 'Resize', value: 'resize' },
						{ name: 'Crop', value: 'crop' },
						{ name: 'Transform', value: 'transform' },
						{ name: 'Compress', value: 'compress' },
						{ name: 'Enhance', value: 'enhance' },
						{ name: 'Frame', value: 'frame' },
						{ name: 'Background', value: 'background' },
						{ name: 'Watermark', value: 'watermark' },
					],
				},
				{
					displayName: 'Format',
					name: 'multitaskFormat',
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
					displayOptions: {
						show: {
							resource: ['image'],
							operation: ['multitask'],
							actions: ['format', 'resize', 'crop', 'transform', 'compress', 'enhance', 'frame', 'background', 'watermark'],
						},
					},
				},
				{
					displayName: 'Keep Metadata',
					name: 'multitaskKeepMetadata',
					type: 'boolean',
					default: false,
					description: 'Preserve EXIF/metadata for the multitask request when possible.',
					displayOptions: {
						show: {
							resource: ['image'],
							operation: ['multitask'],
							actions: ['format', 'resize', 'crop', 'transform', 'compress', 'enhance', 'frame', 'background', 'watermark'],
						},
					},
				},
				{
					displayName: 'Action Parameters',
					name: 'imageActionParams',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add action parameters',
					description: 'Parameters for each selected action.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['image'], operation: ['multitask'] } },
					options: [
						{
							name: 'format',
							displayName: 'Format',
							values: [
								{ displayName: 'Width', name: 'formatWidthMulti', type: 'number', default: 0, description: 'Resize width in pixels for format.' },
								{ displayName: 'Height', name: 'formatHeightMulti', type: 'number', default: 0, description: 'Resize height in pixels for format.' },
							],
						},
						{
							name: 'resize',
							displayName: 'Resize',
							values: [
								{ displayName: 'Width', name: 'resizeWidthMulti', type: 'number', default: 0, description: 'Resize width in pixels.' },
								{ displayName: 'Height', name: 'resizeHeightMulti', type: 'number', default: 0, description: 'Resize height in pixels.' },
								{ displayName: 'Enlarge', name: 'resizeEnlargeMulti', type: 'boolean', default: false, description: 'Allow upscaling when resizing.' },
								{ displayName: 'Normalize Orientation', name: 'resizeNormalizeOrientationMulti', type: 'boolean', default: false, description: 'Auto-rotate based on EXIF orientation.' },
							],
						},
						{
							name: 'crop',
							displayName: 'Crop',
							values: [
								{ displayName: 'Crop X', name: 'cropXMulti', type: 'number', default: 0, description: 'Left offset for crop.' },
								{ displayName: 'Crop Y', name: 'cropYMulti', type: 'number', default: 0, description: 'Top offset for crop.' },
								{ displayName: 'Crop Width', name: 'cropWidthMulti', type: 'number', default: 0, description: 'Crop width in pixels.' },
								{ displayName: 'Crop Height', name: 'cropHeightMulti', type: 'number', default: 0, description: 'Crop height in pixels.' },
								{ displayName: 'Normalize Orientation', name: 'cropNormalizeOrientationMulti', type: 'boolean', default: false, description: 'Auto-rotate before cropping based on EXIF orientation.' },
								{ displayName: 'Background Color', name: 'cropBackgroundColorMulti', type: 'string', default: '', description: 'Background color used when the crop exceeds bounds.' },
							],
						},
						{
							name: 'transform',
							displayName: 'Transform',
							values: [
								{ displayName: 'Rotate (degrees)', name: 'transformRotateMulti', type: 'number', default: 0, description: 'Rotate image by degrees.' },
								{ displayName: 'Flip Horizontal', name: 'transformFlipHMulti', type: 'boolean', default: false, description: 'Flip image horizontally.' },
								{ displayName: 'Flip Vertical', name: 'transformFlipVMulti', type: 'boolean', default: false, description: 'Flip image vertically.' },
								{
									displayName: 'Color Space',
									name: 'transformColorSpaceMulti',
									type: 'options',
									default: 'srgb',
									description: 'Color space to use for transforms.',
									options: [
										{ name: 'sRGB', value: 'srgb' },
										{ name: 'Display P3', value: 'display-p3' },
									],
								},
							],
						},
						{
							name: 'compress',
							displayName: 'Compress',
							values: [
								{ displayName: 'Quality', name: 'compressQualityMulti', type: 'number', default: 82, description: 'Output quality (1-100).' },
								{ displayName: 'Target Size (KB)', name: 'compressTargetSizeKBMulti', type: 'number', default: 0, description: 'Target compressed size in KB.' },
								{ displayName: 'Background Color', name: 'compressBackgroundColorMulti', type: 'string', default: '', description: 'Background color used for compression fills.' },
								{
									displayName: 'Color Space',
									name: 'compressColorSpaceMulti',
									type: 'options',
									default: 'srgb',
									description: 'Color space to use for compression.',
									options: [
										{ name: 'sRGB', value: 'srgb' },
										{ name: 'Display P3', value: 'display-p3' },
									],
								},
							],
						},
						{
							name: 'enhance',
							displayName: 'Enhance',
							values: [
								{ displayName: 'Blur', name: 'enhanceBlurMulti', type: 'number', default: 0, description: 'Blur radius.' },
								{ displayName: 'Sharpen', name: 'enhanceSharpenMulti', type: 'number', default: 0, description: 'Sharpen amount.' },
								{ displayName: 'Grayscale', name: 'enhanceGrayscaleMulti', type: 'boolean', default: false, description: 'Convert to grayscale.' },
								{ displayName: 'Sepia', name: 'enhanceSepiaMulti', type: 'boolean', default: false, description: 'Apply sepia tone.' },
								{ displayName: 'Brightness', name: 'enhanceBrightnessMulti', type: 'number', default: 0, description: 'Brightness adjustment (-100 to 100).' },
								{ displayName: 'Contrast', name: 'enhanceContrastMulti', type: 'number', default: 0, description: 'Contrast adjustment (-100 to 100).' },
								{ displayName: 'Saturation', name: 'enhanceSaturationMulti', type: 'number', default: 0, description: 'Saturation adjustment (-100 to 100).' },
								{ displayName: 'Normalize Orientation', name: 'enhanceNormalizeOrientationMulti', type: 'boolean', default: false, description: 'Auto-rotate based on EXIF orientation before enhancing.' },
							],
						},
						{
							name: 'frame',
							displayName: 'Frame',
							values: [
								{ displayName: 'Pad', name: 'framePadMulti', type: 'number', default: 0, description: 'Uniform padding size.' },
								{ displayName: 'Pad Color', name: 'framePadColorMulti', type: 'string', default: '', description: 'Padding color (e.g. #ffffff).' },
								{ displayName: 'Border', name: 'frameBorderMulti', type: 'number', default: 0, description: 'Border thickness in pixels.' },
								{ displayName: 'Border Color', name: 'frameBorderColorMulti', type: 'string', default: '', description: 'Border color (e.g. #000000).' },
								{ displayName: 'Border Radius', name: 'frameBorderRadiusMulti', type: 'number', default: 0, description: 'Rounded corner radius.' },
							],
						},
						{
							name: 'background',
							displayName: 'Background',
							values: [
								{ displayName: 'Background Color', name: 'backgroundColorMulti', type: 'string', default: '', description: 'Background color to apply.' },
								{ displayName: 'Background Blur', name: 'backgroundBlurMulti', type: 'number', default: 0, description: 'Blur background by this radius.' },
								{ displayName: 'Border Radius', name: 'backgroundBorderRadiusMulti', type: 'number', default: 0, description: 'Rounded corner radius.' },
								{ displayName: 'Pad Color', name: 'backgroundPadColorMulti', type: 'string', default: '', description: 'Padding color for background.' },
							],
						},
						{
							name: 'watermark',
							displayName: 'Watermark',
							values: [
								{ displayName: 'Watermark Text', name: 'watermarkTextMulti', type: 'string', default: '', description: 'Text watermark content.' },
								{ displayName: 'Watermark Opacity', name: 'watermarkOpacityMulti', type: 'number', default: 0.35, description: 'Watermark opacity (0-1).' },
								{
									displayName: 'Watermark Position',
									name: 'watermarkPositionMulti',
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
								{ displayName: 'Watermark Margin', name: 'watermarkMarginMulti', type: 'number', default: 8, description: 'Margin/padding around watermark.' },
								{ displayName: 'Watermark Scale', name: 'watermarkScaleMulti', type: 'number', default: 1, description: 'Scale factor for watermark.' },
								{ displayName: 'Watermark Color', name: 'watermarkColorMulti', type: 'string', default: '#000000', description: 'Color for text watermark.' },
								{ displayName: 'Watermark Font Size', name: 'watermarkFontSizeMulti', type: 'number', default: 24, description: 'Font size for text watermark.' },
								{
									displayName: 'Watermark Image Binary Property',
									name: 'watermarkImageBinaryProperty',
									type: 'string',
									default: '',
									placeholder: 'watermarkImage',
									description: 'Binary property containing an image watermark (optional).',
								},
							],
						},
					],
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
					// Single-tool parameters grouped to keep property keys unique
					displayName: 'Tool Parameters (Single)',
					name: 'toolParametersSingle',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add tool parameters',
					description: 'Parameters for the selected tool.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['tools'], operation: ['single'] } },
					options: [
						{
							name: 'metadata',
							displayName: 'Metadata',
							values: [{ displayName: 'Include Raw EXIF', name: 'metadataIncludeRawExifSingle', type: 'boolean', default: false, description: 'Include raw EXIF data when available.' }],
						},
						{
							name: 'palette',
							displayName: 'Palette',
							values: [{ displayName: 'Palette Size', name: 'paletteSizeSingle', type: 'number', default: 5, description: 'Number of colors to extract.' }],
						},
						{
							name: 'hash',
							displayName: 'Hash',
							values: [
								{
									displayName: 'Hash Type',
									name: 'hashTypeSingle',
									type: 'options',
									default: 'phash',
									description: 'Hash algorithm to compute.',
									options: [
										{ name: 'pHash', value: 'phash' },
										{ name: 'MD5', value: 'md5' },
										{ name: 'SHA1', value: 'sha1' },
									],
								},
							],
						},
						{
							name: 'similarity',
							displayName: 'Similarity',
							values: [
								{ displayName: 'Similarity Mode', name: 'similarityModeSingle', type: 'string', default: '', description: 'Similarity mode.' },
								{ displayName: 'Similarity Threshold', name: 'similarityThresholdSingle', type: 'number', default: 0, description: 'Similarity threshold.' },
							],
						},
						{
							name: 'quality',
							displayName: 'Quality',
							values: [{ displayName: 'Quality Sample', name: 'qualitySampleSingle', type: 'number', default: 0, description: 'Sample size for quality analysis.' }],
						},
						{
							name: 'transparency',
							displayName: 'Transparency',
							values: [{ displayName: 'Transparency Sample', name: 'transparencySampleSingle', type: 'number', default: 0, description: 'Sample size for transparency analysis.' }],
						},
						{
							name: 'efficiency',
							displayName: 'Efficiency',
							values: [
								{ displayName: 'Efficiency Format', name: 'efficiencyFormatSingle', type: 'string', default: '', description: 'Output format for efficiency tool.' },
								{ displayName: 'Efficiency Quality', name: 'efficiencyQualitySingle', type: 'number', default: 0, description: 'Quality setting for efficiency tool.' },
							],
						},
					],
				},
				{
					// Multitask tool parameters grouped to keep property keys unique
					displayName: 'Tool Parameters (Multitask)',
					name: 'toolParametersMulti',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add tool parameters',
					description: 'Parameters for selected tools in multitask.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'] } },
					options: [
						{
							name: 'metadata',
							displayName: 'Metadata',
							values: [{ displayName: 'Include Raw EXIF', name: 'metadataIncludeRawExifMulti', type: 'boolean', default: false, description: 'Include raw EXIF data when available.' }],
						},
						{
							name: 'palette',
							displayName: 'Palette',
							values: [{ displayName: 'Palette Size', name: 'paletteSizeMulti', type: 'number', default: 5, description: 'Number of colors to extract.' }],
						},
						{
							name: 'hash',
							displayName: 'Hash',
							values: [
								{
									displayName: 'Hash Type',
									name: 'hashTypeMulti',
									type: 'options',
									default: 'phash',
									description: 'Hash algorithm to compute.',
									options: [
										{ name: 'pHash', value: 'phash' },
										{ name: 'MD5', value: 'md5' },
										{ name: 'SHA1', value: 'sha1' },
									],
								},
							],
						},
						{
							name: 'similarity',
							displayName: 'Similarity',
							values: [
								{ displayName: 'Similarity Mode', name: 'similarityModeMulti', type: 'string', default: '', description: 'Similarity mode.' },
								{ displayName: 'Similarity Threshold', name: 'similarityThresholdMulti', type: 'number', default: 0, description: 'Similarity threshold.' },
							],
						},
						{
							name: 'quality',
							displayName: 'Quality',
							values: [{ displayName: 'Quality Sample', name: 'qualitySampleMulti', type: 'number', default: 0, description: 'Sample size for quality analysis.' }],
						},
						{
							name: 'transparency',
							displayName: 'Transparency',
							values: [{ displayName: 'Transparency Sample', name: 'transparencySampleMulti', type: 'number', default: 0, description: 'Sample size for transparency analysis.' }],
						},
						{
							name: 'efficiency',
							displayName: 'Efficiency',
							values: [
								{ displayName: 'Efficiency Format', name: 'efficiencyFormatMulti', type: 'string', default: '', description: 'Output format for efficiency tool.' },
								{ displayName: 'Efficiency Quality', name: 'efficiencyQualityMulti', type: 'number', default: 0, description: 'Quality setting for efficiency tool.' },
							],
						},
					],
				},
				{
					displayName: 'Similarity Parameters (Multitask)',
					name: 'similarityParametersMulti',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add similarity parameters',
					description: 'Similarity tool options for multitask.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['similarity'] } },
					options: [
						{
							name: 'parameters',
							displayName: 'Parameters',
							values: [
								{ displayName: 'Similarity Mode', name: 'similarityMode', type: 'string', default: '', description: 'Similarity mode.' },
								{ displayName: 'Similarity Threshold', name: 'similarityThreshold', type: 'number', default: 0, description: 'Similarity threshold.' },
							],
						},
					],
				},
				{
					displayName: 'Quality Parameters (Multitask)',
					name: 'qualityParametersMulti',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add quality parameters',
					description: 'Quality tool options for multitask.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['quality'] } },
					options: [
						{
							name: 'parameters',
							displayName: 'Parameters',
							values: [{ displayName: 'Quality Sample', name: 'qualitySample', type: 'number', default: 0, description: 'Sample size for quality analysis.' }],
						},
					],
				},
				{
					displayName: 'Transparency Parameters (Multitask)',
					name: 'transparencyParametersMulti',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add transparency parameters',
					description: 'Transparency tool options for multitask.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['transparency'] } },
					options: [
						{
							name: 'parameters',
							displayName: 'Parameters',
							values: [{ displayName: 'Transparency Sample', name: 'transparencySample', type: 'number', default: 0, description: 'Sample size for transparency analysis.' }],
						},
					],
				},
				{
					displayName: 'Efficiency Parameters (Multitask)',
					name: 'efficiencyParametersMulti',
					type: 'fixedCollection',
					default: {},
					placeholder: 'Add efficiency parameters',
					description: 'Efficiency tool options for multitask.',
					typeOptions: { multipleValues: false },
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['efficiency'] } },
					options: [
						{
							name: 'parameters',
							displayName: 'Parameters',
							values: [
								{ displayName: 'Efficiency Format', name: 'efficiencyFormat', type: 'string', default: '', description: 'Output format for efficiency tool.' },
								{ displayName: 'Efficiency Quality', name: 'efficiencyQuality', type: 'number', default: 0, description: 'Quality setting for efficiency tool.' },
							],
						},
					],
				},
				{
					displayName: 'Similarity Tool',
					name: 'similarityToolNoticeMulti',
					type: 'notice',
					default: '────────── Similarity tool ──────────',
					description: 'Parameters for the Similarity tool.',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['similarity'] } },
				},
				{ displayName: 'Similarity Mode', name: 'similarityModeMulti', type: 'string', default: '', description: 'Similarity mode (similarity tool).', displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['similarity'] } } },
				{ displayName: 'Similarity Threshold', name: 'similarityThresholdMulti', type: 'number', default: 0, description: 'Similarity threshold (similarity tool).', displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['similarity'] } } },
				{
					displayName: 'Quality Tool',
					name: 'qualityToolNoticeMulti',
					type: 'notice',
					default: '────────── Quality tool ──────────',
					description: 'Parameters for the Quality tool.',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['quality'] } },
				},
				{ displayName: 'Quality Sample', name: 'qualitySampleMulti', type: 'number', default: 0, description: 'Sample size for quality analysis.', displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['quality'] } } },
				{
					displayName: 'Transparency Tool',
					name: 'transparencyToolNoticeMulti',
					type: 'notice',
					default: '────────── Transparency tool ──────────',
					description: 'Parameters for the Transparency tool.',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['transparency'] } },
				},
				{ displayName: 'Transparency Sample', name: 'transparencySampleMulti', type: 'number', default: 0, description: 'Sample size for transparency analysis.', displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['transparency'] } } },
				{
					displayName: 'Efficiency Tool',
					name: 'efficiencyToolNoticeMulti',
					type: 'notice',
					default: '────────── Efficiency tool ──────────',
					description: 'Parameters for the Efficiency tool.',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['efficiency'] } },
				},
				{ displayName: 'Efficiency Format', name: 'efficiencyFormatMulti', type: 'string', default: '', description: 'Output format for efficiency tool.', displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['efficiency'] } } },
				{ displayName: 'Efficiency Quality', name: 'efficiencyQualityMulti', type: 'number', default: 0, description: 'Quality setting for efficiency tool.', displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['efficiency'] } } },
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
							const selectedActions = (this.getNodeParameter('actions', itemIndex, []) as string[]) || [];
							if (selectedActions.length === 0) throw new Error('Select at least one action for multitask.');

							const setNumberOnce = (name: string, value: number) => {
								if (value !== undefined && value !== null && value !== 0 && formData[name] === undefined) formData[name] = String(value);
							};
							const setStringOnce = (name: string, value: string) => {
								if (value && formData[name] === undefined) formData[name] = value;
							};
							const setBoolOnce = (name: string, value: boolean) => {
								if (value !== undefined && value !== null && formData[name] === undefined) formData[name] = toBoolString(value);
							};

							setStringOnce('format', this.getNodeParameter('multitaskFormat', itemIndex) as string);
							setBoolOnce('keepMetadata', this.getNodeParameter('multitaskKeepMetadata', itemIndex) as boolean);

							for (const a of selectedActions) {
								switch (a) {
									case 'format':
										{
											const params = (this.getNodeParameter('imageActionParams.format', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('width', Number(params.formatWidthMulti ?? 0));
											setNumberOnce('height', Number(params.formatHeightMulti ?? 0));
										}
										break;
									case 'resize':
										{
											const params = (this.getNodeParameter('imageActionParams.resize', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('width', Number(params.resizeWidthMulti ?? 0));
											setNumberOnce('height', Number(params.resizeHeightMulti ?? 0));
											setBoolOnce('enlarge', Boolean(params.resizeEnlargeMulti));
											setBoolOnce('normalizeOrientation', Boolean(params.resizeNormalizeOrientationMulti));
										}
										break;
									case 'crop':
										{
											const params = (this.getNodeParameter('imageActionParams.crop', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('cropX', Number(params.cropXMulti ?? 0));
											setNumberOnce('cropY', Number(params.cropYMulti ?? 0));
											setNumberOnce('cropWidth', Number(params.cropWidthMulti ?? 0));
											setNumberOnce('cropHeight', Number(params.cropHeightMulti ?? 0));
											setBoolOnce('normalizeOrientation', Boolean(params.cropNormalizeOrientationMulti));
											setStringOnce('backgroundColor', String(params.cropBackgroundColorMulti ?? ''));
										}
										break;
									case 'transform':
										{
											const params = (this.getNodeParameter('imageActionParams.transform', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('rotate', Number(params.transformRotateMulti ?? 0));
											setBoolOnce('flipH', Boolean(params.transformFlipHMulti));
											setBoolOnce('flipV', Boolean(params.transformFlipVMulti));
											setStringOnce('colorSpace', String(params.transformColorSpaceMulti ?? ''));
										}
										break;
									case 'compress':
										{
											const params = (this.getNodeParameter('imageActionParams.compress', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('quality', Number(params.compressQualityMulti ?? 0));
											setNumberOnce('targetSizeKB', Number(params.compressTargetSizeKBMulti ?? 0));
											setStringOnce('backgroundColor', String(params.compressBackgroundColorMulti ?? ''));
											setStringOnce('colorSpace', String(params.compressColorSpaceMulti ?? ''));
										}
										break;
									case 'enhance':
										{
											const params = (this.getNodeParameter('imageActionParams.enhance', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('blur', Number(params.enhanceBlurMulti ?? 0));
											setNumberOnce('sharpen', Number(params.enhanceSharpenMulti ?? 0));
											setBoolOnce('grayscale', Boolean(params.enhanceGrayscaleMulti));
											setBoolOnce('sepia', Boolean(params.enhanceSepiaMulti));
											setNumberOnce('brightness', Number(params.enhanceBrightnessMulti ?? 0));
											setNumberOnce('contrast', Number(params.enhanceContrastMulti ?? 0));
											setNumberOnce('saturation', Number(params.enhanceSaturationMulti ?? 0));
											setBoolOnce('normalizeOrientation', Boolean(params.enhanceNormalizeOrientationMulti));
										}
										break;
									case 'frame':
										{
											const params = (this.getNodeParameter('imageActionParams.frame', itemIndex, {}) as IDataObject) || {};
											setNumberOnce('pad', Number(params.framePadMulti ?? 0));
											setStringOnce('padColor', String(params.framePadColorMulti ?? ''));
											setNumberOnce('border', Number(params.frameBorderMulti ?? 0));
											setStringOnce('borderColor', String(params.frameBorderColorMulti ?? ''));
											setNumberOnce('borderRadius', Number(params.frameBorderRadiusMulti ?? 0));
										}
										break;
									case 'background':
										{
											const params = (this.getNodeParameter('imageActionParams.background', itemIndex, {}) as IDataObject) || {};
											setStringOnce('backgroundColor', String(params.backgroundColorMulti ?? ''));
											setNumberOnce('backgroundBlur', Number(params.backgroundBlurMulti ?? 0));
											setNumberOnce('borderRadius', Number(params.backgroundBorderRadiusMulti ?? 0));
											setStringOnce('padColor', String(params.backgroundPadColorMulti ?? ''));
										}
										break;
									case 'watermark':
										{
											const params = (this.getNodeParameter('imageActionParams.watermark', itemIndex, {}) as IDataObject) || {};
											setStringOnce('watermarkText', String(params.watermarkTextMulti ?? ''));
											setNumberOnce('watermarkOpacity', Number(params.watermarkOpacityMulti ?? 0));
											formData.watermarkPosition = formData.watermarkPosition ?? (params.watermarkPositionMulti as string);
											setNumberOnce('watermarkMargin', Number(params.watermarkMarginMulti ?? 0));
											setNumberOnce('watermarkScale', Number(params.watermarkScaleMulti ?? 0));
											setStringOnce('watermarkColor', String(params.watermarkColorMulti ?? ''));
											setNumberOnce('watermarkFontSize', Number(params.watermarkFontSizeMulti ?? 0));
											await includeWatermarkFile(String(params.watermarkImageBinaryProperty ?? ''));
										}
										break;
								}
							}
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

					const hasTool = (toolName: string) => selectedTools.includes(toolName);
					const getParams = (path: string) => (this.getNodeParameter(path, itemIndex, {}) as IDataObject) || {};

					if (hasTool('metadata')) {
						const params =
							action === 'single'
								? getParams('toolParametersSingle.metadata')
								: getParams('toolParametersMulti.metadata');
						if (params.metadataIncludeRawExifSingle ?? params.metadataIncludeRawExifMulti)
							setBool('includeRawExif', Boolean(params.metadataIncludeRawExifSingle ?? params.metadataIncludeRawExifMulti));
					}

					if (hasTool('palette')) {
						const params =
							action === 'single' ? getParams('toolParametersSingle.palette') : getParams('toolParametersMulti.palette');
						const val = params.paletteSizeSingle ?? params.paletteSizeMulti;
						if (val) setNumber('paletteSize', Number(val));
					}

					if (hasTool('hash')) {
						const params = action === 'single' ? getParams('toolParametersSingle.hash') : getParams('toolParametersMulti.hash');
						const val = params.hashTypeSingle ?? params.hashTypeMulti;
						if (val) setString('hashType', String(val));
					}

					if (hasTool('quality')) {
						const params =
							action === 'single' ? getParams('toolParametersSingle.quality') : getParams('toolParametersMulti.quality');
						const val = params.qualitySampleSingle ?? params.qualitySampleMulti;
						if (val) setNumber('qualitySample', Number(val));
					}

					if (hasTool('transparency')) {
						const params =
							action === 'single'
								? getParams('toolParametersSingle.transparency')
								: getParams('toolParametersMulti.transparency');
						const val = params.transparencySampleSingle ?? params.transparencySampleMulti;
						if (val) setNumber('transparencySample', Number(val));
					}

					if (hasTool('similarity')) {
						const params =
							action === 'single'
								? getParams('toolParametersSingle.similarity')
								: getParams('toolParametersMulti.similarity');
						const mode = params.similarityModeSingle ?? params.similarityModeMulti;
						const threshold = params.similarityThresholdSingle ?? params.similarityThresholdMulti;
						if (mode) setString('similarityMode', String(mode));
						if (threshold) setNumber('similarityThreshold', Number(threshold));
					}

					if (hasTool('efficiency')) {
						const params =
							action === 'single'
								? getParams('toolParametersSingle.efficiency')
								: getParams('toolParametersMulti.efficiency');
						const formatVal = params.efficiencyFormatSingle ?? params.efficiencyFormatMulti;
						const qualityVal = params.efficiencyQualitySingle ?? params.efficiencyQualityMulti;
						if (formatVal) setString('efficiencyFormat', String(formatVal));
						if (qualityVal) setNumber('efficiencyQuality', Number(qualityVal));
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
