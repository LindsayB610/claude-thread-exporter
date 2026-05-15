export interface GitHubWriteOptions {
  repo: string;
  repoPath: string;
  branch?: string;
  content: string | Uint8Array;
  force: boolean;
  token?: string;
  apiRoot?: string;
}

interface GitHubContentFile {
  type?: string;
  sha?: string;
}

export async function writeGitHubFile(options: GitHubWriteOptions): Promise<void> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN. Set it to a GitHub token with Contents write access.");
  }

  const apiRoot = options.apiRoot ?? "https://api.github.com";
  const url = buildContentsUrl(apiRoot, options.repo, options.repoPath, options.branch);
  const existingFile = await fetchExistingFile(url, options, token);

  if (existingFile && !options.force) {
    throw new Error(
      `Refusing to overwrite existing GitHub file without --force: ${options.repo}/${options.repoPath}`
    );
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: `Export Claude conversation to ${options.repoPath}`,
      content: Buffer.from(options.content).toString("base64"),
      sha: existingFile?.sha,
      branch: options.branch
    })
  });

  if (!response.ok) {
    throw new Error(await githubErrorMessage(response, options));
  }
}

async function fetchExistingFile(
  url: string,
  options: GitHubWriteOptions,
  token: string
): Promise<GitHubContentFile | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await githubErrorMessage(response, options));
  }

  const payload = (await response.json()) as GitHubContentFile;
  if (payload.type !== "file" || !payload.sha) {
    throw new Error(`GitHub path is not a writable file: ${options.repo}/${options.repoPath}`);
  }

  return payload;
}

function buildContentsUrl(apiRoot: string, repo: string, repoPath: string, branch?: string): string {
  const encodedPath = repoPath.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`/repos/${repo}/contents/${encodedPath}`, apiRoot);
  if (branch) {
    url.searchParams.set("ref", branch);
  }
  return url.toString();
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function githubErrorMessage(response: Response, options: GitHubWriteOptions): Promise<string> {
  const detail = await githubErrorDetail(response);
  const target = `${options.repo}/${options.repoPath}`;

  if (response.status === 401 || response.status === 403) {
    return `GitHub rejected access to ${options.repo}. Check GITHUB_TOKEN permissions and repo access. ${detail}`;
  }

  if (response.status === 409 || response.status === 422) {
    return `GitHub could not write ${target}. Check the branch, path, and overwrite settings, then try again. ${detail}`;
  }

  return `GitHub write failed for ${target} (HTTP ${response.status}). ${detail}`;
}

async function githubErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
  } catch {
    // Fall through to status text.
  }

  return response.statusText || "No additional details.";
}
