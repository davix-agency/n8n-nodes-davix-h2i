import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class DavixH2IApi implements ICredentialType {
	name = 'davixH2IApi';
	displayName = 'Davix H2I (PixLab) API';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://pixlab.davix.dev',
			placeholder: 'https://pixlab.davix.dev',
			description: 'Your PixLab API base URL (no trailing slash). Example: https://pixlab.davix.dev',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];
}
