import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
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
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'CSS',
					name: 'css',
					type: 'string',
					default: '',
					typeOptions: { rows: 4 },
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Width',
					name: 'width',
					type: 'number',
					default: 1000,
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Height',
					name: 'height',
					type: 'number',
					default: 1500,
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
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
					displayOptions: { show: { resource: ['h2i'], operation: ['image'] } },
				},
				{
					displayName: 'PDF Page Size',
					name: 'h2iPdfPageSize',
					type: 'options',
					default: 'auto',
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
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'PDF Embed Format',
					name: 'h2iPdfEmbedFormat',
					type: 'options',
					default: 'png',
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
					displayOptions: { show: { resource: ['h2i'], operation: ['pdf'] } },
				},
				{
					displayName: 'Download Result as Binary',
					name: 'downloadBinary',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['h2i'], operation: ['image', 'pdf'] } },
				},
				{
					displayName: 'Output Binary Property',
					name: 'outputBinaryProperty',
					type: 'string',
					default: 'data',
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
						'Comma-separated binary property names from previous nodes (each will be sent as an `images` file).',
					displayOptions: { show: { resource: ['image'] } },
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
					displayOptions: { show: { resource: ['image'] }, hide: { operation: ['multitask'] } },
				},
				{ displayName: 'Width', name: 'imageWidth', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['resize', 'format'] } } },
				{ displayName: 'Height', name: 'imageHeight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['resize', 'format'] } } },
				{ displayName: 'Enlarge', name: 'enlarge', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['resize'] } } },
				{ displayName: 'Normalize Orientation', name: 'normalizeOrientation', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['resize', 'crop', 'enhance', 'metadata'] } } },
				{ displayName: 'Crop X', name: 'cropX', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Crop Y', name: 'cropY', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Crop Width', name: 'cropWidth', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Crop Height', name: 'cropHeight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['crop'] } } },
				{ displayName: 'Background Color', name: 'backgroundColor', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['crop', 'compress', 'background'] } } },
				{ displayName: 'Rotate (degrees)', name: 'rotate', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
				{ displayName: 'Flip Horizontal', name: 'flipH', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
				{ displayName: 'Flip Vertical', name: 'flipV', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['transform'] } } },
				{ displayName: 'Color Space', name: 'colorSpace', type: 'options', default: 'srgb', options: [{ name: 'sRGB', value: 'srgb' }, { name: 'Display P3', value: 'display-p3' }], displayOptions: { show: { resource: ['image'], operation: ['transform', 'compress'] } } },
				{ displayName: 'Target Size (KB)', name: 'targetSizeKB', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['compress'] } } },
				{ displayName: 'Quality', name: 'quality', type: 'number', default: 82, displayOptions: { show: { resource: ['image'], operation: ['compress'] } } },
				{
					displayName: 'Keep Metadata',
					name: 'keepMetadata',
					type: 'boolean',
					default: false,
					displayOptions: {
						show: {
							resource: ['image'],
							operation: ['format', 'resize', 'crop', 'transform', 'compress', 'enhance', 'padding', 'frame', 'background', 'watermark', 'pdf', 'metadata'],
						},
					},
				},
				{ displayName: 'Blur', name: 'blur', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Sharpen', name: 'sharpen', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Grayscale', name: 'grayscale', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Sepia', name: 'sepia', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Brightness', name: 'brightness', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Contrast', name: 'contrast', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Saturation', name: 'saturation', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['enhance'] } } },
				{ displayName: 'Pad', name: 'pad', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['padding', 'frame'] } } },
				{ displayName: 'Pad Top', name: 'padTop', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Right', name: 'padRight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Bottom', name: 'padBottom', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Left', name: 'padLeft', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['padding'] } } },
				{ displayName: 'Pad Color', name: 'padColor', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['padding', 'frame', 'background'] } } },
				{ displayName: 'Border', name: 'border', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['frame'] } } },
				{ displayName: 'Border Color', name: 'borderColor', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['frame'] } } },
				{ displayName: 'Border Radius', name: 'borderRadius', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['padding', 'background'] } } },
				{ displayName: 'Background Blur', name: 'backgroundBlur', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['background'] } } },
				{ displayName: 'Watermark Text', name: 'watermarkText', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Font Size', name: 'watermarkFontSize', type: 'number', default: 24, displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Color', name: 'watermarkColor', type: 'string', default: '#000000', displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Opacity', name: 'watermarkOpacity', type: 'number', default: 0.35, displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
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
					displayOptions: { show: { resource: ['image'], operation: ['watermark'] } },
				},
				{ displayName: 'Watermark Margin', name: 'watermarkMargin', type: 'number', default: 8, displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Scale', name: 'watermarkScale', type: 'number', default: 1, displayOptions: { show: { resource: ['image'], operation: ['watermark'] } } },
				{
					displayName: 'Watermark Image Binary Property',
					name: 'watermarkImageBinaryProp',
					type: 'string',
					default: '',
					placeholder: 'watermarkImage',
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
				{ displayName: 'Include Raw EXIF', name: 'includeRawExif', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['metadata'] } } },
				{
					displayName: 'Multitask Options',
					name: 'imageMultitaskOptions',
					type: 'multiOptions',
					default: [],
					options: [
						{ name: 'Format', value: 'format' },
						{ name: 'Width', value: 'width' },
						{ name: 'Height', value: 'height' },
						{ name: 'Enlarge', value: 'enlarge' },
						{ name: 'Normalize Orientation', value: 'normalizeOrientation' },
						{ name: 'Crop', value: 'crop' },
						{ name: 'Background Color', value: 'backgroundColor' },
						{ name: 'Rotate', value: 'rotate' },
						{ name: 'Flip Horizontal', value: 'flipH' },
						{ name: 'Flip Vertical', value: 'flipV' },
						{ name: 'Color Space', value: 'colorSpace' },
						{ name: 'Target Size (KB)', value: 'targetSizeKB' },
						{ name: 'Quality', value: 'quality' },
						{ name: 'Keep Metadata', value: 'keepMetadata' },
						{ name: 'Blur', value: 'blur' },
						{ name: 'Sharpen', value: 'sharpen' },
						{ name: 'Grayscale', value: 'grayscale' },
						{ name: 'Sepia', value: 'sepia' },
						{ name: 'Brightness', value: 'brightness' },
						{ name: 'Contrast', value: 'contrast' },
						{ name: 'Saturation', value: 'saturation' },
						{ name: 'Pad', value: 'pad' },
						{ name: 'Pad Sides', value: 'padSides' },
						{ name: 'Pad Color', value: 'padColor' },
						{ name: 'Border', value: 'border' },
						{ name: 'Border Color', value: 'borderColor' },
						{ name: 'Border Radius', value: 'borderRadius' },
						{ name: 'Background Blur', value: 'backgroundBlur' },
						{ name: 'Watermark', value: 'watermark' },
						{ name: 'PDF Options', value: 'pdf' },
						{ name: 'Include Raw EXIF', value: 'includeRawExif' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'] } },
				},

				// Conditional image fields for multitask
				{
					displayName: 'Format',
					name: 'multiFormat',
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
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['format'] } },
				},
				{ displayName: 'Width', name: 'multiWidth', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['width'] } } },
				{ displayName: 'Height', name: 'multiHeight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['height'] } } },
				{ displayName: 'Enlarge', name: 'multiEnlarge', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['enlarge'] } } },
				{
					displayName: 'Normalize Orientation',
					name: 'multiNormalizeOrientation',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['normalizeOrientation'] } },
				},
				{ displayName: 'Crop X', name: 'multiCropX', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['crop'] } } },
				{ displayName: 'Crop Y', name: 'multiCropY', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['crop'] } } },
				{ displayName: 'Crop Width', name: 'multiCropWidth', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['crop'] } } },
				{ displayName: 'Crop Height', name: 'multiCropHeight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['crop'] } } },
				{ displayName: 'Background Color', name: 'multiBackgroundColor', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['backgroundColor'] } } },
				{ displayName: 'Rotate (degrees)', name: 'multiRotate', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['rotate'] } } },
				{ displayName: 'Flip Horizontal', name: 'multiFlipH', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['flipH'] } } },
				{ displayName: 'Flip Vertical', name: 'multiFlipV', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['flipV'] } } },
				{
					displayName: 'Color Space',
					name: 'multiColorSpace',
					type: 'options',
					default: 'srgb',
					options: [{ name: 'sRGB', value: 'srgb' }, { name: 'Display P3', value: 'display-p3' }],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['colorSpace'] } },
				},
				{ displayName: 'Target Size (KB)', name: 'multiTargetSizeKB', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['targetSizeKB'] } } },
				{ displayName: 'Quality', name: 'multiQuality', type: 'number', default: 82, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['quality'] } } },
				{
					displayName: 'Keep Metadata',
					name: 'multiKeepMetadata',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['keepMetadata'] } },
				},
				{ displayName: 'Blur', name: 'multiBlur', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['blur'] } } },
				{ displayName: 'Sharpen', name: 'multiSharpen', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['sharpen'] } } },
				{ displayName: 'Grayscale', name: 'multiGrayscale', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['grayscale'] } } },
				{ displayName: 'Sepia', name: 'multiSepia', type: 'boolean', default: false, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['sepia'] } } },
				{ displayName: 'Brightness', name: 'multiBrightness', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['brightness'] } } },
				{ displayName: 'Contrast', name: 'multiContrast', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['contrast'] } } },
				{ displayName: 'Saturation', name: 'multiSaturation', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['saturation'] } } },
				{ displayName: 'Pad', name: 'multiPad', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pad'] } } },
				{
					displayName: 'Pad Sides',
					name: 'multiPadSides',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['padSides'] } },
				},
				{ displayName: 'Pad Top', name: 'multiPadTop', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['padSides'] } } },
				{ displayName: 'Pad Right', name: 'multiPadRight', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['padSides'] } } },
				{ displayName: 'Pad Bottom', name: 'multiPadBottom', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['padSides'] } } },
				{ displayName: 'Pad Left', name: 'multiPadLeft', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['padSides'] } } },
				{ displayName: 'Pad Color', name: 'multiPadColor', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['padColor'] } } },
				{ displayName: 'Border', name: 'multiBorder', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['border'] } } },
				{ displayName: 'Border Color', name: 'multiBorderColor', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['borderColor'] } } },
				{ displayName: 'Border Radius', name: 'multiBorderRadius', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['borderRadius'] } } },
				{ displayName: 'Background Blur', name: 'multiBackgroundBlur', type: 'number', default: 0, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['backgroundBlur'] } } },
				{ displayName: 'Watermark Text', name: 'multiWatermarkText', type: 'string', default: '', displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } } },
				{ displayName: 'Watermark Font Size', name: 'multiWatermarkFontSize', type: 'number', default: 24, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } } },
				{ displayName: 'Watermark Color', name: 'multiWatermarkColor', type: 'string', default: '#000000', displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } } },
				{ displayName: 'Watermark Opacity', name: 'multiWatermarkOpacity', type: 'number', default: 0.35, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } } },
				{
					displayName: 'Watermark Position',
					name: 'multiWatermarkPosition',
					type: 'options',
					default: 'center',
					options: [
						{ name: 'Center', value: 'center' },
						{ name: 'Top Left', value: 'top-left' },
						{ name: 'Top Right', value: 'top-right' },
						{ name: 'Bottom Left', value: 'bottom-left' },
						{ name: 'Bottom Right', value: 'bottom-right' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } },
				},
				{ displayName: 'Watermark Margin', name: 'multiWatermarkMargin', type: 'number', default: 8, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } } },
				{ displayName: 'Watermark Scale', name: 'multiWatermarkScale', type: 'number', default: 1, displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } } },
				{
					displayName: 'Watermark Image Binary Property',
					name: 'multiWatermarkImageBinaryProp',
					type: 'string',
					default: '',
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['watermark'] } },
				},
				{
					displayName: 'PDF Mode',
					name: 'multiPdfMode',
					type: 'options',
					default: 'single',
					options: [
						{ name: 'Single', value: 'single' },
						{ name: 'Multi', value: 'multi' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pdf'] } },
				},
				{
					displayName: 'PDF Page Size',
					name: 'multiPdfPageSize',
					type: 'options',
					default: 'auto',
					options: [
						{ name: 'Auto', value: 'auto' },
						{ name: 'A4', value: 'a4' },
						{ name: 'Letter', value: 'letter' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pdf'] } },
				},
				{
					displayName: 'PDF Orientation',
					name: 'multiPdfOrientation',
					type: 'options',
					default: 'portrait',
					options: [
						{ name: 'Portrait', value: 'portrait' },
						{ name: 'Landscape', value: 'landscape' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pdf'] } },
				},
				{
					displayName: 'PDF Margin',
					name: 'multiPdfMargin',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pdf'] } },
				},
				{
					displayName: 'PDF Embed Format',
					name: 'multiPdfEmbedFormat',
					type: 'options',
					default: 'png',
					options: [
						{ name: 'PNG', value: 'png' },
						{ name: 'JPEG', value: 'jpeg' },
					],
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pdf'] } },
				},
				{
					displayName: 'PDF JPEG Quality',
					name: 'multiPdfJpegQuality',
					type: 'number',
					default: 85,
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['pdf'] } },
				},
				{
					displayName: 'Include Raw EXIF',
					name: 'multiIncludeRawExif',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['image'], operation: ['multitask'], imageMultitaskOptions: ['includeRawExif'] } },
				},

				{
					displayName: 'Download Result(s) as Binary',
					name: 'imageDownloadBinary',
					type: 'boolean',
					default: false,
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
					displayOptions: { show: { resource: ['pdf'], operation: ['split', 'extract'] } },
				},
				{
					displayName: 'Pages',
					name: 'pages',
					type: 'string',
					default: 'all',
					placeholder: 'all OR 1-3,5,7',
					displayOptions: {
						show: { resource: ['pdf'], operation: ['to-images', 'extract-images', 'watermark', 'rotate', 'delete-pages', 'extract'] },
					},
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
				{ displayName: 'Watermark Text', name: 'watermarkText', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{ displayName: 'Watermark Opacity', name: 'watermarkOpacity', type: 'number', default: 0.35, displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
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
				{ displayName: 'Watermark Scale', name: 'watermarkScale', type: 'number', default: 1, displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } } },
				{
					displayName: 'Watermark Image Binary Property',
					name: 'watermarkImageBinaryProp',
					type: 'string',
					default: '',
					displayOptions: { show: { resource: ['pdf'], operation: ['watermark'] } },
				},
				{ displayName: 'Degrees', name: 'degrees', type: 'number', default: 0, displayOptions: { show: { resource: ['pdf'], operation: ['rotate'] } } },
				{ displayName: 'Title', name: 'title', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Author', name: 'author', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Subject', name: 'subject', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Keywords', name: 'keywords', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Creator', name: 'creator', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Producer', name: 'producer', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Clean All Metadata', name: 'cleanAllMetadata', type: 'boolean', default: false, displayOptions: { show: { resource: ['pdf'], operation: ['metadata'] } } },
				{ displayName: 'Order (JSON array)', name: 'order', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['reorder'] } } },
				{ displayName: 'Mode', name: 'mode', type: 'string', default: 'range', displayOptions: { show: { resource: ['pdf'], operation: ['extract'] } } },
				{ displayName: 'Flatten Forms', name: 'flattenForms', type: 'boolean', default: false, displayOptions: { show: { resource: ['pdf'], operation: ['flatten'] } } },
				{ displayName: 'User Password', name: 'userPassword', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['encrypt'] } } },
				{ displayName: 'Owner Password', name: 'ownerPassword', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['encrypt'] } } },
				{ displayName: 'Password', name: 'password', type: 'string', default: '', displayOptions: { show: { resource: ['pdf'], operation: ['decrypt'] } } },

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
					displayOptions: { show: { resource: ['tools'] } },
				},
				{
					displayName: 'Tool',
					name: 'tool',
					type: 'options',
					default: 'metadata',
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
					displayName: 'Include Raw EXIF',
					name: 'includeRawExif',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['metadata'] } },
				},
				{
					displayName: 'Include Raw EXIF',
					name: 'multiIncludeRawExif',
					type: 'boolean',
					default: false,
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['metadata'] } },
				},
				{
					displayName: 'Palette Size',
					name: 'paletteSize',
					type: 'number',
					default: 5,
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['palette'] } },
				},
				{
					displayName: 'Palette Size',
					name: 'multiPaletteSize',
					type: 'number',
					default: 5,
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['palette'] } },
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
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['hash'] } },
				},
				{
					displayName: 'Hash Type',
					name: 'multiHashType',
					type: 'options',
					default: 'phash',
					options: [
						{ name: 'pHash', value: 'phash' },
						{ name: 'MD5', value: 'md5' },
						{ name: 'SHA1', value: 'sha1' },
					],
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['hash'] } },
				},
				{
					displayName: 'Quality Sample',
					name: 'qualitySample',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['quality'] } },
				},
				{
					displayName: 'Quality Sample',
					name: 'multiQualitySample',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['quality'] } },
				},
				{
					displayName: 'Transparency Sample',
					name: 'transparencySample',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['transparency'] } },
				},
				{
					displayName: 'Transparency Sample',
					name: 'multiTransparencySample',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['transparency'] } },
				},
				{
					displayName: 'Similarity Mode',
					name: 'similarityMode',
					type: 'string',
					default: '',
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['similarity'] } },
				},
				{
					displayName: 'Similarity Mode',
					name: 'multiSimilarityMode',
					type: 'string',
					default: '',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['similarity'] } },
				},
				{
					displayName: 'Similarity Threshold',
					name: 'similarityThreshold',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['similarity'] } },
				},
				{
					displayName: 'Similarity Threshold',
					name: 'multiSimilarityThreshold',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['similarity'] } },
				},
				{
					displayName: 'Efficiency Format',
					name: 'efficiencyFormat',
					type: 'string',
					default: '',
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['efficiency'] } },
				},
				{
					displayName: 'Efficiency Format',
					name: 'multiEfficiencyFormat',
					type: 'string',
					default: '',
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['efficiency'] } },
				},
				{
					displayName: 'Efficiency Quality',
					name: 'efficiencyQuality',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['single'], tool: ['efficiency'] } },
				},
				{
					displayName: 'Efficiency Quality',
					name: 'multiEfficiencyQuality',
					type: 'number',
					default: 0,
					displayOptions: { show: { resource: ['tools'], operation: ['multitask'], tools: ['efficiency'] } },
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
							const options = this.getNodeParameter('imageMultitaskOptions', itemIndex) as string[];
							const has = (key: string) => options.includes(key);
							if (has('format')) setString('format', this.getNodeParameter('multiFormat', itemIndex) as string);
							if (has('width')) setNumber('width', this.getNodeParameter('multiWidth', itemIndex) as number);
							if (has('height')) setNumber('height', this.getNodeParameter('multiHeight', itemIndex) as number);
							if (has('enlarge')) setBool('enlarge', this.getNodeParameter('multiEnlarge', itemIndex) as boolean);
							if (has('normalizeOrientation')) setBool('normalizeOrientation', this.getNodeParameter('multiNormalizeOrientation', itemIndex) as boolean);
							if (has('crop')) {
								setNumber('cropX', this.getNodeParameter('multiCropX', itemIndex) as number);
								setNumber('cropY', this.getNodeParameter('multiCropY', itemIndex) as number);
								setNumber('cropWidth', this.getNodeParameter('multiCropWidth', itemIndex) as number);
								setNumber('cropHeight', this.getNodeParameter('multiCropHeight', itemIndex) as number);
							}
							if (has('backgroundColor')) setString('backgroundColor', this.getNodeParameter('multiBackgroundColor', itemIndex) as string);
							if (has('rotate')) setNumber('rotate', this.getNodeParameter('multiRotate', itemIndex) as number);
							if (has('flipH')) setBool('flipH', this.getNodeParameter('multiFlipH', itemIndex) as boolean);
							if (has('flipV')) setBool('flipV', this.getNodeParameter('multiFlipV', itemIndex) as boolean);
							if (has('colorSpace')) formData.colorSpace = this.getNodeParameter('multiColorSpace', itemIndex) as string;
							if (has('targetSizeKB')) setNumber('targetSizeKB', this.getNodeParameter('multiTargetSizeKB', itemIndex) as number);
							if (has('quality')) setNumber('quality', this.getNodeParameter('multiQuality', itemIndex) as number);
							if (has('keepMetadata')) setBool('keepMetadata', this.getNodeParameter('multiKeepMetadata', itemIndex) as boolean);
							if (has('blur')) setNumber('blur', this.getNodeParameter('multiBlur', itemIndex) as number);
							if (has('sharpen')) setNumber('sharpen', this.getNodeParameter('multiSharpen', itemIndex) as number);
							if (has('grayscale')) setBool('grayscale', this.getNodeParameter('multiGrayscale', itemIndex) as boolean);
							if (has('sepia')) setBool('sepia', this.getNodeParameter('multiSepia', itemIndex) as boolean);
							if (has('brightness')) setNumber('brightness', this.getNodeParameter('multiBrightness', itemIndex) as number);
							if (has('contrast')) setNumber('contrast', this.getNodeParameter('multiContrast', itemIndex) as number);
							if (has('saturation')) setNumber('saturation', this.getNodeParameter('multiSaturation', itemIndex) as number);
							if (has('pad')) setNumber('pad', this.getNodeParameter('multiPad', itemIndex) as number);
							if (has('padSides')) {
								setBool('padSides', this.getNodeParameter('multiPadSides', itemIndex) as boolean);
								setNumber('padTop', this.getNodeParameter('multiPadTop', itemIndex) as number);
								setNumber('padRight', this.getNodeParameter('multiPadRight', itemIndex) as number);
								setNumber('padBottom', this.getNodeParameter('multiPadBottom', itemIndex) as number);
								setNumber('padLeft', this.getNodeParameter('multiPadLeft', itemIndex) as number);
							}
							if (has('padColor')) setString('padColor', this.getNodeParameter('multiPadColor', itemIndex) as string);
							if (has('border')) setNumber('border', this.getNodeParameter('multiBorder', itemIndex) as number);
							if (has('borderColor')) setString('borderColor', this.getNodeParameter('multiBorderColor', itemIndex) as string);
							if (has('borderRadius')) setNumber('borderRadius', this.getNodeParameter('multiBorderRadius', itemIndex) as number);
							if (has('backgroundBlur')) setNumber('backgroundBlur', this.getNodeParameter('multiBackgroundBlur', itemIndex) as number);
							if (has('watermark')) {
								setString('watermarkText', this.getNodeParameter('multiWatermarkText', itemIndex) as string);
								setNumber('watermarkFontSize', this.getNodeParameter('multiWatermarkFontSize', itemIndex) as number);
								setString('watermarkColor', this.getNodeParameter('multiWatermarkColor', itemIndex) as string);
								setNumber('watermarkOpacity', this.getNodeParameter('multiWatermarkOpacity', itemIndex) as number);
								formData.watermarkPosition = this.getNodeParameter('multiWatermarkPosition', itemIndex) as string;
								setNumber('watermarkMargin', this.getNodeParameter('multiWatermarkMargin', itemIndex) as number);
								setNumber('watermarkScale', this.getNodeParameter('multiWatermarkScale', itemIndex) as number);
								await includeWatermarkFile(this.getNodeParameter('multiWatermarkImageBinaryProp', itemIndex) as string);
							}
							if (has('pdf')) {
								formData.pdfMode = this.getNodeParameter('multiPdfMode', itemIndex) as string;
								formData.pdfPageSize = this.getNodeParameter('multiPdfPageSize', itemIndex) as string;
								formData.pdfOrientation = this.getNodeParameter('multiPdfOrientation', itemIndex) as string;
								setNumber('pdfMargin', this.getNodeParameter('multiPdfMargin', itemIndex) as number);
								formData.pdfEmbedFormat = this.getNodeParameter('multiPdfEmbedFormat', itemIndex) as string;
								setNumber('pdfJpegQuality', this.getNodeParameter('multiPdfJpegQuality', itemIndex) as number);
							}
							if (has('includeRawExif')) setBool('includeRawExif', this.getNodeParameter('multiIncludeRawExif', itemIndex) as boolean);
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

					if (hasTool('metadata')) {
						const val = action === 'single'
							? (this.getNodeParameter('includeRawExif', itemIndex) as boolean)
							: (this.getNodeParameter('multiIncludeRawExif', itemIndex) as boolean);
						setBool('includeRawExif', val);
					}

					if (hasTool('palette')) {
						const val = action === 'single'
							? (this.getNodeParameter('paletteSize', itemIndex) as number)
							: (this.getNodeParameter('multiPaletteSize', itemIndex) as number);
						setNumber('paletteSize', val);
					}

					if (hasTool('hash')) {
						const val = action === 'single'
							? (this.getNodeParameter('hashType', itemIndex) as string)
							: (this.getNodeParameter('multiHashType', itemIndex) as string);
						setString('hashType', val);
					}

					if (hasTool('quality')) {
						const val = action === 'single'
							? (this.getNodeParameter('qualitySample', itemIndex) as number)
							: (this.getNodeParameter('multiQualitySample', itemIndex) as number);
						setNumber('qualitySample', val);
					}

					if (hasTool('transparency')) {
						const val = action === 'single'
							? (this.getNodeParameter('transparencySample', itemIndex) as number)
							: (this.getNodeParameter('multiTransparencySample', itemIndex) as number);
						setNumber('transparencySample', val);
					}

					if (hasTool('similarity')) {
						const mode = action === 'single'
							? (this.getNodeParameter('similarityMode', itemIndex) as string)
							: (this.getNodeParameter('multiSimilarityMode', itemIndex) as string);
						const threshold = action === 'single'
							? (this.getNodeParameter('similarityThreshold', itemIndex) as number)
							: (this.getNodeParameter('multiSimilarityThreshold', itemIndex) as number);
						setString('similarityMode', mode);
						setNumber('similarityThreshold', threshold);
					}

					if (hasTool('efficiency')) {
						const format = action === 'single'
							? (this.getNodeParameter('efficiencyFormat', itemIndex) as string)
							: (this.getNodeParameter('multiEfficiencyFormat', itemIndex) as string);
						const quality = action === 'single'
							? (this.getNodeParameter('efficiencyQuality', itemIndex) as number)
							: (this.getNodeParameter('multiEfficiencyQuality', itemIndex) as number);
						setString('efficiencyFormat', format);
						setNumber('efficiencyQuality', quality);
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
