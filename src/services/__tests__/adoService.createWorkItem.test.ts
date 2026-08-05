import axios from 'axios';
import { adoService } from '../adoService';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const clientPost = jest.fn();

const createdResponse = {
  data: {
    id: 4321,
    fields: {
      'System.Title': 'Fix flaky test',
      'System.WorkItemType': 'Task',
      'System.State': 'New',
    },
  },
};

const findPatch = (document: any[], path: string) => document.find((op) => op.path === path);

beforeEach(() => {
  // CRA's jest config resets mocks between tests, so the client factory has to
  // be re-stubbed before the service rebuilds its Axios instance.
  clientPost.mockReset();
  mockedAxios.post.mockReset();
  mockedAxios.create.mockReturnValue({ post: clientPost } as any);

  adoService.updateConfig({
    organization: 'contoso',
    project: 'My Project',
    personalAccessToken: 'pat',
    apiVersion: '7.0',
    teamName: 'My Team',
    refreshInterval: 0,
    enableAutoRefresh: false,
  });
});

describe('adoService.createWorkItem', () => {
  test('posts to the typed create endpoint with an encoded project and type', async () => {
    clientPost.mockResolvedValue(createdResponse);

    const workItem = await adoService.createWorkItem({ type: 'User Story', title: 'Fix flaky test' });

    const [url, , config] = clientPost.mock.calls[0];
    expect(url).toBe('/My%20Project/_apis/wit/workitems/$User%20Story');
    expect(config.params['api-version']).toBe('7.0');
    expect(config.headers['Content-Type']).toBe('application/json-patch+json');
    expect(workItem.id).toBe(4321);
  });

  test('omits System.WorkItemType, which Azure DevOps rejects as a field', async () => {
    clientPost.mockResolvedValue(createdResponse);

    await adoService.createWorkItem({ type: 'Task', title: 'Fix flaky test' });

    const [, document] = clientPost.mock.calls[0];
    expect(findPatch(document, '/fields/System.WorkItemType')).toBeUndefined();
    expect(findPatch(document, '/fields/System.Title').value).toBe('Fix flaky test');
  });

  test('links the parent as a hierarchy relation instead of a System.Parent field', async () => {
    clientPost.mockResolvedValue(createdResponse);

    await adoService.createWorkItem({ type: 'Task', title: 'Fix flaky test', parentId: 99 });

    const [, document] = clientPost.mock.calls[0];
    expect(findPatch(document, '/fields/System.Parent')).toBeUndefined();
    expect(findPatch(document, '/relations/-').value).toEqual({
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: 'https://dev.azure.com/contoso/_apis/wit/workItems/99',
    });
  });

  test('keeps zero effort and priority values', async () => {
    clientPost.mockResolvedValue(createdResponse);

    await adoService.createWorkItem({ type: 'Task', title: 'Fix flaky test', effort: 0, priority: 0 });

    const [, document] = clientPost.mock.calls[0];
    expect(findPatch(document, '/fields/Microsoft.VSTS.Scheduling.Effort').value).toBe(0);
    expect(findPatch(document, '/fields/Microsoft.VSTS.Common.Priority').value).toBe(0);
  });

  test('rejects an empty title before calling Azure DevOps', async () => {
    await expect(adoService.createWorkItem({ type: 'Task', title: '   ' })).rejects.toThrow(
      'title is required'
    );
    expect(clientPost).not.toHaveBeenCalled();
  });

  test('surfaces the Azure DevOps error message', async () => {
    clientPost.mockRejectedValue({
      response: { status: 400, data: { message: 'TF401326: Invalid field name System.Parent.' } },
    });

    await expect(adoService.createWorkItem({ type: 'Task', title: 'Fix flaky test' })).rejects.toThrow(
      'Failed to create Task: TF401326: Invalid field name System.Parent.'
    );
  });

  test('rejects the HTML sign-in page Azure DevOps returns for an invalid token', async () => {
    clientPost.mockResolvedValue({ data: '<html>Azure DevOps Services | Sign In</html>' });

    await expect(adoService.createWorkItem({ type: 'Task', title: 'Fix flaky test' })).rejects.toThrow(
      'personal access token is likely invalid or expired'
    );
  });

  test('retries through the local proxy when the browser blocks the direct call', async () => {
    clientPost.mockRejectedValue({ message: 'Network Error' });
    mockedAxios.post.mockResolvedValue(createdResponse);

    const workItem = await adoService.createWorkItem({ type: 'Task', title: 'Fix flaky test', parentId: 99 });

    const [proxyUrl, payload] = mockedAxios.post.mock.calls[0];
    expect(proxyUrl).toBe('/api/ado-proxy/workitems/create');
    expect(payload).toMatchObject({ organization: 'contoso', project: 'My Project', type: 'Task' });
    expect(findPatch((payload as any).document, '/relations/-')).toBeDefined();
    expect(workItem.id).toBe(4321);
  });
});
