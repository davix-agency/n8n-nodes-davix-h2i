import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

function stripTrailingSlash(url: string): string {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

function ensureLeadingSlash(path: string): string {
	if (!path) return '/';
	return path.startsWith('/') ? path : `/${path}`;
}

export async function davixRequest(
	this: IExecuteFunctions,
	options: IHttpRequestOptions,
): Promise<IDataObject> {
	const creds = await this.getCredentials('davixH2IApi');

	const baseUrl = stripTrailingSlash(String(creds.baseUrl || ''));
	const apiKey = String(creds.apiKey || '');

	if (!baseUrl) throw new Error('Missing Base URL in credentials.');
	if (!apiKey) throw new Error('Missing API Key in credentials.');

	const requestOptions: IHttpRequestOptions = {
		...options,
		url: `${baseUrl}${ensureLeadingSlash(String(options.url || ''))}`,
		headers: {
			...(options.headers || {}),
			// PixLab accepts x-api-key
			'x-api-key': apiKey,
		},
	};

	return await this.helpers.request(requestOptions);
}

export async function downloadToBinary(
	this: IExecuteFunctions,
	url: string,
	fileName: string,
): Promise<{ data: Buffer; fileName: string; mimeType?: string }> {
	const res = await this.helpers.request({
		method: 'GET',
		url,
		encoding: null, // IMPORTANT: Buffer
		resolveWithFullResponse: true,
	});

	const body = res.body as Buffer;
	const mimeType = (res.headers?.['content-type'] as string) || undefined;

	return { data: body, fileName, mimeType };
}
